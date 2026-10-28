import {
  bindAccountBar,
  bootMenus,
  loadQueues,
  lobbyCreatePath,
  playErrorMessage,
  startPlay,
} from "./api.js";
import { isShell, playPath } from "../runtime.js";
import { installCommunityPanel } from "../community.js";

const root = document.getElementById("games-root");
const accountEl = document.getElementById("games-account");
const noticeEl = document.getElementById("games-notice");

const LOCK_ICON = `<span class="lobby-lock" title="Password required" aria-label="Password required"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8 1.5A2.75 2.75 0 0 0 5.25 4.25V6H4.5A1.5 1.5 0 0 0 3 7.5v5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 6h-.75V4.25A2.75 2.75 0 0 0 8 1.5Zm1.25 4.5h-2.5V4.25a1.25 1.25 0 1 1 2.5 0V6Z"/></svg></span>`;

let passwordModal = null;
let pendingJoin = null;

function setNotice(text) {
  if (!noticeEl) return;
  if (!text) {
    noticeEl.classList.add("hidden");
    noticeEl.textContent = "";
    return;
  }
  noticeEl.classList.remove("hidden");
  noticeEl.textContent = text;
}

/** Match landing.css: play-split / play-thirds style form > button children. */
function cell(attrs, label) {
  const parts = Object.entries(attrs)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true ? k : `${k}="${escapeAttr(v)}"`))
    .join(" ");
  return `<form><button type="button" ${parts}>${label}</button></form>`;
}

function ensurePasswordModal() {
  if (passwordModal) return passwordModal;
  const el = document.createElement("div");
  el.id = "lobby-password-modal";
  el.className = "suggest-modal hidden";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "lobby-password-title");
  el.innerHTML = `
    <div class="suggest-card">
      <h2 id="lobby-password-title">Join locked game</h2>
      <p class="hint" id="lobby-password-host"></p>
      <form id="lobby-password-form">
        <label for="lobby-password-input">Password</label>
        <input id="lobby-password-input" name="password" type="password" maxlength="32" autocomplete="current-password" required>
        <p id="lobby-password-error" class="notice hidden" role="status"></p>
        <div class="suggest-actions">
          <button type="button" class="action" id="lobby-password-cancel">Cancel</button>
          <button type="submit">Join</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(el);
  const form = el.querySelector("#lobby-password-form");
  const input = el.querySelector("#lobby-password-input");
  const errEl = el.querySelector("#lobby-password-error");
  const cancel = el.querySelector("#lobby-password-cancel");
  const hostEl = el.querySelector("#lobby-password-host");

  function setModalError(text) {
    errEl.classList.toggle("hidden", !text);
    errEl.textContent = text || "";
  }

  function closeModal() {
    pendingJoin = null;
    el.classList.add("hidden");
    setModalError("");
    form.reset();
  }

  cancel.addEventListener("click", () => closeModal());
  el.addEventListener("click", (ev) => {
    if (ev.target === el) closeModal();
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !el.classList.contains("hidden")) closeModal();
  });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (!pendingJoin) return;
    const password = input.value || "";
    setModalError("");
    const result = await startPlay("join", {
      roomId: pendingJoin.roomId,
      view3d: pendingJoin.view3d,
      lobbyPassword: password,
    });
    if (!result.ok) {
      setModalError(result.error || playErrorMessage(result.code) || "Join failed.");
      input.focus();
      input.select();
      return;
    }
    closeModal();
  });

  passwordModal = { el, input, hostEl, setModalError, closeModal, open(host, roomId, view3d) {
    pendingJoin = { roomId, view3d };
    hostEl.textContent = host ? `Hosted by ${host}` : "Enter the lobby password to join.";
    setModalError("");
    form.reset();
    el.classList.remove("hidden");
    input.focus();
  } };
  return passwordModal;
}

function render(me, queues) {
  if (!root) return;
  const rejoin = Boolean(me && me.busy);
  const canTicket = Boolean(me && me.canTicket);
  const noFree = Boolean(me && me.noFree);
  const waiting = (queues && queues.waiting) || { unranked: 0, ranked: 0 };
  const lobbies = (queues && queues.lobbies) || [];
  const privileged = Boolean(me && me.account);
  const account = me && me.account;
  const disabled = rejoin ? "disabled" : null;
  const freePlayOk = !noFree || (canTicket && !rejoin);
    const freeTip = noFree
    ? (!privileged
      ? "Log in to play vs bot or random unranked."
      : "Play vs bot and Random unranked need a verified login.")
    : "";

  let rankChip = "";
  if (account && account.officerRankLabel) {
    const detail = account.placementsDone
      ? (account.mmr != null ? `${account.mmr} MMR` : "")
      : (account.placementProgress && account.placementProgress.label) || "Commission Pending";
    rankChip = `<p class="officer-chip"><span class="rank-insignia rank-${escapeAttr(account.officerRank || "ensign")}" aria-hidden="true"></span><span>${escape(account.officerRankLabel)}${detail ? ` · ${escape(detail)}` : ""}</span></p>`;
  }

  let html = `<section><h2>Play</h2>${rankChip}<div class="stack">`;
  if (rejoin) {
    html += `<a class="action" href="${playPath(false)}">Rejoin match</a>`;
  }
  if (freePlayOk) {
    html += `
    <div class="play-split">
      ${cell({ "data-play": "bot", "data-view": "2d", disabled }, "Play vs bot")}
      ${cell({ "data-play": "trainBot", "data-view": "2d", disabled }, "Train vs bot")}
    </div>
    <div class="play-split">
      ${cell({ "data-play": "casual", "data-view": "2d", disabled }, "Random unranked")}
      ${cell({ "data-play": "trainCasual", "data-view": "2d", disabled }, "Train vs random")}
    </div>`;
  } else {
    html += `
    <div class="play-split">
      <span class="has-tip" title="${escapeAttr(freeTip)}"><button type="button" disabled>Play vs bot</button></span>
      ${cell({ "data-play": "trainBot", "data-view": "2d", disabled }, "Train vs bot")}
    </div>
    <div class="play-split">
      <span class="has-tip" title="${escapeAttr(freeTip)}"><button type="button" disabled>Random unranked</button></span>
      ${cell({ "data-play": "trainCasual", "data-view": "2d", disabled }, "Train vs random")}
    </div>`;
  }

  if (privileged) {
    const tip = "Ranked search and custom games need a verified login.";
    const rankedOk = canTicket && !rejoin;
    if (rankedOk) {
      html += `
      <div class="play-split">
        ${cell({ "data-play": "ranked", "data-view": "2d" }, "Find ranked match")}
        <a class="action" href="${lobbyCreatePath(false)}">Create Custom Game</a>
      </div>`;
    } else {
      html += `
      <div class="play-split">
        <span class="has-tip" title="${escapeAttr(tip)}"><button type="button" disabled>Find ranked match</button></span>
        <span class="has-tip" title="${escapeAttr(tip)}"><button type="button" disabled>Create Custom Game</button></span>
      </div>`;
    }
  }

  html += `</div></section>
      <br>
    <section class="open-games">
      <h2>Open games</h2>
      <dl class="stats open-queues">
        <div><dt>Waiting unranked</dt><dd>${waiting.unranked}</dd></div>
        <div><dt>Waiting ranked</dt><dd>${waiting.ranked}</dd></div>
      </dl>
      <br>
      <h2>Custom games</h2>`;
  if (!lobbies.length) {
    html += `<p class="hint">No custom games.</p>`;
  } else {
    html += `<ul class="list">`;
    for (const lobby of lobbies) {
      const m = lobby.match || {};
      const locked = Boolean(lobby.locked);
      html += `<li class="card">
        <div class="lobby-host">
          <p class="title">${escape(lobby.host)}</p>
          ${locked ? LOCK_ICON : ""}
        </div>
        <dl class="lobby-match">
          <div><dt>Match</dt><dd>${escape(m.matchLabel || m.mapLabel || "For Honor")}</dd></div>
          <div><dt>Seats</dt><dd>${m.seats != null ? m.seats : "—"}</dd></div>
        </dl>`;
      if (rejoin) html += `<p class="hint">You are already in a match.</p>`;
      else if (!privileged) html += `<p class="hint">Log in to join.</p>`;
      else if (!canTicket) {
        const joinTip = "Ranked search and custom games need a verified login.";
        html += `<div class="play-split">
          <span class="has-tip" title="${escapeAttr(joinTip)}"><button type="button" disabled>Join</button></span>
        </div>`;
      } else {
        const lockAttrs = locked ? { "data-locked": "1", "data-host": lobby.host || "" } : {};
        html += `<div class="play-split">
          ${cell({ "data-join": lobby.id, "data-view": "2d", ...lockAttrs }, "Join")}
        </div>`;
      }
      html += `</li>`;
    }
    html += `</ul>`;
  }
  html += `</section>`;
  root.innerHTML = html;
}

function escape(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(text) {
  return escape(text).replace(/"/g, "&quot;");
}

async function refresh() {
  const me = await bootMenus();
  if (!me && !document.getElementById("motl-outdated")) {
    setNotice("Could not load session.");
  }
  // Website pages already have the site header nav; only shells need an account strip.
  if (accountEl && isShell()) bindAccountBar(accountEl, me);
  else if (accountEl) accountEl.replaceChildren();
  const queues = await loadQueues();
  render(me, queues);
}

root?.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("[data-play],[data-join]");
  if (!btn || btn.hasAttribute("disabled")) return;
  setNotice("");
  if (btn.dataset.join) {
    if (btn.dataset.locked === "1") {
      ensurePasswordModal().open(btn.dataset.host || "", btn.dataset.join, btn.dataset.view === "3d");
      return;
    }
    const result = await startPlay("join", {
      roomId: btn.dataset.join,
      view3d: btn.dataset.view === "3d",
    });
    if (!result.ok) setNotice(result.error || "Join failed.");
    return;
  }
  if (btn.dataset.play) {
    const result = await startPlay(btn.dataset.play, { view3d: btn.dataset.view === "3d" });
    if (!result.ok) setNotice(result.error || "Could not start match.");
  }
});

refresh().catch((err) => {
  console.error(err);
  setNotice("Failed to load games menu.");
});

installCommunityPanel().catch(() => {});
