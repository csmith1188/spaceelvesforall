/**
 * Background release of pending / extended referral rewards.
 */

import { workerIndex } from "../owners.js";
import { asErr, logger } from "../logger.js";
import {
  claimJobLease,
  creditAndReleaseReferralReward,
  getReferralRelationship,
  listDueReferralRewards,
  loadReferralConfig,
  releaseJobLease,
  updateReferralRewardRisk,
} from "../db.js";
import { notifyRewardReleased } from "./service.js";
import { recalculateReferralRisk } from "./risk.js";

const JOB = "referral_rewards";
const TICK_MS = 60_000;
const LEASE_MS = 55_000;

let timer = null;

export async function processReferralRewardReleases({ limit = 50 } = {}) {
  const config = await loadReferralConfig();
  if (!config.enabled) return { ok: true, skipped: true, reason: "disabled" };

  const owner = `w${workerIndex()}:${process.pid}:referral`;
  const claimed = await claimJobLease(JOB, owner, LEASE_MS);
  if (!claimed) {
    return { ok: true, skipped: true, reason: "lease" };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  let released = 0;
  let extended = 0;
  let reviewed = 0;
  try {
    const due = await listDueReferralRewards(limit);
    for (const reward of due) {
      try {
        const relationship = await getReferralRelationship(reward.relationship_id);
        if (!relationship) {
          await updateReferralRewardRisk(reward.id, {
            riskScore: reward.risk_score,
            riskClass: reward.risk_class,
            status: "rejected",
            releaseAt: null,
          });
          continue;
        }
        const risk = await recalculateReferralRisk(relationship.referee_account_id, {
          relationship,
        });
        const milestoneAt = Number(reward.created_at) || Date.now();
        const standardAt = milestoneAt + config.holdDays * dayMs;
        const elevatedAt = milestoneAt + config.elevatedHoldDays * dayMs;
        const now = Date.now();

        if (risk.class === "high") {
          await updateReferralRewardRisk(reward.id, {
            riskScore: risk.score,
            riskClass: risk.class,
            status: "review",
            releaseAt: null,
          });
          reviewed += 1;
          logger.info({
            event: "referral_flagged",
            rewardId: reward.id,
            accountId: reward.recipient_account_id,
            score: risk.score,
          }, "reward moved to review");
          continue;
        }

        if (risk.class === "elevated" && now < elevatedAt) {
          await updateReferralRewardRisk(reward.id, {
            riskScore: risk.score,
            riskClass: risk.class,
            status: "extended",
            releaseAt: elevatedAt,
          });
          extended += 1;
          logger.info({
            event: "referral_reward_extended",
            rewardId: reward.id,
            releaseAt: elevatedAt,
          }, "reward hold extended");
          continue;
        }

        // Normal (or elevated past 14d, or risk dropped and standard hold elapsed).
        if (risk.class === "normal" && now < standardAt && reward.role === "referrer") {
          await updateReferralRewardRisk(reward.id, {
            riskScore: risk.score,
            riskClass: risk.class,
            status: "pending",
            releaseAt: standardAt,
          });
          continue;
        }

        const credit = await creditAndReleaseReferralReward(reward.id);
        if (credit.ok && !credit.duplicate) {
          released += 1;
          logger.info({
            event: "referral_reward_released",
            rewardId: reward.id,
            accountId: reward.recipient_account_id,
            tickets: credit.credited,
          }, "referral reward released");
          await notifyRewardReleased(credit.reward);
        }
      } catch (err) {
        logger.error({
          event: "referral_release_item_failed",
          rewardId: reward.id,
          err: asErr(err),
        }, "referral reward release failed");
      }
    }
    return { ok: true, released, extended, reviewed, scanned: due.length };
  } finally {
    await releaseJobLease(JOB, owner).catch(() => {});
  }
}

export function startReferralReleaseJob(intervalMs = TICK_MS) {
  if (timer) return;
  const tick = () => {
    processReferralRewardReleases().catch((err) => {
      logger.error({ event: "referral_release_job_failed", err: asErr(err) }, "referral release job failed");
    });
  };
  timer = setInterval(tick, intervalMs);
  timer.unref?.();
  setTimeout(tick, 20_000).unref?.();
  logger.info({ event: "referral_release_job_started", intervalMs }, "referral release job started");
}

export function stopReferralReleaseJob() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
