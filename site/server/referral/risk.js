/**
 * Deterministic referral fraud risk scoring.
 * Scores are recomputed from distinct evidence rows — never accumulated on re-score.
 */

import {
  classifyRiskScore,
  RISK_SIGNALS,
} from "./config.js";
import { networkKeyFromIp } from "./network.js";
import {
  clearReferralEvidenceSignal,
  countRecentReferralSignups,
  findAccountsSharingBrowser,
  findAccountsSharingPayerHash,
  getAccount,
  getPaypalPurchase,
  getReferralRelationshipByReferee,
  getReferralSignup,
  isDisposableEmailAddress,
  listReferralEvidence,
  loadReferralConfig,
  upsertReferralEvidence,
} from "../db.js";

function parseRelated(raw) {
  try {
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}

async function relatedInSameReferrerTree(relationship, otherAccountIds) {
  if (!relationship) return [];
  const referrerId = Number(relationship.referrer_account_id);
  const related = [];
  for (const oid of otherAccountIds) {
    const id = Number(oid);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (id === referrerId) {
      related.push(id);
      continue;
    }
    const otherRel = await getReferralRelationshipByReferee(id);
    if (otherRel && Number(otherRel.referrer_account_id) === referrerId) {
      related.push(id);
    }
  }
  return related;
}

/**
 * Gather and persist evidence for a referred account, then return score + class.
 */
export async function recalculateReferralRisk(refereeAccountId, opts = {}) {
  const accountId = Number(refereeAccountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { score: 0, class: "normal", signals: [] };
  }
  const config = opts.config || await loadReferralConfig();
  const account = opts.account || await getAccount(accountId);
  const relationship = opts.relationship || await getReferralRelationshipByReferee(accountId);
  const signupRow = opts.signup || await getReferralSignup(accountId);
  const browserId = opts.browserId || signupRow?.browser_id || null;
  const ip = opts.ip || signupRow?.ip || null;
  const network = opts.network || signupRow?.network || networkKeyFromIp(ip);

  if (browserId && relationship) {
    const others = await findAccountsSharingBrowser(browserId, accountId);
    const related = await relatedInSameReferrerTree(
      relationship,
      others.map((r) => r.account_id),
    );
    if (related.length) {
      await upsertReferralEvidence(accountId, "shared_browser", related, config.riskSharedBrowser);
    } else {
      await clearReferralEvidenceSignal(accountId, "shared_browser");
    }
  }

  const since = Date.now() - config.rapidWindowMs;
  const counts = await countRecentReferralSignups({
    browserId,
    ip,
    network,
    sinceMs: since,
  });
  const rapid = counts.browser > config.rapidBrowserMax
    || counts.ip > config.rapidIpMax
    || counts.network > config.rapidNetworkMax;
  if (rapid) {
    await upsertReferralEvidence(accountId, "rapid_signup", [], config.riskRapidSignup);
  }
  // rapid_signup evidence is kept after the window expires.

  let payerHash = opts.payerHash || null;
  if (!payerHash && relationship?.qualifying_purchase_id) {
    const purchase = await getPaypalPurchase(relationship.qualifying_purchase_id);
    payerHash = purchase?.payer_hash || null;
  }
  if (payerHash && relationship) {
    const shared = await findAccountsSharingPayerHash(payerHash, accountId);
    const related = await relatedInSameReferrerTree(
      relationship,
      shared.map((r) => r.account_id),
    );
    if (related.length) {
      await upsertReferralEvidence(accountId, "shared_payer", related, config.riskSharedPayer);
    }
  }

  if (account?.email && isDisposableEmailAddress(account.email, config.disposableDomains)) {
    await upsertReferralEvidence(accountId, "disposable_email", [], config.riskDisposableEmail);
  } else {
    await clearReferralEvidenceSignal(accountId, "disposable_email");
  }

  const stored = await listReferralEvidence(accountId);
  const weightFor = {
    shared_browser: config.riskSharedBrowser,
    rapid_signup: config.riskRapidSignup,
    shared_payer: config.riskSharedPayer,
    disposable_email: config.riskDisposableEmail,
  };
  let score = 0;
  const applied = [];
  const seen = new Set();
  for (const row of stored) {
    if (!RISK_SIGNALS.includes(row.signal) || seen.has(row.signal)) continue;
    seen.add(row.signal);
    const pts = weightFor[row.signal] ?? (Number(row.score) || 0);
    score += pts;
    applied.push({
      signal: row.signal,
      score: pts,
      related: parseRelated(row.related_account_ids),
    });
  }
  return {
    score,
    class: classifyRiskScore(score, config.riskElevatedMin, config.riskHighMin),
    signals: applied,
  };
}

export async function applyRiskToPendingRewards(relationshipId, risk, config = null) {
  const {
    listReferralRewardsForRelationship,
    updateReferralRewardRisk,
    loadReferralConfig: loadCfg,
  } = await import("../db.js");
  const cfg = config || await loadCfg();
  const rewards = await listReferralRewardsForRelationship(relationshipId);
  const dayMs = 24 * 60 * 60 * 1000;
  const results = [];
  for (const reward of rewards) {
    if (!["pending", "extended", "review"].includes(reward.status)) continue;
    const milestoneAt = Number(reward.created_at) || Date.now();
    let status = reward.status;
    let releaseAt = reward.release_at;
    if (risk.class === "high") {
      status = "review";
      releaseAt = null;
    } else if (risk.class === "elevated") {
      status = "extended";
      releaseAt = milestoneAt + cfg.elevatedHoldDays * dayMs;
    } else if (reward.role === "referrer") {
      status = "pending";
      const standard = milestoneAt + cfg.holdDays * dayMs;
      releaseAt = standard;
    } else {
      status = "pending";
      releaseAt = Number(reward.release_at) || Date.now();
    }
    await updateReferralRewardRisk(reward.id, {
      riskScore: risk.score,
      riskClass: risk.class,
      status,
      releaseAt,
    });
    results.push({ id: reward.id, status, releaseAt });
  }
  return results;
}
