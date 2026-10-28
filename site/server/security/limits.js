/**
 * Central security / rate-limit thresholds (env with documented defaults).
 */

import { positiveEnv } from "../hardening.js";

function envInt(name, fallback) {
  return positiveEnv(process.env, name, fallback);
}

function envBool(name, fallback = false) {
  const raw = String(process.env[name] || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return fallback;
}

/** Snapshot of limits; re-read on each call so tests can mutate env. */
export function securityLimits() {
  return {
    loginMax: envInt("RATE_LOGIN_MAX", 20),
    loginWindowMs: envInt("RATE_LOGIN_WINDOW_MS", 15 * 60 * 1000),
    signupMax: envInt("RATE_SIGNUP_MAX", 10),
    signupWindowMs: envInt("RATE_SIGNUP_WINDOW_MS", 15 * 60 * 1000),
    forgotMax: envInt("RATE_FORGOT_MAX", 5),
    forgotWindowMs: envInt("RATE_FORGOT_WINDOW_MS", 15 * 60 * 1000),
    resendMax: envInt("RATE_RESEND_MAX", 5),
    resendWindowMs: envInt("RATE_RESEND_WINDOW_MS", 15 * 60 * 1000),
    guestMax: envInt("RATE_GUEST_MAX", 10),
    guestWindowMs: envInt("RATE_GUEST_WINDOW_MS", 10 * 60 * 1000),
    playMax: envInt("RATE_PLAY_MAX", 30),
    ticketMax: envInt("RATE_TICKET_MAX", 6),
    suggestMax: envInt("RATE_SUGGEST_MAX", 10),
    suggestWindowMs: envInt("RATE_SUGGEST_WINDOW_MS", 10 * 60 * 1000),
    wikiMax: envInt("RATE_WIKI_MAX", 10),
    adminMax: envInt("RATE_ADMIN_MAX", 60),
    lobbyMax: envInt("RATE_LOBBY_MAX", 10),
    /** Unauthenticated /api/v1 burst per IP (generous for menus). */
    apiPublicMax: envInt("RATE_API_PUBLIC_MAX", 120),
    apiPublicWindowMs: envInt("RATE_API_PUBLIC_WINDOW_MS", 60 * 1000),
    /** CSRF failures per IP before escalating throttle. */
    csrfFailMax: envInt("SECURITY_CSRF_FAIL_MAX", 8),
    csrfFailWindowMs: envInt("SECURITY_CSRF_FAIL_WINDOW_MS", 15 * 60 * 1000),
    /** Auth failures per IP toward brute_force classification. */
    authFailMax: envInt("SECURITY_AUTH_FAIL_MAX", 12),
    authFailWindowMs: envInt("SECURITY_AUTH_FAIL_WINDOW_MS", 15 * 60 * 1000),
    /** Distinct unknown path prefixes in window → scanner classification. */
    scannerPathDiversity: envInt("SECURITY_SCANNER_PATH_DIVERSITY", 15),
    scannerWindowMs: envInt("SECURITY_SCANNER_WINDOW_MS", 60 * 1000),
    /** Known probe-path hits before temporary IP throttle escalate. */
    probeEscalateHits: envInt("SECURITY_PROBE_ESCALATE_HITS", 3),
    /** High RPS from one IP (non-socket); classification noise only — does not escalate alone. */
    highRpsMax: envInt("SECURITY_HIGH_RPS_MAX", 80),
    highRpsWindowMs: envInt("SECURITY_HIGH_RPS_WINDOW_MS", 10 * 1000),
    /** Escalating throttle durations (ms). */
    throttleStepsMs: [
      envInt("SECURITY_THROTTLE_STEP1_MS", 60 * 1000),
      envInt("SECURITY_THROTTLE_STEP2_MS", 5 * 60 * 1000),
      envInt("SECURITY_THROTTLE_STEP3_MS", 15 * 60 * 1000),
    ],
    throttleMaxMs: envInt("SECURITY_THROTTLE_MAX_MS", 60 * 60 * 1000),
    /** Aggregate ip_throttled security_events (counts still bump hourly every hit). */
    throttleSummaryMs: envInt("SECURITY_THROTTLE_SUMMARY_MS", 60 * 1000),
    throttleSummaryEvery: envInt("SECURITY_THROTTLE_SUMMARY_EVERY", 50),
    throttlePathTopN: envInt("SECURITY_THROTTLE_PATH_TOP_N", 20),
    watchMaxIps: envInt("SECURITY_WATCH_MAX_IPS", 5000),
    eventRetainDays: envInt("SECURITY_EVENT_RETAIN_DAYS", 365),
    loginEventRetainDays: envInt("LOGIN_EVENT_RETAIN_DAYS", 365),
    scannerSampleEvery: envInt("SECURITY_SCANNER_SAMPLE_EVERY", 20),
    simulateEnabled: envBool("SECURITY_SIMULATE", false)
      && process.env.NODE_ENV !== "production",
  };
}

export default securityLimits;
