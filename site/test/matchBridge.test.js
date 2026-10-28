import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "elves-bridge-"));
process.env.DATA_DIR = dataDir;
process.env.SKIP_GAME_SPAWN = "1";
process.env.BOT_COUNTDOWN_MS = "30";
process.env.NODE_ENV = "test";
process.env.SESSION_SECRET = "bridge-test-secret-32-characters!";
process.env.SKIP_FORMBAR = "1";

const { initDb, closeDb, createLocalAccount, getAccount, grantTickets } = await import("../server/db.js");
const { hashPassword } = await import("../server/auth.js");
const { Matchmaker } = await import("../server/matchmaking.js");

await initDb();

test("starting a match does not change tickets, holds, or MMR", async () => {
  const created = await createLocalAccount({
    email: "bridge@example.com",
    passwordHash: await hashPassword("password123"),
    name: "Bridge",
    verifiedAt: Date.now(),
  });
  await grantTickets(created.id, 4);
  const before = await getAccount(created.id);
  const io = { to() { return { emit() {} }; } };
  const mm = new Matchmaker(io);
  const socket = {
    connected: true,
    data: {
      user: {
        id: `a:${before.id}`,
        name: before.name,
        accountId: before.id,
        mmr: before.mmr,
      },
    },
    emit() {},
    join() {},
    leave() {},
  };
  await mm.startBot(socket);
  const room = mm.roomForUser(`a:${before.id}`);
  assert.ok(room && room.id);
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline && !room.playUrl) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(room.status, "playing");
  assert.ok(room.playUrl);
  assert.equal(room.charged, false);
  const after = await getAccount(before.id);
  assert.equal(after.tickets, before.tickets);
  assert.equal(after.held, before.held);
  assert.equal(after.mmr, before.mmr);
  room.endWithoutResult("test");
  clearInterval(mm.timer);
});

test.after(async () => {
  await closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
