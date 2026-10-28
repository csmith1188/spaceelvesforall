/**
 * Security monitoring & abuse prevention public surface.
 */

export { securityLimits } from "./limits.js";
export {
  newRequestId,
  normalizeIp,
  isLoopbackIp,
  requestSecurityContext,
  sessionCookiePresent,
} from "./context.js";
export {
  SECURITY_CLASSES,
  classifyAuthFail,
  classifyCsrf,
  classifyNotFound,
  shouldEscalateScanner,
  severityForClass,
  shouldPersistClass,
} from "./classify.js";
export { isProbePath, isKnownAppPath, pathPrefixKey, PROBE_PREFIXES } from "./probes.js";
export { isSensitivePath, sensitivePathDenyMiddleware } from "./sensitivePaths.js";
export { observeTraffic, clearTrafficWatch, trafficWatchSize } from "./trafficWatch.js";
export {
  checkIpThrottle,
  escalateIpThrottle,
  clearIpThrottle,
  noteIpThrottleHit,
} from "./throttle.js";
export { recordSecurityEvent, clearSecuritySamplers } from "./record.js";
export { retainSecurityData, resetRetentionClock } from "./retention.js";
export {
  requestIdMiddleware,
  ipThrottleMiddleware,
  trafficObserveMiddleware,
  apiPublicRateLimit,
} from "./middleware.js";
