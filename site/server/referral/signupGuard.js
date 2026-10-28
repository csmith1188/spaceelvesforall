/**
 * Adaptive signup abuse protection (separate from referral reward risk).
 * Keys by browser / IP / network — never by referral code.
 */

import { logger } from "../logger.js";
import {
  clearExpiredSignupSourceBlocks,
  consumeCaptchaClearance,
  countSignupAttempts,
  getSignupSourceBlock,
  loadReferralConfig,
  recordSignupAttempt,
  setSignupSourceBlock,
} from "../db.js";
import { networkKeyFromIp } from "./network.js";
import { turnstileConfigured, verifyTurnstileToken } from "./turnstile.js";

/**
 * Evaluate signup source posture.
 * @returns {{ allow: boolean, requireCaptcha: boolean, cooldownMs: number, restricted: boolean, reason?: string }}
 */
export async function evaluateSignupGuard({ browserId = null, ip = null } = {}) {
  const config = await loadReferralConfig();
  await clearExpiredSignupSourceBlocks().catch(() => {});
  const network = networkKeyFromIp(ip);
  const now = Date.now();

  for (const [type, key] of [
    ["browser", browserId],
    ["ip", ip],
    ["network", network],
  ]) {
    if (!key) continue;
    const block = await getSignupSourceBlock(type, key);
    if (block && Number(block.until_ms) > now) {
      return {
        allow: false,
        requireCaptcha: false,
        cooldownMs: Number(block.until_ms) - now,
        restricted: true,
        reason: "restricted",
      };
    }
  }

  const since = now - config.rapidWindowMs;
  const counts = await countSignupAttempts({
    browserId,
    ip,
    network,
    sinceMs: since,
  });
  const maxCount = Math.max(counts.browser, counts.ip, counts.network);

  if (maxCount >= config.signupRestrictAfter) {
    const until = now + config.signupRestrictMs;
    if (browserId) await setSignupSourceBlock("browser", browserId, until);
    if (ip) await setSignupSourceBlock("ip", String(ip).slice(0, 80), until);
    if (network) await setSignupSourceBlock("network", network, until);
    logger.info({
      event: "signup_rate_limited",
      stage: "restrict",
      counts,
    }, "signup source restricted");
    return {
      allow: false,
      requireCaptcha: false,
      cooldownMs: config.signupRestrictMs,
      restricted: true,
      reason: "restricted",
    };
  }

  if (maxCount >= config.signupCaptchaAfter) {
    logger.info({
      event: "signup_captcha_required",
      counts,
    }, "signup captcha required");
    return {
      allow: true,
      requireCaptcha: true,
      cooldownMs: 0,
      restricted: false,
      reason: "captcha",
    };
  }

  if (maxCount >= Math.max(1, config.signupCaptchaAfter - 1) && config.signupCooldownMs > 0) {
    return {
      allow: true,
      requireCaptcha: false,
      cooldownMs: config.signupCooldownMs,
      restricted: false,
      reason: "cooldown",
    };
  }

  return {
    allow: true,
    requireCaptcha: false,
    cooldownMs: 0,
    restricted: false,
  };
}

/**
 * Enforce guard for a signup or OAuth start. Optionally verify Turnstile token.
 */
export async function enforceSignupGuard({
  browserId = null,
  ip = null,
  turnstileToken = null,
  consumeClearance = false,
} = {}) {
  const posture = await evaluateSignupGuard({ browserId, ip });
  if (!posture.allow) {
    await recordSignupAttempt({ browserId, ip, outcome: "blocked" });
    return { ok: false, ...posture };
  }

  if (posture.requireCaptcha) {
    if (!turnstileConfigured()) {
      // Without Turnstile credentials, escalate to a temporary source restriction.
      const cfg = await loadReferralConfig();
      const until = Date.now() + cfg.signupRestrictMs;
      if (ip) await setSignupSourceBlock("ip", String(ip).slice(0, 80), until);
      await recordSignupAttempt({ browserId, ip, outcome: "blocked_no_captcha" });
      return {
        ok: false,
        allow: false,
        requireCaptcha: false,
        restricted: true,
        reason: "restricted",
        cooldownMs: cfg.signupRestrictMs,
      };
    }
    if (consumeClearance) {
      const cleared = await consumeCaptchaClearance({ browserId, ip });
      if (!cleared) {
        await recordSignupAttempt({ browserId, ip, outcome: "captcha_missing" });
        return { ok: false, ...posture, error: "captcha_required" };
      }
    } else {
      const verified = await verifyTurnstileToken(turnstileToken, { browserId, ip });
      if (!verified.ok) {
        await recordSignupAttempt({ browserId, ip, outcome: "captcha_failed" });
        return { ok: false, ...posture, error: verified.error || "captcha_failed" };
      }
      // Store clearance; consume on successful account create / OAuth complete.
    }
  }

  if (posture.cooldownMs > 0) {
    // Soft signal only — caller may delay UX; we still allow.
  }

  await recordSignupAttempt({ browserId, ip, outcome: "allowed" });
  return { ok: true, ...posture };
}
