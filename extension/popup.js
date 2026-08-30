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

// 3. Listen for background status updates
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "UPDATE_STATUS") {
    const progressText = document.getElementById("progress-text");
    if (progressText) progressText.innerText = msg.message;
  }
});

// 4. Setup Buttons and Extraction
function setupEventListeners() {
  const btnSync = document.getElementById("btn-sync");
  const btnOpenDashboard = document.getElementById("btn-open-dashboard");

  btnSync.addEventListener("click", async () => {
    if (!currentDetectedUsername || !currentTabId) return;

    const progressBox = document.getElementById("progress-box");
    const progressText = document.getElementById("progress-text");
    const resultCard = document.getElementById("result-card");
    const errorBox = document.getElementById("error-box");
    const errorText = document.getElementById("error-text");

    progressBox.classList.remove("hidden");
    resultCard.classList.add("hidden");
    errorBox.classList.add("hidden");
    btnSync.disabled = true;
    progressText.innerText = "Iniciando coleta na aba ativa...";

    try {
      // Send message to content script in active tab
      chrome.tabs.sendMessage(
        currentTabId,
        { action: "EXTRACT_ALL_DATA", username: currentDetectedUsername },
        async (response) => {
          if (chrome.runtime.lastError) {
            progressBox.classList.add("hidden");
            errorBox.classList.remove("hidden");
            errorText.innerText = "Recarregue a página do Instagram (F5) e tente novamente.";
            btnSync.disabled = false;
            return;
          }

          if (!response || !response.success) {
            progressBox.classList.add("hidden");
            errorBox.classList.remove("hidden");
            errorText.innerText = response?.error || "Erro durante a extração dos dados.";
            btnSync.disabled = false;
            return;
          }

          progressText.innerText = "Enviando dados para o InSnitch...";

          // Send extracted data to local backend
          try {
            const backendRes = await fetch(`${BACKEND_URL}/api/extension/import`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(response.data)
            });

            if (!backendRes.ok) {
              const errData = await backendRes.json();
              throw new Error(errData.detail || "Falha ao gravar no dashboard.");
            }

            const importResult = await backendRes.json();
            const counts = importResult.diff?.counts || {};

            // Show Result
            progressBox.classList.add("hidden");
            resultCard.classList.remove("hidden");

            document.getElementById("res-new").innerText = `+${counts.new_followers_count || 0}`;
            document.getElementById("res-lost").innerText = `-${counts.lost_followers_count || 0}`;
            document.getElementById("res-following").innerText = `+${counts.new_following_count || 0}`;
            document.getElementById("res-not-following").innerText = (counts.not_following_back_count || 0).toLocaleString();

          } catch (backendErr) {
            progressBox.classList.add("hidden");
            errorBox.classList.remove("hidden");
            errorText.innerText = `Erro no Dashboard: ${backendErr.message}. Verifique se 'python run.py' está rodando.`;
            btnSync.disabled = false;
          }
        }
      );
    } catch (err) {
      progressBox.classList.add("hidden");
      errorBox.classList.remove("hidden");
      errorText.innerText = err.message;
      btnSync.disabled = false;
    }
  });

  btnOpenDashboard.addEventListener("click", () => {
    chrome.tabs.create({ url: BACKEND_URL });
  });
}
