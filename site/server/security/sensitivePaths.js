/**
 * Early deny for secret / sensitive paths before static mounts or session.
 * Defense-in-depth: never depend on throttle for safety.
 */

import { classifyNotFound, shouldEscalateScanner } from "./classify.js";
import { normalizeIp, requestSecurityContext } from "./context.js";
import { securityLimits } from "./limits.js";
import { isProbePath } from "./probes.js";
import { recordSecurityEvent } from "./record.js";
import { escalateIpThrottle } from "./throttle.js";
import { observeTraffic } from "./trafficWatch.js";

/** Exact path prefixes that must never be served. */
const SENSITIVE_PREFIXES = Object.freeze([
  "/.env",
  "/.git",
  "/.svn",
  "/.hg",
  "/.aws",
  "/.ssh",
  "/.docker",
  "/data/",
  "/backup",
  "/backups",
]);

const SENSITIVE_NAMES = Object.freeze([
  "/id_rsa",
  "/id_dsa",
  "/id_ecdsa",
  "/id_ed25519",
  "/credentials",
  "/secrets",
]);

const SENSITIVE_EXT = /\.(?:env|sqlite|sqlite3|db|pem|key|p12|pfx|bak|old|orig|sql\.gz|tar\.gz|dump)$/i;

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSensitivePath(pathname) {
  let path = String(pathname || "").split("?")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep raw
  }
  const lower = path.toLowerCase();
  if (!lower || lower === "/") return false;

  for (const prefix of SENSITIVE_PREFIXES) {
    if (prefix.endsWith("/")) {
      if (lower === prefix.slice(0, -1) || lower.startsWith(prefix)) return true;
    } else if (lower === prefix || lower.startsWith(`${prefix}/`) || lower.startsWith(`${prefix}.`)) {
      return true;
    }
  }

  // Nested .env / .git segments (e.g. /app/.env.local)
  if (/(?:^|\/)\.env(?:$|\.|\/)/i.test(lower)) return true;
  if (/(?:^|\/)\.git(?:$|\/)/i.test(lower)) return true;

  for (const name of SENSITIVE_NAMES) {
    if (lower === name || lower.endsWith(name) || lower.includes(`${name}.`)) return true;
  }

  if (SENSITIVE_EXT.test(lower)) return true;
  return false;
}

/**
 * Middleware: 404 with empty body, no session/CSRF. Logs sampled scanner_probe.
 * Place before express.static mounts.
 */
export function sensitivePathDenyMiddleware(req, res, next) {
  const path = String(req.path || "");
  if (!isSensitivePath(path)) {
    next();
    return;
  }

  const ctx = requestSecurityContext(req, { status: 404 });
  const ip = normalizeIp(ctx.ip);
  const L = securityLimits();
  const watch = observeTraffic(ip, { path, status: 404, kind: "response" });
  const snap = {
    ...watch,
    probe: true,
    probeEscalateHits: L.probeEscalateHits,
  };
  const cls = classifyNotFound(snap);
  if (cls === "scanner_probe" || isProbePath(path) || isSensitivePath(path)) {
    recordSecurityEvent({
      req,
      event: "scanner_probe",
      class: "scanner_probe",
      status: 404,
      message: "Sensitive path denied",
      meta: {
        sensitive: true,
        pathDiversity: watch.pathDiversity,
        probeHits: watch.probeHits,
      },
    });
    if (shouldEscalateScanner(snap)) {
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
  }

  res.status(404).end();
}
