<div align="center">
  <img src="extension/icons/icon128.png" alt="Tab Sleeper Logo" width="80" height="80">
  <h1>Tab Sleeper 💤</h1>
  <p><strong>A lightning-fast, modern Chrome & Brave extension that automatically sleeps your idle tabs to save massive amounts of RAM and CPU.</strong></p>
</div>

<br>

## ✨ Features

- ⏱️ **Auto-Sleep:** Automatically unloads tabs after a customizable period of inactivity (default: 5 minutes).
- 🧠 **Smart Detection:** Never sleeps tabs that are playing audio/video, or tabs you have pinned.
- 🧹 **One-Click Cleanup:** Instantly put *all* other background tabs to sleep with a single click in the popup.
- 🎯 **Dynamic Thresholds:** Set a minimum tab limit (e.g., only start sleeping tabs if you have more than 10 open).
- ⌨️ **Keyboard Shortcuts:** Press `Ctrl+Shift+S` (or `Cmd+Shift+S`) to safely sleep your current tab and instantly open a new one.
- 🛡️ **Domain Whitelist:** Add your favorite sites (like Spotify or Gmail) to the whitelist so they never go to sleep.

## 🚀 Installation (No-code setup)

You can install this extension directly from this repository in just a few clicks!

1. Download the [`tab-sleeper.zip`](tab-sleeper.zip) file from this repository.
2. Unzip the file on your computer to a folder (e.g., `tab-sleeper`).
3. Open your browser and go to the extensions page:
   - **Chrome:** `chrome://extensions/`
   - **Brave:** `brave://extensions/`
4. Enable **"Developer mode"** (toggle in the top right corner).
5. Click **"Load unpacked"** and select the folder you just unzipped.
6. 🎉 You're done! Pin the extension to your toolbar and enjoy your newly freed RAM!

## 🛠️ For Developers

Tab Sleeper is built with pure Vanilla JavaScript, HTML, and CSS using the modern **Manifest V3** architecture. There are no heavy frameworks, no build steps, and absolutely no tracking or analytics.

### Architecture Highlights
- **Service Worker (`background.js`):** Handles all the timers, alarms, and badge logic gracefully in the background. It uses `chrome.storage.session` to track active tab states without hitting the disk, falling back gracefully if the service worker goes to sleep.
- **Strict Storage (`lib/settings.js`):** A single source of truth for reading and writing to `chrome.storage.sync`.
- **Pure CSS:** Features a sleek, modern UI with glassmorphism, smooth micro-animations, and a fully custom dark mode.

## 👨‍💻 Author

Built by **Jyotirmay Biswas**.

---
*If this extension saved your browser from crashing, feel free to leave a star! ⭐*
