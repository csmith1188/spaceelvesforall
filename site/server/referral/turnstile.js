/**
 * Optional Cloudflare Turnstile verification.
 * Disabled when TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY are unset.
 */

import { createHash } from "crypto";
import { asErr, logger } from "../logger.js";
import {
  captchaTokenHashSeen,
  storeCaptchaClearance,
} from "../db.js";

export function turnstileConfigured() {
  return Boolean(
    process.env.TURNSTILE_SITE_KEY
    && process.env.TURNSTILE_SECRET_KEY,
  );
}

export function turnstileSiteKey() {
  return process.env.TURNSTILE_SITE_KEY || null;
}

export function hashTurnstileToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

/**
 * Verify a Turnstile token with Cloudflare and store a short-lived clearance.
 * Returns { ok, error? }.
 */
export async function verifyTurnstileToken(token, {
  browserId = null,
  ip = null,
  fetchImpl = fetch,
} = {}) {
  if (!turnstileConfigured()) {
    return { ok: false, error: "not_configured" };
  }
  const response = String(token || "").trim();
  if (!response) return { ok: false, error: "missing_token" };

  const tokenHash = hashTurnstileToken(response);
  if (await captchaTokenHashSeen(tokenHash)) {
    return { ok: false, error: "token_reuse" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", process.env.TURNSTILE_SECRET_KEY);
    body.set("response", response);
    if (ip) body.set("remoteip", String(ip));

    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => null);
    if (!data || data.success !== true) {
      logger.info({
        event: "signup_captcha_failed",
        codes: data && data["error-codes"],
      }, "turnstile verification failed");
      return { ok: false, error: "verification_failed" };
    }

    const stored = await storeCaptchaClearance({
      tokenHash,
      browserId,
      ip,
      ttlMs: 10 * 60 * 1000,
    });
    if (!stored) return { ok: false, error: "token_reuse" };
    return { ok: true };
  } catch (err) {
    logger.warn({ event: "signup_captcha_error", err: asErr(err) }, "turnstile request failed");
    return { ok: false, error: "upstream_error" };
  }
}
