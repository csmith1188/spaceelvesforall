import { bindAccountBar, bootMenus, startPlay } from "./api.js";
import { gamesPath, isShell } from "../runtime.js";

const form = document.getElementById("lobby-create-form");
const accountEl = document.getElementById("games-account");
const noticeEl = document.getElementById("games-notice");
const cancel = document.getElementById("lobby-cancel");

function setNotice(text) {
  if (!noticeEl) return;
  noticeEl.classList.toggle("hidden", !text);
  noticeEl.textContent = text || "";
}

async function fillOptions() {
  const { apiFetch } = await import("../runtime.js");
  const res = await apiFetch("/api/v1/match-options");
  if (!res.ok) return;
  const data = await res.json();
  const matchType = form?.querySelector("#matchType");
  const defaults = data.defaults || {};
  const types = Array.isArray(data.matchTypes) ? data.matchTypes : [];
  if (matchType) {
    matchType.innerHTML = types.map((row) => {
      const sel = defaults.matchType === row.id ? " selected" : "";
      return `<option value="${row.id}"${sel}>${row.label}</option>`;
    }).join("");
  }
}

(async () => {
  const me = await bootMenus();
  if (accountEl && isShell()) bindAccountBar(accountEl, me);
  else if (accountEl) accountEl.replaceChildren();
  if (cancel) cancel.setAttribute("href", gamesPath());
  await fillOptions();
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      setNotice("");
      const fd = new FormData(form);
      const result = await startPlay("listed", {
        lobbyPassword: String(fd.get("lobbyPassword") || ""),
        matchOptions: {
          matchType: String(fd.get("matchType") || "ForHonorMP"),
        },
      });
      if (!result.ok) setNotice(result.error || "Could not create lobby.");
    });
  }
})().catch((err) => {
  console.error(err);
  setNotice("Failed to load lobby form.");
});
