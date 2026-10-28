(function () {
  const statusEl = document.getElementById("site-status");
  const pauseBtn = document.getElementById("site-pause");
  const concedeBtn = document.getElementById("site-concede");
  const reportBtn = document.getElementById("site-report");
  const chatForm = document.getElementById("site-chat-form");
  const chatInput = document.getElementById("site-chat-input");
  const chatLog = document.getElementById("site-chat-log");
  const origin = typeof SITE_ORIGIN === "string" ? SITE_ORIGIN : "";
  if (typeof io !== "function") return;
  const socket = origin ? io(origin, { withCredentials: true }) : io({ withCredentials: true });

  function appendChat(line) {
    if (!chatLog || !line) return;
    const li = document.createElement("li");
    li.textContent = (line.name ? line.name + ": " : "") + (line.text || "");
    chatLog.appendChild(li);
  }

  socket.on("lobby", (lobby) => {
    if (!lobby) return;
    if (statusEl) statusEl.textContent = lobby.status === "playing" ? "In match" : (lobby.status || "");
    if (reportBtn) reportBtn.hidden = !lobby.canReport;
    if (chatForm) chatForm.hidden = !lobby.chatEnabled;
  });
  socket.on("chat", appendChat);
  socket.on("go-home", () => {
    const home = typeof RETURN_URL === "string" && RETURN_URL ? RETURN_URL : "/games";
    window.location = home;
  });

  pauseBtn?.addEventListener("click", () => socket.emit("pause"));
  concedeBtn?.addEventListener("click", () => socket.emit("concede"));
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
