import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.LOCAL_ACCOUNTS = "1";
process.env.AUTH_EMAIL = "1";
process.env.REFERRALS_ENABLED = "1";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "motl-referral-"));
process.env.DATA_DIR = dataDir;

const db = await import("../server/db.js");
const {
  onReferralAccountVerified,
  onReferralQualifyingPurchase,
} = await import("../server/referral/service.js");
const { recalculateReferralRisk } = await import("../server/referral/risk.js");
const { processReferralRewardReleases } = await import("../server/referral/releaseJob.js");
const { evaluateSignupGuard } = await import("../server/referral/signupGuard.js");
const { isDisposableEmail } = await import("../server/referral/disposable.js");
const { verifyTurnstileToken } = await import("../server/referral/turnstile.js");

await db.initDb();

let seq = 0;
async function makeAccount(prefix, { verified = true, emailDomain = "example.com" } = {}) {
  seq += 1;
  const name = `${prefix}${seq}`;
  const email = `${name.toLowerCase()}@${emailDomain}`;
  return db.createLocalAccount({
    email,
    passwordHash: "hash",
    name,
    verifiedAt: verified ? Date.now() : null,
  });
}

function browserId(seed) {
  return Buffer.from(String(seed)).toString("hex").padEnd(32, "a").slice(0, 32);
}

test("attribution links referee once and rejects self-referral", async () => {
  const referrer = await makeAccount("AttrRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("AttrNew", { verified: false });
  const ok = await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("attr"),
    ip: "10.0.0.1",
  });
  assert.equal(ok.ok, true);
  const again = await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
  });
  assert.equal(again.ok, false);
  assert.equal(again.error, "already_attributed");
  const self = await db.attributeReferral({
    refereeAccountId: referrer.id,
    code: code.code,
  });
  assert.equal(self.ok, false);
  assert.equal(self.error, "self_referral");
});

test("verify milestone credits referee immediately and holds referrer", async () => {
  const referrer = await makeAccount("VerRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("VerNew", { verified: false });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("ver"),
    ip: "10.0.0.2",
  });
  await db.setEmailVerified(referee.id);
  const result = await onReferralAccountVerified(referee.id);
  assert.equal(result.ok, true);
  const freshRef = await db.getAccount(referee.id);
  assert.equal(freshRef.tickets, 5);
  const rel = await db.getReferralRelationshipByReferee(referee.id);
  const rewards = await db.listReferralRewardsForRelationship(rel.id);
  const refereeReward = rewards.find((r) => r.role === "referee");
  const referrerReward = rewards.find((r) => r.role === "referrer");
  assert.equal(refereeReward.status, "released");
  assert.equal(referrerReward.status, "pending");
  await onReferralAccountVerified(referee.id);
  const again = await db.getAccount(referee.id);
  assert.equal(again.tickets, 5);
});

test("shared IP alone does not add risk; shared browser does", async () => {
  const referrer = await makeAccount("RiskRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const bid = browserId("shared-browser");
  const a = await makeAccount("RiskA", { verified: false });
  await db.attributeReferral({
    refereeAccountId: a.id,
    code: code.code,
    browserId: bid,
    ip: "10.1.1.1",
  });
  const scoreIp = await recalculateReferralRisk(a.id);
  assert.equal(scoreIp.score, 0);

  const b = await makeAccount("RiskB", { verified: false });
  await db.attributeReferral({
    refereeAccountId: b.id,
    code: code.code,
    browserId: bid,
    ip: "10.1.1.2",
  });
  const scoreBrowser = await recalculateReferralRisk(b.id);
  assert.ok(scoreBrowser.score >= 40);
  assert.ok(scoreBrowser.signals.some((s) => s.signal === "shared_browser"));
});

test("shared browser plus rapid signup is high risk", async () => {
  const referrer = await makeAccount("HighRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const bid = browserId("high-risk");
  const ip = "10.2.2.2";
  let lastId = null;
  for (let i = 0; i < 5; i += 1) {
    const r = await makeAccount("Hi", { verified: false });
    await db.attributeReferral({
      refereeAccountId: r.id,
      code: code.code,
      browserId: bid,
      ip,
    });
    lastId = r.id;
  }
  const risk = await recalculateReferralRisk(lastId);
  assert.equal(risk.class, "high");
  assert.ok(risk.score >= 60);
});

test("disposable email contributes configured points", async () => {
  assert.equal(isDisposableEmail("x@mailinator.com"), true);
  assert.equal(isDisposableEmail("x@gmail.com"), false);
  const referrer = await makeAccount("DispRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("DispNew", { verified: false, emailDomain: "mailinator.com" });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("disp"),
    ip: "10.2.3.4",
  });
  const risk = await recalculateReferralRisk(referee.id);
  assert.ok(risk.score >= 10);
  assert.ok(risk.signals.some((s) => s.signal === "disposable_email"));
});

test("release job is idempotent", async () => {
  const referrer = await makeAccount("RelRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("RelNew", { verified: false });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("rel"),
    ip: "10.3.3.3",
  });
  await db.setEmailVerified(referee.id);
  await onReferralAccountVerified(referee.id);
  const rel = await db.getReferralRelationshipByReferee(referee.id);
  const rewards = await db.listReferralRewardsForRelationship(rel.id);
  const pending = rewards.find((r) => r.role === "referrer");
  const credit = await db.creditAndReleaseReferralReward(pending.id);
  assert.equal(credit.ok, true);
  const mid = (await db.getAccount(referrer.id)).tickets;
  assert.equal(mid, 5);
  const again = await db.creditAndReleaseReferralReward(pending.id);
  assert.equal(again.duplicate, true);
  assert.equal((await db.getAccount(referrer.id)).tickets, mid);
  await processReferralRewardReleases({ limit: 50 });
  assert.equal((await db.getAccount(referrer.id)).tickets, mid);
});

test("purchase below minimum does not reward", async () => {
  const referrer = await makeAccount("PayRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("PayNew", { verified: true });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("pay"),
    ip: "10.4.4.4",
  });
  const result = await onReferralQualifyingPurchase({
    id: 999001,
    account_id: referee.id,
    amount_value: "4.00",
    status: "credited",
  });
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "below_minimum");
});

test("qualifying purchase creates rewards once", async () => {
  const referrer = await makeAccount("BuyRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("BuyNew", { verified: true });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("buy"),
    ip: "10.5.5.5",
  });
  const purchase = {
    id: 999002,
    account_id: referee.id,
    amount_value: "5.00",
    status: "credited",
  };
  const first = await onReferralQualifyingPurchase(purchase);
  assert.equal(first.ok, true);
  const second = await onReferralQualifyingPurchase(purchase);
  assert.equal((second.created?.rewards || []).length, 0);
});

test("refund reverses purchase referral rewards", async () => {
  const referrer = await makeAccount("RevRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("RevNew", { verified: true });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("rev"),
    ip: "10.9.9.9",
  });
  const purchase = await db.createPaypalPurchase({
    accountId: referee.id,
    packageId: "pack_5",
    amountValue: "5.00",
    currency: "USD",
    tickets: 20,
    paypalOrderId: `order-rev-${Date.now()}`,
  });
  await db.markPaypalPurchaseCaptured(purchase.id, `cap-rev-${Date.now()}`);
  const credit = await db.creditPaypalPurchase(purchase.id);
  assert.equal(credit.ok, true);
  await onReferralQualifyingPurchase(credit.purchase);
  const rel = await db.getReferralRelationshipByReferee(referee.id);
  let rewards = await db.listReferralRewardsForRelationship(rel.id);
  assert.ok(rewards.some((r) => r.milestone === "purchase"));
  const rev = await db.reverseReferralRewardsForPurchase(purchase.id);
  assert.equal(rev.ok, true);
  rewards = await db.listReferralRewardsForRelationship(rel.id);
  const purchaseRewards = rewards.filter((r) => r.milestone === "purchase");
  assert.ok(purchaseRewards.every((r) => r.status === "reversed"));
  const again = await db.reverseReferralRewardsForPurchase(purchase.id);
  assert.ok(again.results.every((r) => r.duplicate || r.reversed));
});

test("high referral volume alone does not flag", async () => {
  const referrer = await makeAccount("VolRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  let sampleId = null;
  for (let i = 0; i < 25; i += 1) {
    const r = await makeAccount("Vol", { verified: false });
    // Distinct browser + distinct /24 so volume ≠ rapid-signup signal.
    await db.attributeReferral({
      refereeAccountId: r.id,
      code: code.code,
      browserId: browserId(`vol-${i}-${r.id}`),
      ip: `10.${20 + i}.1.1`,
    });
    sampleId = r.id;
  }
  const risk = await recalculateReferralRisk(sampleId);
  assert.equal(risk.class, "normal");
  assert.equal(risk.score, 0);
});

test("signup guard allows normal sources", async () => {
  const posture = await evaluateSignupGuard({
    browserId: browserId("guard-ok"),
    ip: "10.7.7.7",
  });
  assert.equal(posture.allow, true);
  assert.equal(posture.requireCaptcha, false);
});

test("turnstile token reuse fails when configured", async () => {
  process.env.TURNSTILE_SITE_KEY = "site";
  process.env.TURNSTILE_SECRET_KEY = "secret";
  const token = `one-time-token-${Date.now()}`;
  const fakeFetch = async () => ({
    json: async () => ({ success: true }),
  });
  const first = await verifyTurnstileToken(token, {
    browserId: browserId("ts"),
    ip: "10.8.8.8",
    fetchImpl: fakeFetch,
  });
  assert.equal(first.ok, true);
  const second = await verifyTurnstileToken(token, {
    browserId: browserId("ts"),
    ip: "10.8.8.8",
    fetchImpl: fakeFetch,
  });
  assert.equal(second.ok, false);
  assert.equal(second.error, "token_reuse");
  delete process.env.TURNSTILE_SITE_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
});

test("formbar-linked accounts are ineligible", async () => {
  const account = await db.upsertAccount(424242, "FormRef");
  assert.equal(db.accountEligibleForReferrals(account), false);
  const code = await db.ensureReferralCodeForAccount(account.id);
  assert.equal(code, null);
});

test("admin reject blocks automatic release", async () => {
  const referrer = await makeAccount("AdmRef");
  const code = await db.ensureReferralCodeForAccount(referrer.id);
  const referee = await makeAccount("AdmNew", { verified: false });
  await db.attributeReferral({
    refereeAccountId: referee.id,
    code: code.code,
    browserId: browserId("adm"),
    ip: "10.10.10.10",
  });
  await db.setEmailVerified(referee.id);
  await onReferralAccountVerified(referee.id);
  const rel = await db.getReferralRelationshipByReferee(referee.id);
  const rewards = await db.listReferralRewardsForRelationship(rel.id);
  const pending = rewards.find((r) => r.role === "referrer");
  const rejected = await db.rejectReferralReward(pending.id, "test");
  assert.equal(rejected.ok, true);
  await db.updateReferralRewardRisk(pending.id, {
    riskScore: 0,
    riskClass: "normal",
    status: "pending",
    releaseAt: Date.now() - 1000,
  });
  // reject is terminal — update should not revive; force status check via credit
  const credit = await db.creditAndReleaseReferralReward(pending.id);
  assert.equal(credit.ok, false);
});
