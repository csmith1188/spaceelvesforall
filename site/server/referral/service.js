/**
 * Referral program orchestration: attribution, milestones, notices.
 */

import { asErr, logger } from "../logger.js";
import {
  accountEligibleForReferrals,
  attributeReferral,
  createAccountNotice,
  createReferralRewardRows,
  creditAndReleaseReferralReward,
  ensureReferralCodeForAccount,
  getAccount,
  getReferralCodeByCode,
  getReferralRelationshipByReferee,
  getReferralReward,
  loadReferralConfig,
  putPendingReferral,
  resolveReferralCodeForAttribution,
  takePendingReferral,
} from "../db.js";
import { rewardCopy } from "./config.js";
import { applyRiskToPendingRewards, recalculateReferralRisk } from "./risk.js";

export { rewardCopy };

export async function referralsActive() {
  const cfg = await loadReferralConfig();
  return cfg.enabled;
}

export async function lookupReferrerPreview(code) {
  const resolved = await resolveReferralCodeForAttribution(code);
  if (!resolved) return null;
  return {
    code: resolved.codeRow.vanity_code || resolved.codeRow.code,
    name: resolved.owner.name,
    accountId: resolved.owner.id,
  };
}

export async function bindOAuthPendingReferral(oauthState, code) {
  if (!(await referralsActive())) return false;
  const resolved = await resolveReferralCodeForAttribution(code);
  if (!resolved) return false;
  return putPendingReferral(oauthState, resolved.codeRow.code);
}

/**
 * Attribute a newly created non-Formbar account.
 * typedCode: user-submitted field (hard-fail if invalid).
 * cookieCode: soft — ignore if invalid.
 */
export async function tryAttributeNewAccount({
  account,
  typedCode = null,
  cookieCode = null,
  oauthState = null,
  browserId = null,
  ip = null,
  hardFailTyped = true,
} = {}) {
  if (!(await referralsActive())) return { ok: false, skipped: true, reason: "disabled" };
  if (!accountEligibleForReferrals(account)) {
    return { ok: false, skipped: true, reason: "ineligible" };
  }

  let code = null;
  let fromTyped = false;
  if (typedCode && String(typedCode).trim()) {
    code = String(typedCode).trim();
    fromTyped = true;
  } else if (oauthState) {
    code = await takePendingReferral(oauthState);
  }
  if (!code && cookieCode) code = cookieCode;

  if (!code) return { ok: false, skipped: true, reason: "no_code" };

  const resolved = await resolveReferralCodeForAttribution(code);
  if (!resolved) {
    if (fromTyped && hardFailTyped) return { ok: false, error: "invalid_code" };
    return { ok: false, skipped: true, reason: "invalid_code" };
  }

  const result = await attributeReferral({
    refereeAccountId: account.id,
    code: resolved.codeRow.code,
    browserId,
    ip,
  });
  if (!result.ok) {
    if (result.error === "self_referral" && fromTyped && hardFailTyped) {
      return result;
    }
    logger.info({
      event: "referral_attributed",
      ok: false,
      reason: result.error,
      accountId: account.id,
    }, "referral attribution skipped");
    return result;
  }

  logger.info({
    event: "referral_attributed",
    accountId: account.id,
    referrerAccountId: result.referrer.id,
    relationshipId: result.relationship.id,
    code: result.code,
  }, "referral attributed");

  await ensureReferralCodeForAccount(account.id).catch(() => {});

  // Score at registration (may mark elevated/high for later rewards).
  await recalculateReferralRisk(account.id, {
    relationship: result.relationship,
    account,
    browserId,
    ip,
  }).catch((err) => {
    logger.warn({ event: "referral_score_failed", err: asErr(err), accountId: account.id }, "risk score failed");
  });

  // If already verified at creation (Discord verified email / AUTH_EMAIL off), grant verify.
  if (account.email_verified_at) {
    await onReferralAccountVerified(account.id).catch((err) => {
      logger.warn({ event: "referral_verify_hook_failed", err: asErr(err), accountId: account.id }, "verify hook failed");
    });
  }

  return result;
}

async function issueMilestoneRewards(relationship, milestone, {
  tickets,
  purchaseId = null,
  account = null,
} = {}) {
  const config = await loadReferralConfig();
  const refereeId = relationship.referee_account_id;
  const risk = await recalculateReferralRisk(refereeId, {
    relationship,
    account: account || await getAccount(refereeId),
  });
  logger.info({
    event: "referral_score_changed",
    accountId: refereeId,
    relationshipId: relationship.id,
    score: risk.score,
    riskClass: risk.class,
    milestone,
  }, "referral risk scored");

  if (risk.class === "high") {
    logger.info({
      event: "referral_flagged",
      accountId: refereeId,
      relationshipId: relationship.id,
      score: risk.score,
    }, "referral high risk");
  }

  const created = await createReferralRewardRows({
    relationshipId: relationship.id,
    milestone,
    tickets,
    purchaseId,
    riskScore: risk.score,
    riskClass: risk.class,
    holdDays: config.holdDays,
    elevatedHoldDays: config.elevatedHoldDays,
  });
  if (!created.ok) return created;

  const released = [];
  for (const reward of created.rewards || []) {
    logger.info({
      event: "referral_reward_created",
      rewardId: reward.id,
      accountId: reward.recipient_account_id,
      milestone,
      role: reward.role,
      status: reward.status,
      tickets: reward.tickets,
    }, "referral reward created");

    if (reward.role === "referee" && reward.status === "pending" && risk.class !== "high") {
      const credit = await creditAndReleaseReferralReward(reward.id);
      if (credit.ok && !credit.duplicate) {
        released.push(credit.reward);
        logger.info({
          event: "referral_reward_released",
          rewardId: reward.id,
          accountId: reward.recipient_account_id,
          tickets: credit.credited,
        }, "referee referral reward released");
        await createAccountNotice(
          reward.recipient_account_id,
          "referral_reward",
          `You received ${credit.credited} referral tickets.`,
        ).catch(() => {});
      }
    } else if (reward.role === "referrer" && reward.status !== "review") {
      await createAccountNotice(
        reward.recipient_account_id,
        "referral_pending",
        `A recruit hit ${milestone}. ${reward.tickets} tickets are pending release.`,
      ).catch(() => {});
    } else if (reward.status === "review") {
      await createAccountNotice(
        reward.recipient_account_id,
        "referral_review",
        "A referral reward is held for review.",
      ).catch(() => {});
    }
  }

  await applyRiskToPendingRewards(relationship.id, risk, config).catch(() => {});
  return { ok: true, created, risk, released };
}

export async function onReferralAccountVerified(accountId) {
  if (!(await referralsActive())) return { ok: false, skipped: true };
  const account = await getAccount(accountId);
  if (!accountEligibleForReferrals(account)) return { ok: false, skipped: true };
  if (!account.email_verified_at) return { ok: false, skipped: true, reason: "not_verified" };

  const relationship = await getReferralRelationshipByReferee(account.id);
  if (!relationship) return { ok: false, skipped: true, reason: "not_referred" };
  if (relationship.verified_at) {
    // Still idempotent — createReferralRewardRows unique constraint.
  }

  const config = await loadReferralConfig();
  logger.info({
    event: "referral_verified",
    accountId: account.id,
    relationshipId: relationship.id,
  }, "referred account verified");

  return issueMilestoneRewards(relationship, "verify", {
    tickets: config.verifyTickets,
    account,
  });
}

export async function onReferralQualifyingPurchase(purchase) {
  if (!(await referralsActive())) return { ok: false, skipped: true };
  if (!purchase || purchase.status !== "credited") return { ok: false, skipped: true };
  const config = await loadReferralConfig();
  const cents = Math.round(Number(String(purchase.amount_value).replace(/[^\d.]/g, "")) * 100);
  // Prefer amountValueToCents via catalog amount already on row.
  const amountCents = (() => {
    const s = String(purchase.amount_value ?? "").trim();
    const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) return 0;
    return Number(m[1]) * 100 + Number((m[2] || "00").padEnd(2, "0").slice(0, 2));
  })();
  void cents;
  if (amountCents < config.minPurchaseCents) {
    return { ok: false, skipped: true, reason: "below_minimum" };
  }

  const account = await getAccount(purchase.account_id);
  if (!accountEligibleForReferrals(account)) return { ok: false, skipped: true };

  const relationship = await getReferralRelationshipByReferee(account.id);
  if (!relationship) return { ok: false, skipped: true, reason: "not_referred" };
  if (relationship.purchased_at) {
    return { ok: false, skipped: true, reason: "already_purchased" };
  }

  logger.info({
    event: "referral_purchased",
    accountId: account.id,
    relationshipId: relationship.id,
    purchaseId: purchase.id,
  }, "referred account qualifying purchase");

  return issueMilestoneRewards(relationship, "purchase", {
    tickets: config.purchaseTickets,
    purchaseId: purchase.id,
    account,
  });
}

export async function notifyRewardReleased(reward) {
  if (!reward) return;
  await createAccountNotice(
    reward.recipient_account_id,
    "referral_reward",
    `Your pending referral reward of ${reward.tickets} tickets is now available.`,
  ).catch(() => {});
}

export async function getCodeRowPublic(code) {
  const row = await getReferralCodeByCode(code);
  if (!row || row.disabled_at) return null;
  return row;
}

export async function peekReward(id) {
  return getReferralReward(id);
}
