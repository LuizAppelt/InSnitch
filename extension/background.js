// InSnitch Background Service Worker
let pendingReloadTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "RELOAD_TAB_FOR_NEXT_PASS") {
    const tabId = sender.tab ? sender.tab.id : request.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: "Tab ID not found" });
      return;
    }

    pendingReloadTabId = tabId;
    chrome.storage.local.set({ insnitch_auto_session: request.sessionState }, () => {
      chrome.tabs.reload(tabId, {}, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (request.action === "CLEAR_AUTO_SESSION") {
    pendingReloadTabId = null;
    chrome.storage.local.remove(["insnitch_auto_session"], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Detect when tab finishes reloading to resume auto-session
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === pendingReloadTabId && changeInfo.status === "complete") {
    pendingReloadTabId = null;

    // Give Instagram 2.2 seconds to initialize scripts & CSRF tokens
    setTimeout(async () => {
      try {
        chrome.tabs.sendMessage(tabId, { action: "RESUME_AUTO_SESSION" }, (response) => {
          if (chrome.runtime.lastError) {
            // Re-inject content.js if necessary
            chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            }, () => {
              chrome.tabs.sendMessage(tabId, { action: "RESUME_AUTO_SESSION" });
            });
          }
        });
      } catch (err) {
        console.warn("[InSnitch Background] Erro ao retomar sessão:", err);
      }
    }, 2200);
  }
});
