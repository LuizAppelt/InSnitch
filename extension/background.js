// InSnitch Background Service Worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "RELOAD_TAB_FOR_NEXT_PASS") {
    const tabId = sender.tab ? sender.tab.id : request.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: "Tab ID not found" });
      return;
    }

    chrome.tabs.reload(tabId, {}, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "CLEAR_AUTO_SESSION") {
    chrome.storage.local.remove(["insnitch_auto_session"], () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
