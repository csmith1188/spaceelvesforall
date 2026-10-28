/**
 * Single entry point for security events: Pino + optional SQLite persist.
 */

import { bumpSecurityIpHourly, writeSecurityEvent } from "../db.js";
import { createSampler, logger, safeLog } from "../logger.js";
import { severityForClass, shouldPersistClass } from "./classify.js";
import { requestSecurityContext } from "./context.js";
import { securityLimits } from "./limits.js";

const scannerSamplers = new Map();

function samplerFor(ip) {
  const key = String(ip || "unknown");
  let s = scannerSamplers.get(key);
  if (!s) {
    s = createSampler(securityLimits().scannerSampleEvery);
    scannerSamplers.set(key, s);
    if (scannerSamplers.size > 2000) {
      const first = scannerSamplers.keys().next().value;
      scannerSamplers.delete(first);
    }
  }
  return s;
}

/**
 * @param {object} opts
 * @param {import("express").Request} [opts.req]
 * @param {string} opts.event
 * @param {string} opts.class
 * @param {string} [opts.level]
 * @param {string} [opts.message]
 * @param {number} [opts.status]
 * @param {object} [opts.meta]
 * @param {boolean} [opts.persist] force persist / skip
 * @param {number|null} [opts.accountId]
 */
export function recordSecurityEvent(opts = {}) {
  const cls = String(opts.class || "ordinary");
  const event = String(opts.event || "security");
  const ctx = opts.req
    ? requestSecurityContext(opts.req, {
      status: opts.status,
      accountId: opts.accountId,
    })
    : {
      requestId: opts.requestId || null,
      ip: opts.ip || "unknown",
      method: opts.method || null,
      path: opts.path || null,
      status: opts.status != null ? opts.status : null,
      accountId: opts.accountId != null ? opts.accountId : null,
      userAgent: opts.userAgent || null,
      host: null,
      origin: null,
      referer: null,
      secure: null,
      sessionExists: null,
      sessionCookiePresent: null,
      authenticated: null,
      guestIdentity: null,
      anonymousSession: null,
    };

  const severity = opts.severity || severityForClass(cls);
  const level = opts.level || (severity === "error" ? "error" : severity === "info" ? "info" : "warn");
  const persist = opts.persist != null ? Boolean(opts.persist) : shouldPersistClass(cls);

  // Sample repeated scanner hits from the same IP
  if (cls === "scanner_probe" && persist && !samplerFor(ctx.ip)()) {
    return { skipped: true, sampled: true };
  }

  const meta = { ...(opts.meta || {}) };
  const skipHourlyBump = Boolean(meta.skipHourlyBump || opts.bumpHourly === false);
  delete meta.skipHourlyBump;
  if (ctx.sessionExists != null && meta.sessionExists === undefined) {
    meta.sessionExists = ctx.sessionExists;
  }
  if (ctx.sessionCookiePresent != null && meta.sessionCookiePresent === undefined) {
    meta.sessionCookiePresent = ctx.sessionCookiePresent;
  }
  if (ctx.authenticated != null && meta.authenticated === undefined) {
    meta.authenticated = ctx.authenticated;
  }
  if (ctx.guestIdentity != null && meta.guestIdentity === undefined) {
    meta.guestIdentity = ctx.guestIdentity;
  }
  if (ctx.anonymousSession != null && meta.anonymousSession === undefined) {
    meta.anonymousSession = ctx.anonymousSession;
  }
  if (ctx.origin && meta.origin === undefined) meta.origin = ctx.origin;
  if (ctx.referer && meta.referer === undefined) meta.referer = ctx.referer;
  if (ctx.host && meta.host === undefined) meta.host = ctx.host;
  if (ctx.secure != null && meta.secure === undefined) meta.secure = ctx.secure;

  const logObj = {
    event,
    class: cls,
    severity,
    ip: ctx.ip,
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    accountId: ctx.accountId || undefined,
    requestId: ctx.requestId || undefined,
    ...Object.fromEntries(
      Object.entries(meta).filter(([k]) => !["password", "token", "_csrf", "authorization", "cookie"].includes(k)),
    ),
  };

  safeLog(logger, level, logObj, opts.message || event);

  if (!persist) return { skipped: false, persisted: false };

  writeSecurityEvent({
    level,
    event,
    class: cls,
    severity,
    ip: ctx.ip,
    method: ctx.method,
    path: ctx.path,
    status: ctx.status,
    accountId: ctx.accountId,
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    message: opts.message || null,
    meta: Object.keys(meta).length ? meta : null,
  }).catch(() => {});

  if (!skipHourlyBump) {
    bumpSecurityIpHourly(ctx.ip, cls).catch(() => {});
  }

  return { skipped: false, persisted: true };
}

/** Clear scanner samplers (tests). */
export function clearSecuritySamplers() {
  scannerSamplers.clear();
}
