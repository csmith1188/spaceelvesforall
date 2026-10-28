/**
 * Temporary IP throttle backed by SQLite (shared across workers).
 * Never bans accounts; never permanent.
 * Throttle rejects aggregate into hit counters + periodic summary events.
 */

import {
  bumpSecurityIpHourly,
  clearExpiredSecurityThrottles,
  deleteSecurityIpThrottle,
  getSecurityIpThrottle,
  recordSecurityIpThrottleHit,
  upsertSecurityIpThrottle,
} from "../db.js";
import { logger, safeLog } from "../logger.js";
import { isLoopbackIp, normalizeIp } from "./context.js";
import { securityLimits } from "./limits.js";
import { recordSecurityEvent } from "./record.js";

/**
 * @returns {Promise<{ blocked: boolean, untilMs?: number, reason?: string, strikes?: number }>}
 */
export async function checkIpThrottle(ipRaw, now = Date.now()) {
  const ip = normalizeIp(ipRaw);
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return { blocked: false };
  const row = await getSecurityIpThrottle(ip);
  if (!row) return { blocked: false };
  if (Number(row.until_ms) <= now) {
    await clearExpiredSecurityThrottles(now).catch(() => {});
    return { blocked: false };
  }
  return {
    blocked: true,
    untilMs: Number(row.until_ms),
    reason: row.reason || null,
    strikes: Number(row.strikes) || 0,
  };
}

/**
 * Escalate temporary throttle for an IP.
 * @param {string} ipRaw
 * @param {string} reason
 */
export async function escalateIpThrottle(ipRaw, reason, now = Date.now()) {
  const ip = normalizeIp(ipRaw);
  if (!ip || ip === "unknown" || isLoopbackIp(ip)) return null;
  const L = securityLimits();
  const prev = await getSecurityIpThrottle(ip);
  const strikes = (prev && Number(prev.until_ms) > now - L.throttleMaxMs)
    ? (Number(prev.strikes) || 0) + 1
    : 1;
  const stepIdx = Math.min(strikes - 1, L.throttleStepsMs.length - 1);
  let duration = L.throttleStepsMs[stepIdx] || L.throttleStepsMs[0];
  duration = Math.min(duration, L.throttleMaxMs);
  const untilMs = now + duration;
  await upsertSecurityIpThrottle({
    ip,
    untilMs,
    reason: String(reason || "abuse").slice(0, 80),
    strikes,
  });
  return { ip, untilMs, reason, strikes, durationMs: duration };
}

/**
 * Record a rejected request while an IP is throttled.
 * Always bumps hourly counters; persists/warn-logs only on summary cadence.
 */
export async function noteIpThrottleHit(opts = {}) {
  const ip = normalizeIp(opts.ip);
  if (!ip || ip === "unknown") return null;
  const L = securityLimits();
  const path = String(opts.path || "/");
  let agg = null;
  try {
    agg = await recordSecurityIpThrottleHit({
      ip,
      path,
      now: opts.now != null ? Number(opts.now) : Date.now(),
      summaryMs: L.throttleSummaryMs,
      summaryEvery: L.throttleSummaryEvery,
      pathTopN: L.throttlePathTopN,
    });
  } catch {
    agg = null;
  }
  bumpSecurityIpHourly(ip, "throttle").catch(() => {});

  const reason = (agg && agg.reason) || opts.reason || null;
  const untilMs = (agg && agg.untilMs) || opts.untilMs || null;
  const strikes = (agg && agg.strikes) || opts.strikes || 0;

  if (agg && agg.shouldSummary) {
    recordSecurityEvent({
      req: opts.req,
      ip,
      method: opts.method || (opts.req && opts.req.method) || "GET",
      path,
      event: "ip_throttled",
      class: "throttle",
      status: 429,
      message: agg.hitCount === 1
        ? "IP temporarily throttled"
        : "IP throttle summary (aggregated rejects)",
      // Hourly already bumped above; avoid double-count on summary rows.
      persist: true,
      meta: {
        reason,
        untilMs,
        strikes,
        suppressed: agg.suppressed,
        hitCount: agg.hitCount,
        firstAt: agg.firstAt,
        lastAt: agg.lastAt,
        topPaths: agg.topPaths,
        skipHourlyBump: true,
      },
    });
  } else {
    safeLog(logger, "debug", {
      event: "ip_throttled",
      class: "throttle",
      ip,
      path,
      reason,
      untilMs,
      strikes,
      hitCount: agg ? agg.hitCount : undefined,
    }, "IP throttle reject (aggregated)");
  }
  return agg;
}

/** Test helper: clear throttle for an IP. */
export async function clearIpThrottle(ipRaw) {
  const ip = normalizeIp(ipRaw);
  if (!ip) return;
  await deleteSecurityIpThrottle(ip);
}
