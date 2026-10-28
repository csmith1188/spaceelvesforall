/**
 * Build sanitized request context for security events.
 * Never include passwords, cookies, CSRF tokens, or Authorization headers.
 */

import { randomBytes } from "crypto";
import { requestClientIp } from "../hardening.js";

const UA_MAX = 200;
const PATH_MAX = 200;
const HOST_MAX = 120;
const ORIGIN_MAX = 200;

export function newRequestId() {
  return randomBytes(8).toString("hex");
}

export function normalizeIp(raw) {
  let ip = String(raw || "unknown").trim();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip.length > 80) ip = ip.slice(0, 80);
  return ip || "unknown";
}

/** Loopback addresses — never escalate temporary IP throttles (dev/tests). */
export function isLoopbackIp(ipRaw) {
  const ip = normalizeIp(ipRaw).toLowerCase();
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

function truncate(value, max) {
  const text = value == null ? "" : String(value);
  if (!text) return "";
  return text.length > max ? text.slice(0, max) : text;
}

function headerOrigin(req, name) {
  const raw = req.get?.(name) || req.headers?.[name.toLowerCase()] || "";
  const text = String(raw || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return truncate(url.origin + (url.pathname === "/" ? "" : url.pathname), ORIGIN_MAX);
  } catch {
    return truncate(text, ORIGIN_MAX);
  }
}

export function sessionCookiePresent(req) {
  const cookie = req.headers?.cookie || req.get?.("cookie") || "";
  return /(?:^|;\s*)elves\.sid=/.test(String(cookie));
}

function sessionHasIdentity(session) {
  if (!session) return false;
  return Boolean(session.accountId || session.guestId || session.userId || session.formbarId);
}

/**
 * @param {import("express").Request} req
 * @param {{ status?: number, accountId?: number|null }} [extra]
 */
export function requestSecurityContext(req, extra = {}) {
  const ip = normalizeIp(requestClientIp(req));
  const path = truncate(req.path || req.url || "/", PATH_MAX);
  const method = String(req.method || "GET").toUpperCase();
  const ua = truncate(req.get?.("user-agent") || req.headers?.["user-agent"] || "", UA_MAX);
  const host = truncate(req.get?.("host") || req.headers?.host || "", HOST_MAX);
  const secure = Boolean(req.secure)
    || String(req.get?.("x-forwarded-proto") || "").split(",")[0].trim() === "https";
  const accountId = extra.accountId != null
    ? Number(extra.accountId)
    : (req.session && req.session.accountId) || null;
  const authenticated = Number.isInteger(Number(accountId)) && Number(accountId) > 0;
  const guestIdentity = Boolean(
    req.session && (req.session.guestId || req.session.userId || req.session.formbarId)
    && !authenticated,
  );
  const cookiePresent = sessionCookiePresent(req);
  const hasCsrf = Boolean(req.session && req.session.csrfToken);
  // Session store entry or cookie-backed session (not "logged in").
  const sessionExists = Boolean(
    req.session && (cookiePresent || hasCsrf || sessionHasIdentity(req.session)),
  );
  // CSRF-minted (or guest) session without a logged-in account.
  const anonymousSession = Boolean(hasCsrf || guestIdentity) && !authenticated;
  return {
    requestId: req.requestId || null,
    ip,
    method,
    path,
    status: extra.status != null ? Number(extra.status) : null,
    accountId: authenticated ? Number(accountId) : null,
    userAgent: ua || null,
    host: host || null,
    origin: headerOrigin(req, "origin") || null,
    referer: headerOrigin(req, "referer") || null,
    secure,
    sessionExists,
    sessionCookiePresent: cookiePresent,
    authenticated,
    guestIdentity,
    anonymousSession,
  };
}
