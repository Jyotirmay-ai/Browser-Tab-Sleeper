import { getSettings } from "./lib/settings.js";

const KEY = "lastActive"; // { tabId: timestamp }

// ---- Session-storage helpers (lastActive map) ----

async function getMap() {
  try {
    const data = await chrome.storage.session.get(KEY);
    return data[KEY] || {};
  } catch (err) {
    console.error("[Tab Sleeper] getMap failed:", err);
    return {};
  }
}

async function setMap(map) {
  try {
    await chrome.storage.session.set({ [KEY]: map });
  } catch (err) {
    console.error("[Tab Sleeper] setMap failed:", err);
  }
}

async function touch(tabId) {
  const map = await getMap();
  map[tabId] = Date.now();
  await setMap(map);
}

// ---- Badge ----

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.filter(t => t.discarded).length;
    if (count > 0) {
      await chrome.action.setBadgeText({ text: count.toString() });
      await chrome.action.setBadgeBackgroundColor({ color: "#6c72ff" });
    } else {
      await chrome.action.setBadgeText({ text: "" });
    }
  } catch (err) {
    console.error("[Tab Sleeper] updateBadge failed:", err);
  }
}

// ---- Grayscale Favicon ----

async function getGrayscaleFavicon(url) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      data[i] = data[i+1] = data[i+2] = v;
    }
    ctx.putImageData(imgData, 0, 0);
    
    const outBlob = await canvas.convertToBlob({ type: "image/png" });
    const buffer = await outBlob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } catch (err) {
    return null;
  }
}

async function sleepTab(tab) {
  if (tab.favIconUrl) {
    const grayUrl = await getGrayscaleFavicon(tab.favIconUrl);
    if (grayUrl) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (url) => {
            let links = Array.from(document.querySelectorAll("link[rel*='icon']"));
            if (links.length > 0) links.forEach(l => l.remove());
            const link = document.createElement("link");
            link.rel = "icon";
            link.href = url;
            document.head.appendChild(link);
          },
          args: [grayUrl]
        });
        await new Promise(r => setTimeout(r, 100)); // allow DOM to update
      } catch (e) {
        // e.g., missing permission for chrome:// pages, ignore
      }
    }
  }
  await chrome.tabs.discard(tab.id);
}

// ---- Lifecycle ----

function canSleep(tab, settings) {
  if (tab.active || tab.discarded) return false;
  if (settings.skipPinned && tab.pinned) return false;
  if (settings.skipAudible && tab.audible) return false;
  if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://"))) return false;

  // BR-06: whitelisted domains are never discarded
  if (tab.url && settings.whitelist.length > 0) {
    const host = hostnameOf(tab.url);
    if (settings.whitelist.some(domain => host === domain || host.endsWith("." + domain))) {
      return false;
    }
  }
  return true;
}

// Mark every open tab as "just used" when the extension starts
async function init() {
  try {
    const settings = await getSettings();
    const isColdStart = !(await chrome.storage.session.get("hasStarted")).hasStarted;
    if (isColdStart) await chrome.storage.session.set({ hasStarted: true });

    const tabs = await chrome.tabs.query({});
    const map = await getMap();
    const now = Date.now();
    
    const meetsThreshold = tabs.length > (settings.minTabsThreshold || 0);

    for (const t of tabs) {
      if (isColdStart && settings.sleepOnStartup && meetsThreshold && canSleep(t, settings)) {
        try { await sleepTab(t); } catch (e) { /* ignore */ }
      } else {
        if (!map[t.id]) map[t.id] = now;
      }
    }
    
    await setMap(map);
    await chrome.alarms.create("check", { periodInMinutes: 1 });
    await updateBadge();
  } catch (err) {
    console.error("[Tab Sleeper] init failed:", err);
  }
}
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboarding/welcome.html") });
  }
  init();
});
chrome.runtime.onStartup.addListener(init);

// ---- Tab event listeners ----

// Tab became active -> reset its timer
chrome.tabs.onActivated.addListener(({ tabId }) => touch(tabId));

// Tab finished loading / changed -> reset its timer
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") {
    touch(tabId);
    updateBadge(); // Tab might have woken up
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const map = await getMap();
  delete map[tabId];
  await setMap(map);
  updateBadge();
});

// ---- Alarm: discard idle tabs ----

/**
 * Extract hostname from a URL string.
 * Returns empty string if URL is invalid.
 */
function hostnameOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "check") return;

  try {
    const settings = await getSettings();

    // BR-07: when paused, do nothing
    if (settings.paused) return;

    const map = await getMap();
    const tabs = await chrome.tabs.query({});
    
    // Only sleep tabs if we have more than the threshold
    if (tabs.length <= (settings.minTabsThreshold || 0)) return;

    const limit = settings.idleMinutes * 60 * 1000;
    const now = Date.now();

    for (const tab of tabs) {
      if (!canSleep(tab, settings)) continue;

      const last = map[tab.id] ?? now;
      if (now - last >= limit) {
        try { await sleepTab(tab); } catch (e) { /* tab may already be gone */ }
      }
    }
    
    await updateBadge();
  } catch (err) {
    console.error("[Tab Sleeper] alarm check failed:", err);
  }
});

// ---- React to settings changes instantly ----
// No action needed per tick — we read fresh settings every alarm.
// This listener is here so future features (badge update, etc.) can react.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  console.log("[Tab Sleeper] settings changed:", Object.keys(changes).join(", "));
});

// ---- Message listener for manual sleep ----
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "sleep_tab") {
    chrome.tabs.get(req.tabId).then(async tab => {
      // Chrome forbids discarding the active tab.
      // So we open a New Tab to shift focus away, then sleep it.
      if (tab.active) {
        await chrome.tabs.create({ windowId: tab.windowId });
      }
      
      sleepTab(tab).then(() => {
        updateBadge();
        sendResponse({ success: true });
      }).catch(err => {
        sendResponse({ success: false, error: err.toString() });
      });
    }).catch(() => sendResponse({ success: false }));
    return true; // async response
  }
  
  if (req.action === "sleep_other_tabs") {
    chrome.tabs.query({}).then(async tabs => {
      for (const tab of tabs) {
        if (tab.id !== req.activeTabId && !tab.active && !tab.discarded) {
          // You could enforce `canSleep` here or just sleep everything except active.
          // Let's force sleep them (except internal pages).
          if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://"))) continue;
          try { await sleepTab(tab); } catch (e) {}
        }
      }
      updateBadge();
      sendResponse({ success: true });
    });
    return true;
  }
});

// ---- Keyboard Shortcuts ----
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "sleep-current-tab") {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      await chrome.tabs.create({ windowId: tab.windowId });
      await sleepTab(tab);
      await updateBadge();
    } catch (e) {
      console.error("[Tab Sleeper] Command failed:", e);
    }
  }
});
