/**
 * Seat lifecycle for a Space Elves match. The sim runs in index_game.js.
 * Countdown does not charge tickets. Match end does not write MMR.
 */
import { randomUUID } from "node:crypto";
import { allowSocketEvent } from "./commandLimit.js";
import {
  allowChat,
  chatHistoryMax,
  encodeChatJson,
  matchChatEnabled,
  sanitizeChatText,
  serializeChatLog,
} from "./chat.js";
import { createPlayerReport } from "./db.js";
import { child as childLogger, safeLog } from "./logger.js";
import {
  matchOptionsSummary,
  matchTypeSeats,
  normalizeLobbyPassword,
  normalizeMatchOptions,
} from "../shared/matchOptions.js";
import { sendMatchControl, spawnMatch, stopMatch } from "./gameProcess.js";

export const COUNTDOWN_MS = Number(process.env.COUNTDOWN_MS) || 10000;
export const BOT_COUNTDOWN_MS = Number(process.env.BOT_COUNTDOWN_MS) || 5000;
export const UNPAUSE_MS = Number(process.env.UNPAUSE_MS) || 60000;
export const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 5000;
export const RECONNECT_WAIT_MS = Number(process.env.RECONNECT_WAIT_MS) || 60000;

const SEAT_KEYS = ["a", "b", "c", "d"];

function emptySeat(key) {
  return {
    key,
    userId: null,
    name: null,
    accountId: null,
    formbarId: null,
    mmr: null,
    officerRank: null,
    placementsDone: false,
    socket: null,
    bot: null,
    queue: [],
    chatBucket: null,
    alreadyReported: false,
  };
}

function publicIdentity(seat) {
  if (!seat || !seat.userId) return null;
  return {
    name: seat.name,
    officerRank: seat.officerRank || null,
    placementsDone: Boolean(seat.placementsDone),
    mmr: seat.placementsDone ? seat.mmr : null,
    bot: Boolean(seat.bot),
  };
}

export class GameRoom {
  constructor(matchmaker, io, mode, options = {}) {
    this.matchmaker = matchmaker;
    this.io = io;
    this.mode = mode;
    this.id = randomUUID();
    this.roomName = `game:${this.id}`;
    this.status = "waiting";
    this.createdAt = Date.now();
    this.startedAt = null;
    this.closing = false;
    this.recorded = false;
    this.charged = false;
    this.paid = false;
    this.view3d = false;
    this.log = childLogger({ component: "room", matchId: this.id, mode });
    this.matchOptions = normalizeMatchOptions(options.matchOptions || {});
    this.matchType = this.mode === "listed" ? this.matchOptions.matchType : "ForHonorMP";
    this.maxSeats = this.matchType === "ForEver" ? matchTypeSeats("ForEver") : 2;
    this.lobbyPassword = normalizeLobbyPassword(options.lobbyPassword || "");
    this.seat = {};
    for (let i = 0; i < SEAT_KEYS.length; i += 1) {
      this.seat[SEAT_KEYS[i]] = emptySeat(SEAT_KEYS[i]);
    }
    this.countdownTimer = null;
    this.countdownEnds = null;
    this.playUrl = null;
    this.gamePort = null;
    this.paused = false;
    this.pauseVotes = new Set();
    this.unpauseVotes = new Set();
    this.unpauseTimer = null;
    this.unpauseEnds = null;
    this.disconnectGraceTimer = null;
    this.reconnectWaitTimer = null;
    this.reconnectWaitEnds = null;
    this.reconnectWaitSeat = null;
    this.chatLog = [];
    this.maintenanceAlert = null;
  }

  seatedUserIds() {
    const ids = [];
    for (const key of this.activeKeys()) {
      const seat = this.seat[key];
      if (seat && seat.userId) ids.push(seat.userId);
    }
    return ids;
  }

  activeKeys() {
    return SEAT_KEYS.slice(0, this.maxSeats);
  }

  humans() {
    return this.activeKeys()
      .map((key) => this.seat[key])
      .filter((seat) => seat && seat.userId && !seat.bot);
  }

  hasOpenSeat() {
    return Boolean(this.nextOpenSeatKey());
  }

  nextOpenSeatKey() {
    for (const key of this.activeKeys()) {
      const seat = this.seat[key];
      if (!seat.userId && !seat.bot) return key;
    }
    return null;
  }

  shouldAutoStart() {
    if (this.matchType === "ForEver") return false;
    return Boolean(this.seat.b.userId || this.seat.b.bot);
  }

  isLocked() {
    return Boolean(this.lobbyPassword);
  }

  acceptsLobbyPassword(password) {
    if (!this.lobbyPassword) return true;
    return normalizeLobbyPassword(password) === this.lobbyPassword;
  }

  matchOptionsPublic() {
    const summary = matchOptionsSummary({ matchType: this.matchType });
    summary.seatsFilled = this.humans().length + (this.seat.b.bot ? 1 : 0);
    summary.seatsMax = this.maxSeats;
    return summary;
  }

  seatForUser(userId) {
    if (!userId) return null;
    for (const key of this.activeKeys()) {
      const seat = this.seat[key];
      if (seat.userId === userId) return seat;
    }
    return null;
  }

  seatBySocket(socket) {
    if (!socket) return null;
    for (const key of this.activeKeys()) {
      if (this.seat[key].socket === socket) return this.seat[key];
    }
    return null;
  }

  clearSeat(seat) {
    if (!seat) return;
    const key = seat.key;
    this.seat[key] = emptySeat(key);
  }

  fillSeat(key, user, socket, bot) {
    const seat = this.seat[key];
    seat.userId = user.id;
    seat.name = user.name;
    seat.accountId = user.accountId || null;
    seat.formbarId = user.formbarId || null;
    seat.mmr = user.mmr;
    seat.officerRank = user.officerRank || null;
    seat.placementsDone = Boolean(user.placementsDone);
    seat.socket = socket || null;
    seat.bot = bot ? { name: "Bot" } : null;
    if (socket) {
      socket.join(this.roomName);
      socket.data.gameId = this.id;
      socket.data.seatKey = key;
      this.matchmaker.rememberUserRoom(user.id, this);
    }
    return seat;
  }

  seatHuman(key, socket) {
    const user = socket && socket.data && socket.data.user;
    if (!user) return null;
    const previous = this.seat[key].socket;
    if (previous && previous !== socket) {
      previous.data.replaced = true;
      try { previous.emit("replaced"); } catch { /* ignore */ }
      previous.disconnect(true);
    }
    return this.fillSeat(key, user, socket, false);
  }

  seatBot(key) {
    return this.fillSeat(key, {
      id: `bot:${this.id}:${key}`,
      name: "Bot",
      accountId: null,
      formbarId: null,
      mmr: null,
      officerRank: null,
      placementsDone: false,
    }, null, true);
  }

  seatReserved(key, entry) {
    return this.fillSeat(key, {
      id: entry.userId,
      name: entry.name,
      accountId: entry.accountId,
      formbarId: entry.formbarId,
      mmr: entry.mmr,
      officerRank: entry.officerRank,
      placementsDone: entry.placementsDone,
    }, entry.socket && entry.socket.connected ? entry.socket : null, false);
  }

  attach(socket) {
    const user = socket.data && socket.data.user;
    const seat = user && this.seatForUser(user.id);
    if (!seat) return;
    this.seatHuman(seat.key, socket);
    this.clearDisconnectForSeat(seat.key);
    this.pushLobby();
  }

  clearDisconnectForSeat(key) {
    if (this.reconnectWaitSeat === key) {
      if (this.reconnectWaitTimer) clearTimeout(this.reconnectWaitTimer);
      this.reconnectWaitTimer = null;
      this.reconnectWaitEnds = null;
      this.reconnectWaitSeat = null;
      sendMatchControl(this.id, { type: "match.pause", paused: this.paused });
    }
  }

  roomChatActive() {
    if (!matchChatEnabled()) return false;
    const humans = this.humans();
    if (humans.length < 2) return false;
    if (humans.some((seat) => !seat.accountId)) return false;
    if (this.seat.b.bot) return false;
    return true;
  }

  systemChat(text, extra = {}) {
    const line = {
      kind: "system",
      text: String(text || ""),
      at: Date.now(),
      ...extra,
    };
    this.chatLog.push(line);
    if (this.chatLog.length > chatHistoryMax()) this.chatLog.shift();
    this.io.to(this.roomName).emit("chat", line);
  }

  announceMaintenance(line) {
    this.maintenanceAlert = line;
    this.systemChat(line, { force: true, maintenanceAlert: true });
    this.pushLobby();
  }

  chat(socket, payload) {
    if (!allowSocketEvent(socket, "chat")) return;
    const seat = this.seatBySocket(socket);
    if (!seat || !this.roomChatActive()) return;
    if (!allowChat(seat)) return;
    const text = sanitizeChatText(payload && payload.text != null ? payload.text : payload);
    if (!text) return;
    const line = { kind: "user", name: seat.name, text, at: Date.now() };
    this.chatLog.push(line);
    if (this.chatLog.length > chatHistoryMax()) this.chatLog.shift();
    this.io.to(this.roomName).emit("chat", line);
  }

  chatArchiveJson() {
    return encodeChatJson(this.chatLog);
  }

  chatArchivePublic() {
    return serializeChatLog(this.chatLog);
  }

  lobbyFor(seat) {
    const others = this.humans().filter((s) => s !== seat);
    const opponent = this.seat.b.bot
      ? { name: "Bot", bot: true }
      : (others[0] ? publicIdentity(others[0]) : null);
    return {
      you: publicIdentity(seat),
      opponent,
      players: this.humans().map(publicIdentity).filter(Boolean),
      status: this.status,
      mode: this.mode,
      matchType: this.matchType,
      match: this.matchOptionsPublic(),
      countdownMs: this.countdownLeftMs(),
      playUrl: this.playUrl,
      canPause: this.status === "playing",
      paused: this.paused,
      unpauseMs: this.unpauseEnds ? Math.max(0, this.unpauseEnds - Date.now()) : null,
      reconnectMs: this.reconnectWaitEnds ? Math.max(0, this.reconnectWaitEnds - Date.now()) : null,
      chatEnabled: this.roomChatActive(),
      chatHistory: this.chatLog.slice(-chatHistoryMax()),
      canReport: this.canReportFrom(seat),
      alreadyReported: Boolean(seat && seat.alreadyReported),
      canStart: this.matchType === "ForEver" && seat && seat.key === "a" && this.status === "waiting",
      maintenanceAlert: this.maintenanceAlert,
      host: Boolean(seat && seat.key === "a"),
    };
  }

  countdownLeftMs() {
    if (!this.countdownEnds) return null;
    return Math.max(0, this.countdownEnds - Date.now());
  }

  pushLobby() {
    for (const seat of this.humans()) {
      if (seat.socket) seat.socket.emit("lobby", this.lobbyFor(seat));
    }
  }

  broadcastState() {
    this.pushLobby();
  }

  canReportFrom(seat) {
    if (!seat || !seat.accountId || seat.bot) return false;
    return this.humans().some((other) => other !== seat && other.accountId && !other.bot);
  }

  async report(socket, payload) {
    if (!allowSocketEvent(socket, "report")) {
      socket.emit("reportResult", { ok: false, error: "rate_limited" });
      return;
    }
    const seat = this.seatBySocket(socket);
    if (!seat || !seat.accountId) {
      socket.emit("reportResult", { ok: false, error: "login_required" });
      return;
    }
    const other = this.humans().find((s) => s !== seat && s.accountId && !s.bot);
    if (!other) {
      socket.emit("reportResult", { ok: false, error: "not_reportable" });
      return;
    }
    if (seat.alreadyReported) {
      socket.emit("reportResult", { ok: false, error: "already_reported" });
      return;
    }
    const raw = payload && typeof payload === "object" ? payload.text : payload;
    const result = await createPlayerReport({
      reporterAccountId: seat.accountId,
      reporterName: seat.name,
      reportedAccountId: other.accountId,
      reportedName: other.name,
      matchId: this.id,
      matchMode: this.mode,
      body: raw,
    });
    if (!result.ok) {
      if (result.error === "already_reported") seat.alreadyReported = true;
      socket.emit("reportResult", { ok: false, error: result.error || "failed" });
      return;
    }
    seat.alreadyReported = true;
    socket.emit("reportResult", { ok: true, id: result.id });
    socket.emit("lobby", this.lobbyFor(seat));
  }

  countdownDurationMs() {
    if (this.mode === "bot") return BOT_COUNTDOWN_MS;
    if (this.mode === "training" && this.seat.b.bot) return BOT_COUNTDOWN_MS;
    return COUNTDOWN_MS;
  }

  cancelCountdown() {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
  }

  async startCountdown() {
    if (this.status !== "waiting" || this.closing) return false;
    this.paid = false;
    this.charged = false;
    this.status = "countdown";
    const wait = this.countdownDurationMs();
    this.countdownEnds = Date.now() + wait;
    safeLog(this.log, "info", { event: "match_countdown", waitMs: wait }, "match countdown started");
    this.pushLobby();
    this.countdownTimer = setTimeout(() => {
      this.beginPlay().catch((err) => {
        safeLog(this.log, "error", { event: "match_start_failed", err: String(err && err.message || err) }, "beginPlay failed");
      });
    }, wait);
    return true;
  }

  async beginPlay() {
    if (this.status !== "countdown" || this.closing) return;
    this.countdownTimer = null;
    this.status = "playing";
    this.countdownEnds = null;
    if (this.startedAt == null) this.startedAt = Date.now();
    const seatIds = this.humans().map((seat) => seat.userId);
    const thisUrl = process.env.THIS_URL || "http://localhost:3000";
    const masterPort = this.matchmaker && this.matchmaker.masterPort
      ? this.matchmaker.masterPort
      : (Number(process.env.PORT) || 3000);
    try {
      const spawned = await spawnMatch({
        matchId: this.id,
        matchType: this.matchType,
        seatIds,
        thisUrl,
        masterPort,
      });
      this.gamePort = spawned.port;
      this.playUrl = spawned.url;
    } catch (err) {
      safeLog(this.log, "error", { event: "game_spawn_failed", err: String(err && err.message || err) }, "game spawn failed");
      this.systemChat("Could not start the match.");
      this.endWithoutResult("spawn_failed");
      return;
    }
    safeLog(this.log, "info", {
      event: "match_started",
      matchType: this.matchType,
      playUrl: this.playUrl,
    }, "match started");
    this.pushLobby();
  }

  command() {}

  ackTelemetry() {}

  botSettings() {}

  debugPlay() {}

  settingsOpen(socket, open) {
    if (this.mode !== "bot" && !(this.mode === "training" && this.seat.b.bot)) return;
    const seat = this.seatBySocket(socket);
    if (!seat) return;
    this.paused = Boolean(open);
    sendMatchControl(this.id, { type: "match.pause", paused: this.paused });
    this.pushLobby();
  }

  pause(socket) {
    if (!allowSocketEvent(socket, "pause")) return;
    const seat = this.seatBySocket(socket);
    if (!seat || this.status !== "playing") return;
    if (this.seat.b.bot) {
      this.paused = !this.paused;
      sendMatchControl(this.id, { type: "match.pause", paused: this.paused });
      this.systemChat(this.paused ? "Match paused" : "Match resumed");
      this.pushLobby();
      return;
    }
    if (this.paused || this.unpauseEnds) {
      this.unpauseVotes.add(seat.key);
      const needed = this.humans().length;
      if (this.unpauseVotes.size >= needed) this.resumePlay();
      else {
        this.systemChat(`${seat.name || "Player"} wants to resume`);
        if (!this.unpauseTimer) {
          this.unpauseEnds = Date.now() + UNPAUSE_MS;
          this.unpauseTimer = setTimeout(() => this.resumePlay(), UNPAUSE_MS);
        }
      }
      this.pushLobby();
      return;
    }
    this.pauseVotes.add(seat.key);
    if (this.pauseVotes.size >= this.humans().length) {
      this.paused = true;
      this.pauseVotes.clear();
      sendMatchControl(this.id, { type: "match.pause", paused: true });
      this.systemChat("Match paused");
    } else {
      this.systemChat(`${seat.name || "Player"} wants to pause`);
    }
    this.pushLobby();
  }

  pauseSeen() {}

  resumePlay() {
    if (this.unpauseTimer) clearTimeout(this.unpauseTimer);
    this.unpauseTimer = null;
    this.unpauseEnds = null;
    this.unpauseVotes.clear();
    this.pauseVotes.clear();
    this.paused = false;
    sendMatchControl(this.id, { type: "match.pause", paused: false });
    this.systemChat("Match resumed");
    this.pushLobby();
  }

  leave(socket) {
    if (this.status === "dead" || this.closing) return;
    const seat = this.seatBySocket(socket);
    if (!seat) return;
    if (this.status === "playing") {
      this.endWithoutResult("leave");
      return;
    }
    this.matchmaker.abandonSeat(this, seat, { goHome: true }).catch(() => {});
  }

  concede(socket) {
    if (!allowSocketEvent(socket, "concede")) return;
    if (this.status !== "playing") {
      this.leave(socket);
      return;
    }
    this.systemChat(`${(this.seatBySocket(socket) || {}).name || "Player"} conceded`);
    this.endWithoutResult("concede");
  }

  disconnect(socket) {
    if (socket.data.replaced || this.status === "dead" || this.closing) return;
    const seat = this.seatBySocket(socket);
    if (!seat || seat.socket !== socket) return;
    if (this.status === "waiting" || this.status === "countdown") {
      this.matchmaker.abandonSeat(this, seat, { goHome: false }).catch(() => {});
      return;
    }
    seat.socket = null;
    this.systemChat(`${seat.name || "Player"} disconnected`);
    if (this.reconnectWaitTimer) clearTimeout(this.reconnectWaitTimer);
    this.reconnectWaitSeat = seat.key;
    this.reconnectWaitEnds = Date.now() + DISCONNECT_GRACE_MS + RECONNECT_WAIT_MS;
    sendMatchControl(this.id, { type: "match.pause", paused: true });
    this.pushLobby();
    this.reconnectWaitTimer = setTimeout(() => {
      if (seat.socket) return;
      this.systemChat(`${seat.name || "Player"} forfeited (disconnected)`);
      this.endWithoutResult("disconnect");
    }, DISCONNECT_GRACE_MS + RECONNECT_WAIT_MS);
  }

  endWithoutResult(reason) {
    if (this.closing || this.status === "dead") return;
    this.closing = true;
    this.cancelCountdown();
    safeLog(this.log, "info", { event: "match_ended", reason }, "match ended without ranked result");
    stopMatch(this.id);
    for (const seat of this.humans()) {
      if (seat.socket) {
        this.matchmaker.clearPlaySession(seat.socket);
        seat.socket.emit("go-home");
      }
    }
    this.destroy();
  }

  onProcessEnded() {
    if (this.status === "dead" || this.closing) return;
    this.systemChat("The match server stopped.");
    this.endWithoutResult("process_exit");
  }

  sendHome(socket) {
    if (!socket) return;
    this.matchmaker.clearPlaySession(socket);
    socket.emit("go-home");
  }

  destroy() {
    if (this.status === "dead") return;
    this.status = "dead";
    this.closing = true;
    this.cancelCountdown();
    if (this.unpauseTimer) clearTimeout(this.unpauseTimer);
    if (this.reconnectWaitTimer) clearTimeout(this.reconnectWaitTimer);
    if (this.disconnectGraceTimer) clearTimeout(this.disconnectGraceTimer);
    stopMatch(this.id);
    if (this.matchmaker) this.matchmaker.remove(this);
  }
}
