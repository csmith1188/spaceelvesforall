import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAuthFail,
  classifyCsrf,
  classifyNotFound,
  clearTrafficWatch,
  isProbePath,
  isKnownAppPath,
  isSensitivePath,
  observeTraffic,
  pathPrefixKey,
  requestSecurityContext,
  shouldEscalateScanner,
} from "../server/security/index.js";

test("isProbePath detects common scanner targets", () => {
  assert.equal(isProbePath("/wp-admin"), true);
  assert.equal(isProbePath("/phpmyadmin/index.php"), true);
  assert.equal(isProbePath("/graphql"), true);
  assert.equal(isProbePath("/.env"), true);
  assert.equal(isProbePath("/games"), false);
  assert.equal(isProbePath("/login"), false);
});

test("isSensitivePath covers secrets and backups", () => {
  assert.equal(isSensitivePath("/.env"), true);
  assert.equal(isSensitivePath("/.env.local"), true);
  assert.equal(isSensitivePath("/.git/config"), true);
  assert.equal(isSensitivePath("/data/foo.sqlite"), true);
  assert.equal(isSensitivePath("/backup/db.sql.gz"), true);
  assert.equal(isSensitivePath("/keys/server.pem"), true);
  assert.equal(isSensitivePath("/games"), false);
  assert.equal(isSensitivePath("/css/landing.css"), false);
});

test("isKnownAppPath recognizes MOTL routes", () => {
  assert.equal(isKnownAppPath("/"), true);
  assert.equal(isKnownAppPath("/games"), true);
  assert.equal(isKnownAppPath("/api/v1/me"), true);
  assert.equal(isKnownAppPath("/wp-admin"), false);
});

test("pathPrefixKey keeps two segments", () => {
  assert.equal(pathPrefixKey("/a/b/c"), "/a/b");
  assert.equal(pathPrefixKey("/"), "/");
});

test("classifyCsrf requires identity for csrf_session", () => {
  assert.equal(classifyCsrf({
    authenticated: true,
    guestIdentity: false,
    sessionCookiePresent: true,
    path: "/login",
  }, {}), "csrf_session");
  assert.equal(classifyCsrf({
    authenticated: false,
    guestIdentity: true,
    sessionCookiePresent: true,
    path: "/play/bot",
  }, {}), "csrf_session");
  assert.equal(classifyCsrf({
    authenticated: false,
    guestIdentity: false,
    sessionExists: true,
    sessionCookiePresent: true,
    path: "/login",
  }, {}), "csrf_fail");
  assert.equal(classifyCsrf({
    authenticated: false,
    guestIdentity: false,
    sessionCookiePresent: false,
    path: "/login",
  }, { probe: true }), "scanner_probe");
});

test("requestSecurityContext splits sessionExists from authenticated", () => {
  const anon = requestSecurityContext({
    path: "/login",
    method: "GET",
    headers: { cookie: "elves.sid=abc" },
    get: (n) => (n === "cookie" ? "elves.sid=abc" : ""),
    session: { csrfToken: "tok" },
    socket: { remoteAddress: "203.0.113.1" },
  });
  assert.equal(anon.sessionExists, true);
  assert.equal(anon.authenticated, false);
  assert.equal(anon.anonymousSession, true);
  assert.equal(anon.guestIdentity, false);

  const authed = requestSecurityContext({
    path: "/login",
    method: "POST",
    headers: { cookie: "elves.sid=abc" },
    get: (n) => (n === "cookie" ? "elves.sid=abc" : ""),
    session: { csrfToken: "tok", accountId: 42 },
    socket: { remoteAddress: "203.0.113.1" },
  });
  assert.equal(authed.authenticated, true);
  assert.equal(authed.anonymousSession, false);
  assert.equal(authed.accountId, 42);
});

test("rapid unrelated unknown paths classify as scanner at raised bar", () => {
  clearTrafficWatch();
  const ip = "203.0.113.50";
  let snap;
  for (let i = 0; i < 10; i += 1) {
    snap = observeTraffic(ip, { path: `/unknown${i}/x`, status: 404 });
  }
  // Default diversity bar is 15; 10 prefixes stay ordinary for escalate purposes
  assert.ok(snap.pathDiversity >= 8);
  assert.equal(classifyNotFound(snap), "ordinary");
  assert.equal(shouldEscalateScanner(snap), false);

  for (let i = 10; i < 16; i += 1) {
    snap = observeTraffic(ip, { path: `/unknown${i}/x`, status: 404 });
  }
  assert.ok(snap.pathDiversity >= 15);
  assert.equal(classifyNotFound(snap), "scanner_probe");
  // Diversity alone without probeHits/highRps does not escalate
  assert.equal(shouldEscalateScanner(snap), false);
});

test("known probe hits escalate; highRps alone does not classify", () => {
  clearTrafficWatch();
  const ip = "203.0.113.55";
  let snap;
  for (let i = 0; i < 3; i += 1) {
    snap = observeTraffic(ip, { path: "/wp-admin", status: 404 });
  }
  assert.equal(classifyNotFound(snap), "scanner_probe");
  assert.equal(shouldEscalateScanner({
    ...snap,
    probeEscalateHits: 3,
  }), true);

  clearTrafficWatch();
  const burst = observeTraffic("203.0.113.56", { path: "/games", status: 404 });
  // Fabricate highRps without probe
  assert.equal(classifyNotFound({ ...burst, highRps: true, probe: false, pathDiversity: 0 }), "ordinary");
  assert.equal(shouldEscalateScanner({
    probeHits: 0,
    pathDiversity: 0,
    diversityMax: 15,
    highRps: true,
    probeEscalateHits: 3,
  }), false);
});

test("single 404 on app path is ordinary", () => {
  clearTrafficWatch();
  const snap = observeTraffic("203.0.113.51", { path: "/games", status: 404 });
  assert.equal(classifyNotFound(snap), "ordinary");
});

test("repeated auth fails become brute_force", () => {
  clearTrafficWatch();
  const ip = "203.0.113.52";
  let snap;
  for (let i = 0; i < 15; i += 1) {
    snap = observeTraffic(ip, { path: "/login", kind: "auth_fail", status: 401 });
  }
  assert.equal(classifyAuthFail(snap), "brute_force");
});
