/**
 * Bounded in-memory per-IP sliding windows for scanner / abuse heuristics.
 * Process-local; no DB writes.
 */

import { securityLimits } from "./limits.js";
import { isProbePath, isKnownAppPath, pathPrefixKey } from "./probes.js";
import { normalizeIp } from "./context.js";

/** @type {Map<string, object>} */
const ips = new Map();

function limits() {
  return securityLimits();
}

function pruneList(list, cutoff) {
  while (list.length && list[0] < cutoff) list.shift();
}

function ensureEntry(ip, now) {
  let entry = ips.get(ip);
  if (!entry) {
    entry = {
      reqTimes: [],
      paths: new Map(), // prefix → lastSeen
      csrfFails: [],
      authFails: [],
      status403: [],
      status404: [],
      probeHits: [],
      lastSeen: now,
    };
    ips.set(ip, entry);
  }
  entry.lastSeen = now;
  return entry;
}

function evictIfNeeded(now) {
  const max = limits().watchMaxIps;
  if (ips.size <= max) return;
  // Drop oldest by lastSeen
  const ranked = [...ips.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen);
  const drop = ips.size - max + Math.floor(max * 0.05);
  for (let i = 0; i < drop && i < ranked.length; i += 1) {
    ips.delete(ranked[i][0]);
  }
  // Also drop idle > 30 min
  const idleCutoff = now - 30 * 60 * 1000;
  for (const [key, entry] of ips) {
    if (entry.lastSeen < idleCutoff) ips.delete(key);
  }
}

/**
 * Record a request observation. Returns a snapshot for classification.
 * @param {string} ipRaw
 * @param {{ path?: string, status?: number, kind?: string }} obs
 */
export function observeTraffic(ipRaw, obs = {}, now = Date.now()) {
  const ip = normalizeIp(ipRaw);
  if (!ip || ip === "unknown") {
    return emptySnapshot();
  }
  const L = limits();
  const entry = ensureEntry(ip, now);
  const path = String(obs.path || "/");
  const status = Number(obs.status) || 0;
  const kind = obs.kind || "request";

  entry.reqTimes.push(now);
  pruneList(entry.reqTimes, now - L.highRpsWindowMs);

  const prefix = pathPrefixKey(path);
  entry.paths.set(prefix, now);
  // Drop stale path keys
  const pathCutoff = now - L.scannerWindowMs;
  for (const [key, seen] of entry.paths) {
    if (seen < pathCutoff) entry.paths.delete(key);
  }

  const probe = isProbePath(path);
  if (probe) {
    entry.probeHits.push(now);
    pruneList(entry.probeHits, now - L.scannerWindowMs);
  }

  if (kind === "csrf_fail") {
    entry.csrfFails.push(now);
    pruneList(entry.csrfFails, now - L.csrfFailWindowMs);
  }
  if (kind === "auth_fail") {
    entry.authFails.push(now);
    pruneList(entry.authFails, now - L.authFailWindowMs);
  }
  if (status === 403) {
    entry.status403.push(now);
    pruneList(entry.status403, now - L.scannerWindowMs);
  }
  if (status === 404) {
    entry.status404.push(now);
    pruneList(entry.status404, now - L.scannerWindowMs);
  }

  evictIfNeeded(now);

  // Count unknown path diversity
  let unknown = 0;
  for (const key of entry.paths.keys()) {
    if (!isKnownAppPath(key) || isProbePath(key)) unknown += 1;
  }

  return {
    ip,
    probe,
    probeHits: entry.probeHits.length,
    pathDiversity: unknown,
    diversityMax: L.scannerPathDiversity,
    csrfFails: entry.csrfFails.length,
    csrfFailMax: L.csrfFailMax,
    authFails: entry.authFails.length,
    authFailMax: L.authFailMax,
    highRps: entry.reqTimes.length >= L.highRpsMax,
    reqCount: entry.reqTimes.length,
    status403: entry.status403.length,
    status404: entry.status404.length,
    knownApp: isKnownAppPath(path),
  };
}

function emptySnapshot() {
  const L = limits();
  return {
    ip: "unknown",
    probe: false,
    probeHits: 0,
    pathDiversity: 0,
    diversityMax: L.scannerPathDiversity,
    csrfFails: 0,
    csrfFailMax: L.csrfFailMax,
    authFails: 0,
    authFailMax: L.authFailMax,
    highRps: false,
    reqCount: 0,
    status403: 0,
    status404: 0,
    knownApp: true,
  };
}

/** Test helper. */
export function clearTrafficWatch() {
  ips.clear();
}

export function trafficWatchSize() {
  return ips.size;
}
