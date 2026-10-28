/**
 * Referral program defaults and site_settings keys.
 * Env REFERRALS_ENABLED=0 is a hard kill switch over the admin flag.
 */

function envFlag(name, defaultOn = true) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultOn;
  const text = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return defaultOn;
}

export const REFERRAL_SETTINGS = Object.freeze({
  enabled: "referral_enabled",
  verifyTickets: "referral_verify_tickets",
  purchaseTickets: "referral_purchase_tickets",
  minPurchaseCents: "referral_min_purchase_cents",
  holdDays: "referral_hold_days",
  elevatedHoldDays: "referral_elevated_hold_days",
  riskSharedBrowser: "referral_risk_shared_browser",
  riskRapidSignup: "referral_risk_rapid_signup",
  riskSharedPayer: "referral_risk_shared_payer",
  riskDisposableEmail: "referral_risk_disposable_email",
  riskElevatedMin: "referral_risk_elevated_min",
  riskHighMin: "referral_risk_high_min",
  rapidWindowMs: "referral_rapid_window_ms",
  rapidBrowserMax: "referral_rapid_browser_max",
  rapidIpMax: "referral_rapid_ip_max",
  rapidNetworkMax: "referral_rapid_network_max",
  signupCooldownMs: "referral_signup_cooldown_ms",
  signupCaptchaAfter: "referral_signup_captcha_after",
  signupRestrictAfter: "referral_signup_restrict_after",
  signupRestrictMs: "referral_signup_restrict_ms",
  disposableDomains: "referral_disposable_domains",
  payerHmacKey: "referral_payer_hmac_key",
});

export const REFERRAL_DEFAULTS = Object.freeze({
  enabled: true,
  verifyTickets: 5,
  purchaseTickets: 5,
  minPurchaseCents: 500,
  holdDays: 7,
  elevatedHoldDays: 14,
  riskSharedBrowser: 40,
  riskRapidSignup: 25,
  riskSharedPayer: 60,
  riskDisposableEmail: 10,
  riskElevatedMin: 30,
  riskHighMin: 60,
  rapidWindowMs: 15 * 60 * 1000,
  rapidBrowserMax: 3,
  rapidIpMax: 5,
  rapidNetworkMax: 8,
  signupCooldownMs: 30_000,
  signupCaptchaAfter: 4,
  signupRestrictAfter: 8,
  signupRestrictMs: 60 * 60 * 1000,
  disposableDomains: [
    "mailinator.com",
    "guerrillamail.com",
    "tempmail.com",
    "10minutemail.com",
    "yopmail.com",
    "trashmail.com",
    "discard.email",
    "temp-mail.org",
  ],
});

export const REFERRAL_COOKIE = "elves.ref";
export const BROWSER_ID_COOKIE = "elves.bid";
export const REFERRAL_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const BROWSER_ID_COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

export const REWARD_STATUSES = Object.freeze([
  "pending",
  "extended",
  "review",
  "released",
  "rejected",
  "reversed",
]);

export const MILESTONES = Object.freeze(["verify", "purchase"]);
export const REWARD_ROLES = Object.freeze(["referrer", "referee"]);

export const RISK_SIGNALS = Object.freeze([
  "shared_browser",
  "rapid_signup",
  "shared_payer",
  "disposable_email",
]);

/** Hard kill switch: REFERRALS_ENABLED=0 always disables. Default on. */
export function referralsEnvEnabled() {
  return envFlag("REFERRALS_ENABLED", true);
}

export function parseIntSetting(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

export function parseBoolSetting(raw, fallback = true) {
  if (raw == null || raw === "") return fallback;
  const text = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
}

export function parseDomainList(raw, fallback = []) {
  if (raw == null || raw === "") return fallback.slice();
  return String(raw)
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function classifyRiskScore(score, elevatedMin = 30, highMin = 60) {
  const n = Number(score) || 0;
  if (n >= highMin) return "high";
  if (n >= elevatedMin) return "elevated";
  return "normal";
}

export function rewardCopy() {
  return "Recruit a friend! They receive 5 tickets when they verify their account and another 5 on their first qualifying purchase. You receive 5 tickets for each milestone, subject to a short verification period.";
}
