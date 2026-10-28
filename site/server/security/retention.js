/**
 * Retention cleanup for security and login event tables.
 */

import {
  clearExpiredSecurityThrottles,
  purgeLoginEvents,
  purgeSecurityEvents,
} from "../db.js";
import { logger, safeLog } from "../logger.js";
import { securityLimits } from "./limits.js";

let lastPurgeAt = 0;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

export async function retainSecurityData({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastPurgeAt < PURGE_INTERVAL_MS) {
    return { skipped: true };
  }
  lastPurgeAt = now;
  const L = securityLimits();
  const security = await purgeSecurityEvents(L.eventRetainDays);
  const logins = await purgeLoginEvents(L.loginEventRetainDays);
  const throttles = await clearExpiredSecurityThrottles(now);
  safeLog(logger, "info", {
    event: "security_retention",
    securityEvents: security.events,
    securityHourly: security.hourly,
    loginEvents: logins,
    throttles,
    eventRetainDays: L.eventRetainDays,
    loginRetainDays: L.loginEventRetainDays,
  }, "security retention purge");
  return { skipped: false, security, logins, throttles };
}

/** Test helper. */
export function resetRetentionClock() {
  lastPurgeAt = 0;
}
