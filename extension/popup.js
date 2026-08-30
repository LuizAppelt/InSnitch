const BACKEND_URL = "http://127.0.0.1:8000";

let currentDetectedUsername = null;
let currentTabId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await checkBackendStatus();
  await detectActiveTabProfile();
  setupEventListeners();
});

// 1. Check if local FastAPI backend is running
async function checkBackendStatus() {
  const badge = document.getElementById("backend-status");
  const text = document.getElementById("backend-status-text");

  try {
    const res = await fetch(`${BACKEND_URL}/api/profiles`, { method: "GET" });
    if (res.ok) {
      badge.className = "status-badge online";
      text.innerText = "Dashboard Online";
      return true;
    }
  } catch (e) {
    // Backend offline
  }

  badge.className = "status-badge offline";
  text.innerText = "Dashboard Offline";
  return false;
}

// 2. Detect profile in active tab
async function detectActiveTabProfile() {
  const usernameEl = document.getElementById("detected-username");
  const hintEl = document.getElementById("tab-hint");
  const btnSync = document.getElementById("btn-sync");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    usernameEl.innerText = "Nenhuma aba ativa";
    return;
  }

  currentTabId = tab.id;

  if (!tab.url.includes("instagram.com")) {
    usernameEl.innerText = "Instagram não aberto";
    hintEl.innerText = "Abra uma aba no instagram.com para sincronizar.";
    btnSync.disabled = true;
    return;
  }

  // Extract username from URL
  try {
    const url = new URL(tab.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const reserved = ["explore", "direct", "reels", "stories", "accounts", "p", "reel", "tv"];

    if (pathParts.length > 0 && !reserved.includes(pathParts[0].toLowerCase())) {
      currentDetectedUsername = pathParts[0].toLowerCase();
      usernameEl.innerText = `@${currentDetectedUsername}`;
      hintEl.innerText = "Pronto para sincronizar seguidores e seguindo.";
      btnSync.disabled = false;
    } else {
      usernameEl.innerText = "Feed / Página Inicial";
      hintEl.innerText = "Navegue até a página de um perfil para coletar.";
      btnSync.disabled = true;
    }
  } catch (e) {
    usernameEl.innerText = "Erro na leitura";
  }
}

// 3. Listen for real-time status and completion events from content script
chrome.runtime.onMessage.addListener((msg) => {
  const progressBox = document.getElementById("progress-box");
  const progressText = document.getElementById("progress-text");
  const resultCard = document.getElementById("result-card");
  const errorBox = document.getElementById("error-box");
  const errorText = document.getElementById("error-text");
  const btnSync = document.getElementById("btn-sync");

  if (msg.action === "UPDATE_STATUS") {
    if (progressText) progressText.innerText = msg.message;
  }

  if (msg.action === "SYNC_COMPLETE") {
    const counts = msg.result?.diff?.counts || {};
    if (progressBox) progressBox.classList.add("hidden");
    if (resultCard) resultCard.classList.remove("hidden");
    if (errorBox) errorBox.classList.add("hidden");

    document.getElementById("res-new").innerText = `+${counts.new_followers_count || 0}`;
    document.getElementById("res-lost").innerText = `-${counts.lost_followers_count || 0}`;
    document.getElementById("res-following").innerText = `+${counts.new_following_count || 0}`;
    document.getElementById("res-not-following").innerText = (counts.not_following_back_count || 0).toLocaleString();
    if (btnSync) btnSync.disabled = false;
  }

  if (msg.action === "SYNC_ERROR") {
    if (progressBox) progressBox.classList.add("hidden");
    if (errorBox) errorBox.classList.remove("hidden");
    if (errorText) errorText.innerText = msg.error || "Erro durante a sincronização.";
    if (btnSync) btnSync.disabled = false;
  }
});

// 4. Setup Buttons and Extraction
function setupEventListeners() {
  const btnSync = document.getElementById("btn-sync");
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");
  const btnToggleOptions = document.getElementById("btn-toggle-options");
  const optionsPanel = document.getElementById("options-panel");
  const optionsArrow = document.getElementById("options-arrow");
  const selectMode = document.getElementById("select-scan-mode");
  const selectLimit = document.getElementById("select-scan-limit");

  // Load saved options
  const savedMode = localStorage.getItem("insnitch_scan_mode") || "safe";
  const savedLimit = localStorage.getItem("insnitch_scan_limit") || "3000";
  if (selectMode) selectMode.value = savedMode;
  if (selectLimit) selectLimit.value = savedLimit;

  if (selectMode) {
    selectMode.addEventListener("change", () => {
      localStorage.setItem("insnitch_scan_mode", selectMode.value);
    });
  }

  if (selectLimit) {
    selectLimit.addEventListener("change", () => {
      localStorage.setItem("insnitch_scan_limit", selectLimit.value);
    });
  }

  if (btnToggleOptions && optionsPanel) {
    btnToggleOptions.addEventListener("click", () => {
      const isHidden = optionsPanel.classList.toggle("hidden");
      if (optionsArrow) optionsArrow.innerText = isHidden ? "▸" : "▾";
    });
  }

  btnSync.addEventListener("click", async () => {
    if (!currentDetectedUsername || !currentTabId) return;

    const progressBox = document.getElementById("progress-box");
    const progressText = document.getElementById("progress-text");
    const resultCard = document.getElementById("result-card");
    const errorBox = document.getElementById("error-box");

    progressBox.classList.remove("hidden");
    resultCard.classList.add("hidden");
    errorBox.classList.add("hidden");
    btnSync.disabled = true;
    progressText.innerText = "Iniciando coleta na aba ativa...";

    // Determine delay and limit from options
    const mode = selectMode ? selectMode.value : "safe";
    const limit = selectLimit ? parseInt(selectLimit.value) : 3000;
    const delay = mode === "fast" ? 350 : 650;

    try {
      // Ensure content script is injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          files: ['content.js']
        });
      } catch (e) {}

      chrome.tabs.sendMessage(
        currentTabId,
        { 
          action: "EXTRACT_ALL_DATA", 
          username: currentDetectedUsername,
          options: { delay, maxLimit: limit }
        }
      );
    } catch (err) {
      progressBox.classList.add("hidden");
      errorBox.classList.remove("hidden");
      document.getElementById("error-text").innerText = "Recarregue a página do Instagram (F5) e tente novamente.";
      btnSync.disabled = false;
    }
  });

  btnOpenDashboard.addEventListener("click", () => {
    const targetUrl = currentDetectedUsername 
      ? `${BACKEND_URL}/?profile=${encodeURIComponent(currentDetectedUsername)}` 
      : BACKEND_URL;
    chrome.tabs.create({ url: targetUrl });
  });
}
