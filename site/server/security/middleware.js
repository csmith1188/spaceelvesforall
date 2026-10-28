/**
 * Express middleware: request IDs, IP throttle, light traffic observation.
 * Does not attach to Socket.IO. Static assets are mounted before this in app.js
 * (except sensitive-path deny, which runs before static).
 */

import { rateLimit } from "../auth.js";
import { newRequestId, normalizeIp, requestSecurityContext } from "./context.js";
import { classifyNotFound, shouldEscalateScanner } from "./classify.js";
import { securityLimits } from "./limits.js";
import { isProbePath } from "./probes.js";
import { recordSecurityEvent } from "./record.js";
import { checkIpThrottle, escalateIpThrottle, noteIpThrottleHit } from "./throttle.js";
import { observeTraffic } from "./trafficWatch.js";

export function requestIdMiddleware(req, res, next) {
  const incoming = String(req.get("x-request-id") || "").trim();
  req.requestId = /^[a-f0-9]{8,32}$/i.test(incoming) ? incoming.toLowerCase() : newRequestId();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

/**
 * Early throttle check (after session/CSRF so POSTs still validate CSRF first).
 * Place after requireCsrf.
 */
export async function ipThrottleMiddleware(req, res, next) {
  try {
    const path = String(req.path || "");
    if (path.startsWith("/socket.io")) {
      next();
      return;
    }
    const ip = normalizeIp(requestSecurityContext(req).ip);
    const state = await checkIpThrottle(ip);
    if (!state.blocked) {
      next();
      return;
    }
    noteIpThrottleHit({
      req,
      ip,
      path,
      method: req.method,
      reason: state.reason,
      untilMs: state.untilMs,
      strikes: state.strikes,
    }).catch(() => {});
    const retryAfter = Math.max(1, Math.ceil((state.untilMs - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    if (path.startsWith("/api/")) {
      res.status(429).json({ error: "rate_limited" });
      return;
    }
    res.status(429).type("text").send("Too many requests. Try again shortly.");
  } catch {
    next();
  }
}

function engageScannerThrottle(req, ip, watch) {
  const L = securityLimits();
  const snap = {
    ...watch,
    probeEscalateHits: L.probeEscalateHits,
  };
  if (!shouldEscalateScanner(snap)) return;
  escalateIpThrottle(ip, "scanner_probe").then((t) => {
    if (t) {
      recordSecurityEvent({
        req,
        event: "throttle_engaged",
        class: "throttle",
        status: 429,
        message: "Throttle engaged for scanner activity",
        meta: { untilMs: t.untilMs, strikes: t.strikes, reason: t.reason },
      });
    }
  }).catch(() => {});
}

/**
 * Observe traffic for heuristics; classify probe 404s at end of request.
 * Does not persist ordinary successes.
 */
export function trafficObserveMiddleware(req, res, next) {
  const path = String(req.path || "");
  if (path.startsWith("/socket.io") || path.startsWith("/bgm/") || path.startsWith("/css/")
    || path.startsWith("/js/") || path.startsWith("/img/") || path.startsWith("/shared/")
    || path.startsWith("/vendor/")) {
    next();
    return;
  }

  const started = Date.now();
  res.on("finish", () => {
    const status = res.statusCode;
    const ctx = requestSecurityContext(req, { status });
    const watch = observeTraffic(ctx.ip, { path, status, kind: "response" });
    if (status === 404) {
      const cls = classifyNotFound({
        ...watch,
        probe: watch.probe || isProbePath(path),
      });
      if (cls === "scanner_probe") {
        recordSecurityEvent({
          req,
          event: "scanner_probe",
          class: "scanner_probe",
          status: 404,
          message: "Suspected scanner probe",
          meta: {
            pathDiversity: watch.pathDiversity,
            probeHits: watch.probeHits,
            highRps: watch.highRps,
            elapsedMs: Date.now() - started,
          },
        });
        engageScannerThrottle(req, ctx.ip, {
          ...watch,
          probe: watch.probe || isProbePath(path),
        });
      }
    }
    // Note: loopback IPs never escalate (see escalateIpThrottle).
  });
  next();
}

/** Soft rate limit for unauthenticated public API bursts. */
export function apiPublicRateLimit(req, res, next) {
  const path = String(req.path || "");
  if (!path.startsWith("/api/v1")) {
    next();
    return;
  }
  // Authenticated sessions get a pass on this soft bucket
  if (req.session && (req.session.accountId || req.session.guestId || req.session.userId)) {
    next();
    return;
  }
  const L = securityLimits();
  const ip = normalizeIp(requestSecurityContext(req).ip);
  const ok = rateLimit(`api-public:${ip}`, {
    max: L.apiPublicMax,
    windowMs: L.apiPublicWindowMs,
  });
  if (ok) {
    next();
    return;
  }
  recordSecurityEvent({
    req,
    event: "rate_limited",
    class: "rate_limited",
    status: 429,
    message: "Public API rate limited",
    meta: { bucket: "api-public" },
  });
  res.setHeader("Retry-After", "60");
  res.status(429).json({ error: "rate_limited" });
}
