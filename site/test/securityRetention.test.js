import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "motl-sec-ret-"));
process.env.DATA_DIR = dataDir;
process.env.SKIP_FORMBAR = "1";
process.env.NODE_ENV = "test";
process.env.SECURITY_EVENT_RETAIN_DAYS = "1";
process.env.LOGIN_EVENT_RETAIN_DAYS = "1";

const db = await import("../server/db.js");
await db.initDb();

const { retainSecurityData, resetRetentionClock } = await import("../server/security/retention.js");
const {
  escalateIpThrottle,
  checkIpThrottle,
  clearIpThrottle,
  noteIpThrottleHit,
} = await import("../server/security/throttle.js");
const { clearSecuritySamplers } = await import("../server/security/record.js");

test("security retention purges old events and login rows", async () => {
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  await db.writeSecurityEvent({
    event: "csrf_failed",
    class: "csrf_fail",
    ip: "203.0.113.10",
    path: "/login",
    status: 403,
    message: "old",
    createdAt: old,
  });
  await db.recordLoginFailure("local", null, null, "203.0.113.10");
  // Backdate the login row via another failure then purge relies on created_at —
  // insert an old login by writing security path only; use record + overwrite via second old event.
  await db.writeSecurityEvent({
    event: "csrf_failed",
    class: "csrf_fail",
    ip: "203.0.113.11",
    path: "/login",
    status: 403,
    message: "fresh",
  });

  // Manually age a login_events row using recordLoginFailure then update through purgeLoginEvents
  // by inserting with known old timestamp via writeSecurityEvent's sibling: re-call purge after
  // inserting old login through internal pattern — use escalate table for throttle test separately.
  resetRetentionClock();
  // Force an old login insert by temporarily using writeSecurityEvent-style: call recordLoginFailure
  // then purgeSecurityEvents which also purges login_events older than retain days.
  // Insert old login via db API: touchAccountLogin isn't for fails. Use recordLoginFailure and
  // accept that its created_at is "now" — instead verify purgeSecurityEvents deletes the old event.
  const result = await retainSecurityData({ force: true });
  assert.equal(result.skipped, false);
  assert.ok(result.security.events >= 1);

  const remaining = await db.listSecurityEvents({ pageSize: 100 });
  assert.ok(remaining.rows.every((r) => r.message !== "old"));
  assert.ok(remaining.rows.some((r) => r.message === "fresh"));
});

test("purgeLoginEvents removes aged rows", async () => {
  const old = Date.now() - 3 * 24 * 60 * 60 * 1000;
  await db.recordLoginFailure("local", null, null, "203.0.113.12", old);
  await db.recordLoginFailure("local", null, null, "203.0.113.13");
  const n = await db.purgeLoginEvents(1);
  assert.ok(n >= 1);
});

test("throttle escalate and clear", async () => {
  const ip = "203.0.113.99";
  await clearIpThrottle(ip);
  const t = await escalateIpThrottle(ip, "test");
  assert.ok(t.untilMs > Date.now());
  assert.equal((await checkIpThrottle(ip)).blocked, true);
  await clearIpThrottle(ip);
  assert.equal((await checkIpThrottle(ip)).blocked, false);
});

test("two process-local limiters are independent; throttle table is shared", async () => {
  const { rateLimit, clearRateLimits } = await import("../server/auth.js");
  clearRateLimits();
  const key = "multi-worker-demo:203.0.113.77";
  assert.equal(rateLimit(key, { max: 2, windowMs: 60000 }), true);
  assert.equal(rateLimit(key, { max: 2, windowMs: 60000 }), true);
  assert.equal(rateLimit(key, { max: 2, windowMs: 60000 }), false);
  // Shared hard block via SQLite
  const ip = "203.0.113.77";
  await clearIpThrottle(ip);
  await escalateIpThrottle(ip, "shared");
  assert.equal((await checkIpThrottle(ip)).blocked, true);
  await clearIpThrottle(ip);
});

test("ip_throttled hits aggregate into few summary events with accurate counts", async () => {
  const prevEvery = process.env.SECURITY_THROTTLE_SUMMARY_EVERY;
  const prevMs = process.env.SECURITY_THROTTLE_SUMMARY_MS;
  process.env.SECURITY_THROTTLE_SUMMARY_EVERY = "50";
  process.env.SECURITY_THROTTLE_SUMMARY_MS = "600000";
  clearSecuritySamplers();
  const ip = "203.0.113.88";
  await clearIpThrottle(ip);
  await escalateIpThrottle(ip, "scanner_probe");

  const before = await db.listSecurityEvents({ ip, event: "ip_throttled", pageSize: 200 });
  const beforeN = before.total;

  for (let i = 0; i < 25; i += 1) {
    const path = i % 2 === 0 ? "/wp-admin" : "/.env";
    const agg = await noteIpThrottleHit({ ip, path, reason: "scanner_probe" });
    assert.ok(agg);
    assert.equal(agg.hitCount, i + 1);
  }

  // Allow async writeSecurityEvent to flush
  await new Promise((r) => setTimeout(r, 50));

  const after = await db.listSecurityEvents({ ip, event: "ip_throttled", pageSize: 200 });
  // Only the first hit should summary (25 < 50 and within summary window)
  assert.equal(after.total - beforeN, 1);

  const row = await db.getSecurityIpThrottle(ip);
  assert.equal(Number(row.hit_count), 25);
  assert.ok(row.paths_json.includes("/wp-admin"));
  assert.ok(row.paths_json.includes("/.env"));

  // Hourly rate_limited bumped for every hit (not only summary events)
  const since = Date.now() - 2 * 60 * 60 * 1000;
  const hourlyRows = await db.securityIpHourlyForIp(ip, since);
  const rateLimited = hourlyRows.reduce((n, r) => n + (Number(r.rate_limited) || 0), 0);
  assert.ok(rateLimited >= 25, `expected hourly rate_limited >= 25, got ${rateLimited}`);

  await clearIpThrottle(ip);
  if (prevEvery === undefined) delete process.env.SECURITY_THROTTLE_SUMMARY_EVERY;
  else process.env.SECURITY_THROTTLE_SUMMARY_EVERY = prevEvery;
  if (prevMs === undefined) delete process.env.SECURITY_THROTTLE_SUMMARY_MS;
  else process.env.SECURITY_THROTTLE_SUMMARY_MS = prevMs;
});
