/**
 * Admin Security dashboard data helpers.
 */

import {
  getSecurityEvent,
  getSecurityIpThrottle,
  listLoginEventsByIp,
  listSecurityEvents,
  securityHourlyTrend,
  securityIpTopPaths,
  securityOverviewCounts,
} from "../db.js";
import { retainSecurityData } from "../security/retention.js";
import { securityLimits } from "../security/limits.js";

export async function securityOverview() {
  await retainSecurityData().catch(() => {});
  const counts = await securityOverviewCounts();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const hourly = await securityHourlyTrend(since);
  return { counts, hourly, limits: securityLimits() };
}

export async function securityEventsPage(query = {}) {
  await retainSecurityData().catch(() => {});
  return listSecurityEvents({
    page: query.page,
    pageSize: query.pageSize || 50,
    event: query.event || null,
    class: query.class || null,
    ip: query.ip || null,
    path: query.path || null,
    status: query.status || null,
    accountId: query.accountId || null,
    since: query.since ? Number(query.since) : null,
    until: query.until ? Number(query.until) : null,
    q: query.q || null,
  });
}

export async function securityErrorsPage(query = {}) {
  await retainSecurityData().catch(() => {});
  return listSecurityEvents({
    page: query.page,
    pageSize: query.pageSize || 50,
    includeClasses: ["app_error", "csrf_session"],
    excludeClasses: ["scanner_probe"],
    ip: query.ip || null,
    path: query.path || null,
    q: query.q || null,
    since: query.since ? Number(query.since) : null,
  });
}

export async function securityIpPage(ip, query = {}) {
  const clean = String(ip || "").trim().slice(0, 80);
  if (!clean) {
    return {
      ip: "",
      events: { rows: [], total: 0, page: 1, pageSize: 50 },
      logins: { rows: [], total: 0, page: 1, pageSize: 50 },
      topPaths: [],
      throttle: null,
    };
  }
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const [events, logins, topPaths, throttle] = await Promise.all([
    listSecurityEvents({
      ip: clean,
      page: query.page,
      pageSize: 50,
      since,
    }),
    listLoginEventsByIp(clean, { page: 1, pageSize: 50, since }),
    securityIpTopPaths(clean, since, 20),
    getSecurityIpThrottle(clean),
  ]);
  const now = Date.now();
  const throttleActive = throttle && Number(throttle.until_ms) > now ? throttle : null;
  let throttlePaths = [];
  if (throttleActive && throttleActive.paths_json) {
    try {
      const parsed = JSON.parse(throttleActive.paths_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        throttlePaths = Object.entries(parsed)
          .map(([p, n]) => ({ path: p, n: Number(n) || 0 }))
          .sort((a, b) => b.n - a.n || a.path.localeCompare(b.path));
      }
    } catch {
      throttlePaths = [];
    }
  }
  return {
    ip: clean,
    events,
    logins,
    topPaths,
    throttle: throttleActive
      ? {
        ...throttleActive,
        hit_count: Number(throttleActive.hit_count) || 0,
        first_hit_at: throttleActive.first_hit_at != null
          ? Number(throttleActive.first_hit_at)
          : null,
        last_hit_at: throttleActive.last_hit_at != null
          ? Number(throttleActive.last_hit_at)
          : null,
        last_path: throttleActive.last_path || null,
        paths: throttlePaths,
      }
      : null,
  };
}

export async function securityEventDetail(id) {
  return getSecurityEvent(id);
}

/** Dev-only: record synthetic security events for UI testing. */
export async function simulateSecurityTraffic(req) {
  const { recordSecurityEvent, requestSecurityContext } = await import("../security/index.js");
  const { observeTraffic } = await import("../security/trafficWatch.js");
  const ctx = requestSecurityContext(req);
  const paths = ["/wp-admin", "/phpmyadmin", "/graphql", "/.env", "/actuator/health"];
  for (const path of paths) {
    observeTraffic(ctx.ip, { path, status: 404, kind: "response" });
    recordSecurityEvent({
      event: "scanner_probe",
      class: "scanner_probe",
      status: 404,
      ip: ctx.ip,
      method: "GET",
      path,
      requestId: ctx.requestId,
      userAgent: ctx.userAgent,
      message: "Simulated scanner probe",
      meta: { simulated: true },
    });
  }
  recordSecurityEvent({
    event: "auth_failed",
    class: "auth_fail",
    status: 401,
    ip: ctx.ip,
    method: "POST",
    path: "/login",
    requestId: ctx.requestId,
    userAgent: ctx.userAgent,
    message: "Simulated auth failure",
    meta: { simulated: true, provider: "local", reason: "invalid_credentials" },
  });
  return { ok: true, probes: paths.length };
}
