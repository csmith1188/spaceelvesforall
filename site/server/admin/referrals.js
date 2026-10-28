/**
 * Admin referral dashboard data helpers.
 */

import {
  adminCorrectReferralAttribution,
  adminReferralDetail,
  creditAndReleaseReferralReward,
  getReferralReward,
  loadReferralConfig,
  referralStats,
  rejectReferralReward,
  searchReferralRelationships,
  setReferralVanityCode,
  setSiteSetting,
  updateReferralRewardRisk,
} from "../db.js";
import { REFERRAL_SETTINGS } from "../referral/config.js";
import { recalculateReferralRisk, applyRiskToPendingRewards } from "../referral/risk.js";

export async function referralsAdminIndex({ q = "", status = "", page = 1 } = {}) {
  const stats = await referralStats();
  const search = await searchReferralRelationships({ q, status, page, pageSize: 25 });
  const config = await loadReferralConfig();
  return { stats, search, config };
}

export async function referralsAdminDetail(relationshipId) {
  return adminReferralDetail(relationshipId);
}

export async function adminApproveReferralReward(rewardId) {
  return creditAndReleaseReferralReward(rewardId);
}

export async function adminRejectReferralReward(rewardId, reason) {
  return rejectReferralReward(rewardId, reason);
}

export async function adminExtendReferralReward(rewardId, releaseAt) {
  const reward = await getReferralReward(rewardId);
  if (!reward) return { ok: false, error: "not_found" };
  if (!["pending", "extended", "review"].includes(reward.status)) {
    return { ok: false, error: "bad_status" };
  }
  const ok = await updateReferralRewardRisk(rewardId, {
    riskScore: reward.risk_score,
    riskClass: reward.risk_class,
    status: reward.status === "review" ? "extended" : reward.status,
    releaseAt: Number(releaseAt),
  });
  return { ok, reward: await getReferralReward(rewardId) };
}

export async function adminRecalculateReferralRisk(relationshipId) {
  const detail = await adminReferralDetail(relationshipId);
  if (!detail) return { ok: false, error: "not_found" };
  const risk = await recalculateReferralRisk(detail.relationship.referee_account_id, {
    relationship: detail.relationship,
    account: detail.referee,
  });
  await applyRiskToPendingRewards(detail.relationship.id, risk);
  return { ok: true, risk };
}

export async function adminSetReferralConfig(values, updatedBy) {
  const map = {
    enabled: REFERRAL_SETTINGS.enabled,
    verifyTickets: REFERRAL_SETTINGS.verifyTickets,
    purchaseTickets: REFERRAL_SETTINGS.purchaseTickets,
    minPurchaseCents: REFERRAL_SETTINGS.minPurchaseCents,
    holdDays: REFERRAL_SETTINGS.holdDays,
    elevatedHoldDays: REFERRAL_SETTINGS.elevatedHoldDays,
    riskSharedBrowser: REFERRAL_SETTINGS.riskSharedBrowser,
    riskRapidSignup: REFERRAL_SETTINGS.riskRapidSignup,
    riskSharedPayer: REFERRAL_SETTINGS.riskSharedPayer,
    riskDisposableEmail: REFERRAL_SETTINGS.riskDisposableEmail,
    riskElevatedMin: REFERRAL_SETTINGS.riskElevatedMin,
    riskHighMin: REFERRAL_SETTINGS.riskHighMin,
    rapidWindowMs: REFERRAL_SETTINGS.rapidWindowMs,
    rapidBrowserMax: REFERRAL_SETTINGS.rapidBrowserMax,
    rapidIpMax: REFERRAL_SETTINGS.rapidIpMax,
    rapidNetworkMax: REFERRAL_SETTINGS.rapidNetworkMax,
    signupCooldownMs: REFERRAL_SETTINGS.signupCooldownMs,
    signupCaptchaAfter: REFERRAL_SETTINGS.signupCaptchaAfter,
    signupRestrictAfter: REFERRAL_SETTINGS.signupRestrictAfter,
    signupRestrictMs: REFERRAL_SETTINGS.signupRestrictMs,
    disposableDomains: REFERRAL_SETTINGS.disposableDomains,
  };
  const before = await loadReferralConfig();
  for (const [field, key] of Object.entries(map)) {
    if (values[field] === undefined) continue;
    await setSiteSetting(key, values[field], updatedBy);
  }
  const after = await loadReferralConfig();
  return { ok: true, before, after };
}

export {
  adminCorrectReferralAttribution,
  setReferralVanityCode,
};
