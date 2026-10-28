/**
 * Prerender views/502.ejs → public/502.html for Nginx when the Node upstream is down.
 * CSS, JS, and the nav background are inlined — no /css, /js, or /img fetches.
 *
 *   npm run prerender-502
 */
import ejs from "ejs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const siteRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(siteRoot, "..");
const templatePath = path.join(siteRoot, "views", "502.ejs");
const cssPath = path.join(siteRoot, "views", "502.css");
const outPath = path.join(repoRoot, "public", "502.html");
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const DEFAULT_502 = {
  status: 502,
  title: "Bad gateway",
  message: "The game server is temporarily unreachable. Try again in a moment.",
};

const RETRY_JS = [
  "document.getElementById(\"retry\")?.addEventListener(\"click\", function () {",
  "  location.reload();",
  "});",
].join("\n");

function buildCss() {
  const dataUri = `data:image/png;base64,${FALLBACK_PNG.toString("base64")}`;
  return fs.readFileSync(cssPath, "utf8").replaceAll("__NAV_BG__", dataUri);
}

/** @param {Partial<typeof DEFAULT_502>} [locals] */
export async function render502Html(locals = {}) {
  return ejs.renderFile(templatePath, {
    ...DEFAULT_502,
    ...locals,
    css: buildCss(),
    js: RETRY_JS,
  });
}

/** @param {string} [dest] */
export async function write502Html(dest = outPath) {
  const html = await render502Html();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html, "utf8");
  return dest;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dest = await write502Html();
  console.log(`wrote ${path.relative(repoRoot, dest)}`);
}
