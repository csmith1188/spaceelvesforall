(function () {
  const statusEl = document.getElementById("lobby-status");
  const opponentEl = document.getElementById("lobby-opponent");
  const titleEl = document.getElementById("lobby-title");
  const startBtn = document.getElementById("site-start");
  const pauseBtn = document.getElementById("site-pause");
  const concedeBtn = document.getElementById("site-concede");
  const reportBtn = document.getElementById("site-report");
  const chatForm = document.getElementById("site-chat-form");
  const chatInput = document.getElementById("site-chat-input");
  const chatLog = document.getElementById("site-chat-log");
  const socket = io({ withCredentials: true });
  let redirected = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || "";
  }

  function appendChat(line) {
    if (!chatLog || !line) return;
    const li = document.createElement("li");
    li.textContent = (line.name ? line.name + ": " : "") + (line.text || "");
    chatLog.appendChild(li);
  }

  function goPlay(url) {
    if (redirected || !url) return;
    redirected = true;
    setStatus("Starting…");
    window.location = url;
  }

  socket.on("lobby", (lobby) => {
    if (!lobby) return;
    if (lobby.playUrl) goPlay(lobby.playUrl);
    if (titleEl && lobby.match && lobby.match.matchLabel) titleEl.textContent = lobby.match.matchLabel;
    const names = (lobby.players || []).map((seat) => seat && seat.name).filter(Boolean);
    if (opponentEl) opponentEl.textContent = names.length ? names.join(" · ") : "Waiting for players";
    if (lobby.status === "countdown") setStatus("Starting soon");
    else if (lobby.status === "playing") setStatus("Match in progress");
    else setStatus("Waiting");
    if (startBtn) startBtn.hidden = !lobby.canStart;
    if (pauseBtn) pauseBtn.hidden = lobby.status !== "playing";
    if (reportBtn) reportBtn.hidden = !lobby.canReport;
    if (chatForm) chatForm.hidden = !lobby.chatEnabled;
    if (lobby.chatHistory && chatLog && !chatLog.childElementCount) {
      lobby.chatHistory.forEach(appendChat);
    }
  });

  socket.on("chat", appendChat);
  socket.on("go-home", () => {
    window.location = "/games";
  });

  startBtn?.addEventListener("click", () => socket.emit("startMatch"));
  pauseBtn?.addEventListener("click", () => socket.emit("pause"));
  concedeBtn?.addEventListener("click", () => socket.emit("leave"));
  reportBtn?.addEventListener("click", () => {
    const text = window.prompt("Report your opponent");
    if (text) socket.emit("report", { text });
  });
  chatForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const text = (chatInput && chatInput.value || "").trim();
    if (!text) return;
    socket.emit("chat", { text });
    if (chatInput) chatInput.value = "";
  });
})();
