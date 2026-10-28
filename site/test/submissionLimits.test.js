import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import sqlite3 from "sqlite3";
import { cookieJar, fetchSession, spawnApp, stopApp } from "./httpHarness.js";

function startServer(env = {}) {
  return spawnApp({
    LOCAL_ACCOUNTS: "1",
    FORMBAR_LOGIN: "0",
    AUTH_EMAIL: "0",
    SESSION_SECRET: "test-limits-secret",
    ...env,
  }, { dataDirPrefix: "motl-limits-" });
}

async function stopServer(server) {
  await stopApp(server);
}

function runSql(dbFile, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFile);
    db.run(sql, params, function onRun(err) {
      db.close();
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getSql(dbFile, sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbFile);
    db.get(sql, params, (err, row) => {
      db.close();
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function postSignup(server, jar, email, name) {
  return fetchSession(server.base, "/signup", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, email, password: "password123" }),
  });
}

async function signupAndLogin(server, email, name) {
  let jar = cookieJar();
  let signup = await postSignup(server, jar, email, name);
  // Rare CI flake: session cookie / CSRF can desync under parallel HTTP suites.
  if (signup.status === 403) {
    jar = cookieJar();
    signup = await postSignup(server, jar, email, name);
  }
  assert.equal(signup.status, 302);
  const login = await fetchSession(server.base, "/login", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password: "password123" }),
  });
  assert.equal(login.status, 302);
  return jar;
}

async function postSuggestion(server, jar, { body, isBug = false, repro = "" }) {
  const params = new URLSearchParams({ next: "/", body });
  if (isBug) {
    params.set("is_bug", "1");
    params.set("repro", repro);
  }
  const res = await fetchSession(server.base, "/suggestions", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  assert.equal(res.status, 302);
  const home = await fetchSession(server.base, "/", jar);
  return home.text();
}

test("extra unanswered suggestions cost a ticket; bugs cap at 5", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));
  await server.ready;
  const email = "limits@example.com";
  const jar = await signupAndLogin(server, email, "Limit User");
  const dbFile = path.join(server.dataDir, "spaceelves.sqlite");

  let html = await postSuggestion(server, jar, { body: "First free idea" });
  assert.match(html, /Thanks for the suggestion/);

  html = await postSuggestion(server, jar, { body: "Needs a ticket" });
  assert.match(html, /Extra suggestions cost 1 ticket/);

  const acct = await getSql(dbFile, "SELECT id FROM accounts WHERE email = ?", [email]);
  await runSql(dbFile, "UPDATE accounts SET tickets = tickets + 2 WHERE id = ?", [acct.id]);
  await runSql(
    dbFile,
    `INSERT INTO ticket_lots (
      account_id, source_type, source_id, tickets_total, tickets_remaining, amount_cents, currency, created_at
    ) VALUES (?, 'grant', NULL, 2, 2, 0, 'USD', ?)`,
    [acct.id, Date.now()],
  );
  html = await postSuggestion(server, jar, { body: "Paid idea" });
  assert.match(html, /Used 1 ticket/);
  const tickets = await getSql(dbFile, "SELECT tickets FROM accounts WHERE email = ?", [email]);
  assert.equal(tickets.tickets, 1);

  for (let i = 0; i < 5; i += 1) {
    html = await postSuggestion(server, jar, {
      body: `Bug ${i}`,
      isBug: true,
      repro: `steps ${i}`,
    });
    assert.match(html, /Thanks for the bug report/);
  }
  html = await postSuggestion(server, jar, {
    body: "Bug overflow",
    isBug: true,
    repro: "more steps",
  });
  assert.match(html, /unresolved bug reports/);
});

test("profile lists and deletes own open suggestions", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));
  await server.ready;
  const email = "mysuggest@example.com";
  const jar = await signupAndLogin(server, email, "My Suggest");
  const dbFile = path.join(server.dataDir, "spaceelves.sqlite");
  const account = await getSql(dbFile, "SELECT id FROM accounts WHERE email = ?", [email]);

  await postSuggestion(server, jar, { body: "Profile visible idea" });
  const row = await getSql(
    dbFile,
    "SELECT id FROM suggestions WHERE account_id = ? AND is_bug = 0 AND archived_at IS NULL",
    [account.id],
  );
  assert.ok(row);

  const profile = await fetchSession(server.base, `/profile/${account.id}`, jar);
  assert.equal(profile.status, 200);
  const profileHtml = await profile.text();
  assert.match(profileHtml, /Suggestions/);
  assert.match(profileHtml, /Profile visible idea/);

  const del = await fetchSession(server.base, `/profile/suggestions/${row.id}/delete`, jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(),
  });
  assert.equal(del.status, 302);
  assert.equal(del.headers.get("location"), `/profile/${account.id}`);

  const after = await fetchSession(server.base, `/profile/${account.id}`, jar);
  const afterHtml = await after.text();
  assert.match(afterHtml, /Suggestion deleted|No open suggestions/);
  assert.doesNotMatch(afterHtml, /Profile visible idea/);
  const archived = await getSql(dbFile, "SELECT archived_at FROM suggestions WHERE id = ?", [row.id]);
  assert.ok(archived.archived_at);
});

test("profile lists and deletes own open bug reports", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));
  await server.ready;
  const email = "mybugs@example.com";
  const jar = await signupAndLogin(server, email, "My Bugs");
  const dbFile = path.join(server.dataDir, "spaceelves.sqlite");
  const account = await getSql(dbFile, "SELECT id FROM accounts WHERE email = ?", [email]);

  await postSuggestion(server, jar, {
    body: "Profile visible bug",
    isBug: true,
    repro: "open profile",
  });
  const bug = await getSql(
    dbFile,
    "SELECT id FROM suggestions WHERE account_id = ? AND is_bug = 1 AND archived_at IS NULL",
    [account.id],
  );
  assert.ok(bug);

  const profile = await fetchSession(server.base, `/profile/${account.id}`, jar);
  assert.equal(profile.status, 200);
  const profileHtml = await profile.text();
  assert.match(profileHtml, /Bug reports/);
  assert.match(profileHtml, /Profile visible bug/);
  assert.match(profileHtml, /open profile/);

  const del = await fetchSession(server.base, `/profile/bugs/${bug.id}/delete`, jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(),
  });
  assert.equal(del.status, 302);
  assert.equal(del.headers.get("location"), `/profile/${account.id}`);

  const after = await fetchSession(server.base, `/profile/${account.id}`, jar);
  const afterHtml = await after.text();
  assert.match(afterHtml, /Bug report deleted|No open bug reports/);
  assert.doesNotMatch(afterHtml, /Profile visible bug/);
  const archived = await getSql(dbFile, "SELECT archived_at FROM suggestions WHERE id = ?", [bug.id]);
  assert.ok(archived.archived_at);
});

test("unapproved wiki edits cap at 5 per account", async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));
  await server.ready;
  const email = "wikieditor@example.com";
  const jar = await signupAndLogin(server, email, "Wiki Editor");
  const dbFile = path.join(server.dataDir, "spaceelves.sqlite");
  const account = await getSql(dbFile, "SELECT id FROM accounts WHERE email = ?", [email]);
  const now = Date.now();
  await runSql(
    dbFile,
    `INSERT INTO games (id, mode, account_a, account_b, formbar_a, formbar_b, winner_side, created_at, ended_at)
     VALUES (?, 'ranked', ?, NULL, NULL, NULL, 'player', ?, ?)`,
    [`test-ranked-${account.id}`, account.id, now, now],
  );

  for (let i = 0; i < 5; i += 1) {
    const res = await fetchSession(server.base, "/rules/home/edit", jar, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title: "Home", body: `Edit number ${i}\n\nMore text.` }),
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/rules/home");
  }

  const blocked = await fetchSession(server.base, "/rules/home/edit", jar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ title: "Home", body: "Should fail" }),
  });
  assert.equal(blocked.status, 302);
  assert.equal(blocked.headers.get("location"), "/rules/home/edit");
  const editPage = await fetchSession(server.base, "/rules/home/edit", jar);
  assert.match(await editPage.text(), /unapproved wiki changes/i);
});
