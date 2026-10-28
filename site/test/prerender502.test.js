import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { DEFAULT_502, render502Html, write502Html } from "../scripts/prerender-502.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const committed = path.join(root, "public", "502.html");

describe("prerender 502", () => {
  it("renders a self-contained page (inline CSS/JS, no asset fetches)", async () => {
    const html = await render502Html();
    assert.match(html, /<!DOCTYPE html>/i);
    assert.match(html, new RegExp(`>${DEFAULT_502.status}<`));
    assert.match(html, new RegExp(DEFAULT_502.title));
    assert.match(html, /<style>/);
    assert.match(html, /data:image\/png;base64,/);
    assert.match(html, /<script>/);
    assert.match(html, /location\.reload/);
    assert.doesNotMatch(html, /<%/);
    assert.doesNotMatch(html, /href=["']\/css\//);
    assert.doesNotMatch(html, /src=["']\/js\//);
    assert.doesNotMatch(html, /src=["']\/img\//);
    assert.doesNotMatch(html, /url\(["']?\/img\//);
    assert.doesNotMatch(html, /fonts\.googleapis\.com/);
    assert.doesNotMatch(html, /favicon\.ico/);
  });

  it("writes public/502.html (committed artifact stays in sync)", async () => {
    const tmp = path.join(os.tmpdir(), `motl-502-${process.pid}.html`);
    try {
      await write502Html(tmp);
      const fresh = fs.readFileSync(tmp, "utf8");
      assert.ok(fs.existsSync(committed), "run npm run prerender-502 and commit public/502.html");
      const onDisk = fs.readFileSync(committed, "utf8");
      assert.equal(onDisk, fresh);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  });
});
