// settings.js — the ONLY file that reads/writes chrome.storage.sync.
// Architecture rule: no global variables for state; always read fresh.

const DEFAULTS = Object.freeze({
  idleMinutes: 5,
  minTabsThreshold: 0,
  skipPinned: true,
  skipAudible: true,
  sleepOnStartup: true,
  paused: false,
  whitelist: [],
  starGiven: false,
  nextStarPromptTime: 0,
});

/**
 * Read settings from sync storage, merged with defaults.
 * Missing keys get their default value automatically.
 * @returns {Promise<Object>} settings object
 */
async function getSettings() {
  try {
    const data = await chrome.storage.sync.get(DEFAULTS);
    return data;
  } catch (err) {
    console.error("[Tab Sleeper] getSettings failed, using defaults:", err);
    return { ...DEFAULTS };
  }
}

/**
 * Save a partial settings object to sync storage.
 * Only the keys you pass are updated; others stay untouched.
 * Validates idleMinutes to BR-10 range (1–1440).
 * @param {Object} partial — keys to update
 * @returns {Promise<boolean>} true if saved, false on validation error
 */
async function saveSettings(partial) {
  // Validate idleMinutes if provided
  if ("idleMinutes" in partial) {
    const val = Number(partial.idleMinutes);
    if (!Number.isFinite(val) || val < 1 || val > 1440) {
      console.warn("[Tab Sleeper] idleMinutes out of range (1–1440):", partial.idleMinutes);
      return false;
    }
    partial.idleMinutes = Math.round(val);
  }

  try {
    await chrome.storage.sync.set(partial);
    return true;
  } catch (err) {
    console.error("[Tab Sleeper] saveSettings failed:", err);
    return false;
  }
}

export { DEFAULTS, getSettings, saveSettings };
