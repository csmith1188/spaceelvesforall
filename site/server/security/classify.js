/**
 * Heuristic security classifications (not proof of malicious intent).
 */

export const SECURITY_CLASSES = Object.freeze([
  "ordinary",
  "auth_fail",
  "csrf_fail",
  "csrf_session",
  "rate_limited",
  "unauthorized",
  "scanner_probe",
  "brute_force",
  "app_error",
  "throttle",
]);

/**
 * Classify a CSRF failure from request diagnostics + traffic snapshot.
 * csrf_session requires authenticated or guest identity + session cookie,
 * not merely an anonymous csrfToken.
 * @param {{
 *   authenticated?: boolean,
 *   guestIdentity?: boolean,
 *   sessionExists?: boolean,
 *   sessionCookiePresent: boolean,
 *   path: string,
 * }} ctx
 * @param {{ csrfFails?: number, probe?: boolean, pathDiversity?: number, diversityMax?: number }} watch
 */
export function classifyCsrf(ctx, watch = {}) {
  const divMax = watch.diversityMax || 15;
  if (watch.probe || (watch.pathDiversity || 0) >= divMax) return "scanner_probe";
  const hasIdentity = Boolean(ctx.authenticated || ctx.guestIdentity);
  if (hasIdentity && ctx.sessionCookiePresent) return "csrf_session";
  return "csrf_fail";
}

/**
 * @param {{ authFails?: number, authFailMax?: number }} watch
 */
export function classifyAuthFail(watch = {}) {
  const max = watch.authFailMax || 12;
  if ((watch.authFails || 0) >= max) return "brute_force";
  return "auth_fail";
}

/**
 * Known probe paths and high unknown-path diversity classify as scanner.
 * highRps alone does not (shared-IP / burst safety).
 * @param {{ probe?: boolean, pathDiversity?: number, diversityMax?: number, highRps?: boolean }} watch
 */
export function classifyNotFound(watch = {}) {
  if (watch.probe) return "scanner_probe";
  const divMax = watch.diversityMax || 15;
  if ((watch.pathDiversity || 0) >= divMax) return "scanner_probe";
  return "ordinary";
}

/**
 * Whether scanner activity should escalate a temporary IP throttle.
 * - Known probe hits ≥ probeEscalateHits (default 3)
 * - Diversity ≥ bar only with at least one probe hit or highRps
 */
export function shouldEscalateScanner(watch = {}) {
  const probeHits = Number(watch.probeHits) || 0;
  const diversity = Number(watch.pathDiversity) || 0;
  const divMax = Number(watch.diversityMax) || 15;
  const escalateHits = Number(watch.probeEscalateHits) || 3;
  if (probeHits >= escalateHits) return true;
  if (diversity >= divMax && (probeHits >= 1 || watch.highRps)) return true;
  return false;
}

export function severityForClass(cls) {
  switch (cls) {
    case "app_error":
      return "error";
    case "scanner_probe":
    case "brute_force":
    case "throttle":
      return "warn";
    case "csrf_session":
    case "auth_fail":
    case "rate_limited":
    case "unauthorized":
    case "csrf_fail":
      return "warn";
    default:
      return "info";
  }
}

/** Whether this class should be persisted to security_events. */
export function shouldPersistClass(cls) {
  return cls !== "ordinary";
}
