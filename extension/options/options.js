import { getSettings, saveSettings, DEFAULTS } from "../lib/settings.js";

// ---- DOM refs ----
const idleInput  = document.getElementById("idleMinutes");
const thresholdInput = document.getElementById("minTabsThreshold");
const pinnedBox  = document.getElementById("skipPinned");
const audibleBox = document.getElementById("skipAudible");
const startupBox = document.getElementById("sleepOnStartup");
const saveBtn    = document.getElementById("saveBtn");
const statusEl   = document.getElementById("status");
const wlInput    = document.getElementById("wlInput");
const wlAddBtn   = document.getElementById("wlAddBtn");
const wlList     = document.getElementById("wlList");

let currentWhitelist = [];

// ---- Load saved settings into the form ----
async function loadForm() {
  const s = await getSettings();
  idleInput.value  = s.idleMinutes;
  thresholdInput.value = s.minTabsThreshold;
  pinnedBox.checked  = s.skipPinned;
  audibleBox.checked = s.skipAudible;
  startupBox.checked = s.sleepOnStartup;
  currentWhitelist = [...s.whitelist];
  renderWhitelist();
}

// ---- Show transient status message ----
let statusTimer = null;
function showStatus(msg, type) {
  clearTimeout(statusTimer);
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
  statusTimer = setTimeout(() => {
    statusEl.classList.remove("show");
  }, 2500);
}

function validateIdle() {
  const val = Number(idleInput.value);
  const valid = Number.isFinite(val) && val >= 1 && val <= 1440;
  idleInput.classList.toggle("invalid", !valid);
  
  const thresh = Number(thresholdInput.value);
  const validThresh = Number.isInteger(thresh) && thresh >= 0;
  thresholdInput.classList.toggle("invalid", !validThresh);
  
  return valid && validThresh;
}

// ---- Whitelist management ----
function renderWhitelist() {
  wlList.innerHTML = "";
  if (currentWhitelist.length === 0) {
    wlList.innerHTML = `<li class="wl-empty">No domains whitelisted yet</li>`;
    return;
  }
  
  currentWhitelist.forEach((domain, index) => {
    const li = document.createElement("li");
    li.className = "wl-item";
    
    const span = document.createElement("span");
    span.className = "domain";
    span.textContent = domain;
    
    const btn = document.createElement("button");
    btn.className = "wl-remove";
    btn.textContent = "×";
    btn.title = "Remove";
    btn.addEventListener("click", () => {
      currentWhitelist.splice(index, 1);
      renderWhitelist();
    });
    
    li.appendChild(span);
    li.appendChild(btn);
    wlList.appendChild(li);
  });
}

function addDomain() {
  let val = wlInput.value.trim().toLowerCase();
  if (!val) return;
  // Basic cleanup (remove protocol, path, etc)
  try {
    if (val.startsWith("http")) val = new URL(val).hostname;
  } catch(e) {}
  
  if (!currentWhitelist.includes(val)) {
    currentWhitelist.push(val);
    renderWhitelist();
  }
  wlInput.value = "";
}

wlAddBtn.addEventListener("click", addDomain);
wlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

// ---- Save handler ----
saveBtn.addEventListener("click", async () => {
  if (!validateIdle()) {
    showStatus("Idle time must be 1–1440 minutes", "error");
    return;
  }

  const ok = await saveSettings({
    idleMinutes: Number(idleInput.value),
    minTabsThreshold: Number(thresholdInput.value),
    skipPinned: pinnedBox.checked,
    skipAudible: audibleBox.checked,
    sleepOnStartup: startupBox.checked,
    whitelist: currentWhitelist,
  });

  if (ok) {
    showStatus("Settings saved ✓", "success");
  } else {
    showStatus("Failed to save — see console", "error");
  }
});

// Real-time validation feedback as user types
idleInput.addEventListener("input", validateIdle);
thresholdInput.addEventListener("input", validateIdle);

// ---- Init ----
loadForm();
