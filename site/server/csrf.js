import { randomBytes, timingSafeEqual } from "crypto";
import {
  classifyCsrf,
  escalateIpThrottle,
  observeTraffic,
  recordSecurityEvent,
  requestSecurityContext,
  sessionCookiePresent,
} from "./security/index.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(sent, expected) {
  const left = Buffer.from(String(sent || ""));
  const right = Buffer.from(String(expected || ""));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Issue a session token and expose it to EJS. */
export function ensureCsrf(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    const path = String(req.path || "");
    const isApi = path === "/api/v1" || path.startsWith("/api/v1/");
    // Do not mint CSRF on a brand-new API session: with saveUninitialized:false
    // that persists an empty elves.sid and can clobber a real login cookie.
    const hasIdentity = Boolean(
      req.session.accountId
      || req.session.guestId
      || req.session.userId
      || req.session.formbarId,
    );
    if (!isApi || hasIdentity) {
      req.session.csrfToken = randomBytes(32).toString("base64url");
    }
  }
  res.locals.csrfToken = (req.session && req.session.csrfToken) || "";
  next();
}

/**
 * Browser form POSTs must echo the session token (body or X-CSRF-Token).
 * Native /api/v1 calls use a bearer session id and are exempt.
 * PayPal webhooks use signature verification instead of CSRF.
 */
export function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const path = String(req.path || "");
  if (path === "/api/v1" || path.startsWith("/api/v1/")) {
    next();
    return;
  }
  if (path === "/webhooks/paypal") {
    next();
    return;
  }
  // One-click List-Unsubscribe POST has no session CSRF token.
  if (path === "/unsubscribe/news") {
    next();
    return;
  }
  const expected = req.session && req.session.csrfToken;
  const sent = (req.body && req.body._csrf)
    || req.get("x-csrf-token")
    || req.get("X-CSRF-Token");
  if (!tokensMatch(sent, expected)) {
    const ctx = requestSecurityContext(req, { status: 403 });
    const watch = observeTraffic(ctx.ip, { path, status: 403, kind: "csrf_fail" });
    const cls = classifyCsrf({
      authenticated: ctx.authenticated,
      guestIdentity: ctx.guestIdentity,
      sessionExists: ctx.sessionExists,
      sessionCookiePresent: sessionCookiePresent(req),
      path,
    }, watch);
    const hasIdentity = Boolean(ctx.authenticated || ctx.guestIdentity);
    recordSecurityEvent({
      req,
      event: "csrf_failed",
      class: cls,
      status: 403,
      message: "CSRF token mismatch",
      meta: {
        sessionExists: ctx.sessionExists,
        authenticated: ctx.authenticated,
        guestIdentity: ctx.guestIdentity,
        anonymousSession: ctx.anonymousSession,
        sessionCookiePresent: sessionCookiePresent(req),
        csrfTokenPresent: Boolean(sent),
        origin: ctx.origin,
        referer: ctx.referer,
        secure: ctx.secure,
        host: ctx.host,
        csrfFails: watch.csrfFails,
      },
    });
    // Escalate scanners / anonymous CSRF floods; do not treat csrfToken-only sessions as identity.
    if (cls === "scanner_probe" || (watch.csrfFails >= watch.csrfFailMax && !hasIdentity)) {
      escalateIpThrottle(ctx.ip, "csrf_fail").then((t) => {
        if (t) {
          recordSecurityEvent({
            req,
            event: "throttle_engaged",
            class: "throttle",
            status: 429,
            message: "Throttle engaged after CSRF failures",
            meta: { untilMs: t.untilMs, strikes: t.strikes, reason: t.reason },
          });
        }
      }).catch(() => {});
    }
    const err = new Error("Invalid form token. Reload the page and try again.");
    err.status = 403;
    err.code = "csrf_failed";
    err.securityLogged = true;
    next(err);
    return;
  }
  next();
}
