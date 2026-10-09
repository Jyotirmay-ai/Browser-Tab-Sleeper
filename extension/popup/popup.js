import { getSettings, saveSettings } from "../lib/settings.js";

// ---- DOM refs ----
const sleepCountEl = document.getElementById("sleepCount");
const pauseBanner  = document.getElementById("pauseBanner");
const pauseBtn     = document.getElementById("pauseBtn");
const pauseIcon    = document.getElementById("pauseIcon");
const pauseLabel   = document.getElementById("pauseLabel");
const whitelistBtn = document.getElementById("whitelistBtn");
const sleepBtn     = document.getElementById("sleepBtn");
const sleepAllBtn  = document.getElementById("sleepAllBtn");
const statusEl     = document.getElementById("status");
const optionsLink  = document.getElementById("optionsLink");

// ---- Count discarded (sleeping) tabs ----
async function updateSleepCount() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.filter(t => t.discarded).length;
    sleepCountEl.textContent = count;
  } catch (err) {
    console.error("[Tab Sleeper] count failed:", err);
    sleepCountEl.textContent = "—";
  }
}

// ---- Pause / Resume ----
async function updatePauseUI() {
  const s = await getSettings();
  const paused = s.paused;

  pauseBanner.classList.toggle("show", paused);
  pauseBtn.classList.toggle("paused", paused);
  pauseIcon.textContent = paused ? "▶" : "⏸";
  pauseLabel.textContent = paused ? "Resume sleeping" : "Pause sleeping";
}

pauseBtn.addEventListener("click", async () => {
  const s = await getSettings();
  await saveSettings({ paused: !s.paused });
  await updatePauseUI();
});

// ---- Sleep this tab now ----
sleepBtn.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Don't discard internal pages
    if (tab.url && (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://"))) {
      showStatus("Can't sleep browser pages");
      return;
    }

    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "sleep_tab", tabId: tab.id }, resolve);
    });

    showStatus("Tab put to sleep 💤");

    // Small delay then update count (discard is async)
    setTimeout(updateSleepCount, 300);
  } catch (err) {
    console.error("[Tab Sleeper] sleep-now failed:", err);
    showStatus("Couldn't sleep this tab");
  }
});

// ---- Sleep all other tabs ----
sleepAllBtn.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: "sleep_other_tabs", activeTabId: tab.id }, resolve);
    });
    showStatus("Other tabs sleeping 🧹");
    setTimeout(updateSleepCount, 500);
  } catch (err) {
    showStatus("Failed to sleep others");
  }
});

// ---- Never sleep this site ----
whitelistBtn.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) return;

    if (tab.url.startsWith("chrome://") || tab.url.startsWith("brave://")) {
      showStatus("Browser pages don't sleep anyway");
      return;
    }

    const host = new URL(tab.url).hostname;
    if (!host) {
      showStatus("Invalid domain");
      return;
    }

    const s = await getSettings();
    if (!s.whitelist.includes(host)) {
      const newList = [...s.whitelist, host];
      await saveSettings({ whitelist: newList });
    }
    showStatus("Site whitelisted 🛡️");
  } catch (err) {
    console.error("[Tab Sleeper] whitelist failed:", err);
    showStatus("Couldn't whitelist site");
  }
});

// ---- Settings link ----
optionsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ---- Status toast ----
let statusTimer = null;
function showStatus(msg) {
  clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.classList.add("show");
  statusTimer = setTimeout(() => statusEl.classList.remove("show"), 2000);
}

// ---- Init ----
updateSleepCount();
updatePauseUI();
