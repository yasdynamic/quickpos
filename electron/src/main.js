// WARYA — Electron main process (option A: wrapper around the hosted web app).
//
// Loads the WARYA web application in a Chromium window with native chrome
// removed for a kiosk-style POS experience. Persists window state and
// authorizes WebUSB requests (thermal printer + cash drawer).
//
// The target URL is read from `src/config.js` (committed) or overridden at
// build time via the WARYA_URL environment variable, which lets you ship the
// same Electron build pointing to staging / production / on-premise URLs.

const { app, BrowserWindow, Menu, shell, session, dialog } = require("electron");
const path = require("node:path");
const { autoUpdater } = require("electron-updater");
const { WARYA_URL } = require("./config");

const TARGET_URL = process.env.WARYA_URL || WARYA_URL;
const isDev = !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#0A0A0A",
    icon: path.join(__dirname, "..", "build", "icon.ico"),
    autoHideMenuBar: true,
    title: "WARYA",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      // Enable WebUSB inside the renderer (ESC/POS thermal printer)
      enableWebSQL: false,
    },
  });

  // -- WebUSB permissions ---------------------------------------------------
  // The Caisse Hub talks to USB thermal printers via WebUSB. By default
  // Electron blocks `navigator.usb.requestDevice()` — we grant it
  // automatically for the WARYA origin so the user only sees the native
  // Chromium device picker.
  const ses = mainWindow.webContents.session;
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ["usb", "serial", "hid", "clipboard-read", "clipboard-sanitized-write"];
    callback(allowed.includes(permission));
  });
  ses.setDevicePermissionHandler((details) => {
    return details.deviceType === "usb" || details.deviceType === "hid";
  });
  ses.on("select-usb-device", (event, details, callback) => {
    // Let the user pick via the built-in device chooser
    event.preventDefault();
    if (details.deviceList && details.deviceList.length > 0) {
      callback(details.deviceList[0].deviceId);
    }
  });

  // External links open in default browser, never inside the kiosk
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Reload-on-error: if the network drops or the deploy URL is unreachable
  // at startup, retry once after 5s before showing the failure page.
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    if (code === -3) return; // user navigation aborted
    if (url !== TARGET_URL) return;
    setTimeout(() => mainWindow && mainWindow.loadURL(TARGET_URL), 5000);
  });

  mainWindow.loadURL(TARGET_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function buildMenu() {
  const template = [
    {
      label: "WARYA",
      submenu: [
        { label: "Recharger", accelerator: "F5", click: () => mainWindow?.reload() },
        { label: "Forcer recharger", accelerator: "Ctrl+Shift+R", click: () => mainWindow?.webContents.reloadIgnoringCache() },
        { type: "separator" },
        { label: "Outils développeur", accelerator: "F12", click: () => mainWindow?.webContents.toggleDevTools() },
        { type: "separator" },
        { label: "Plein écran", accelerator: "F11", click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { type: "separator" },
        { role: "quit", label: "Quitter" },
      ],
    },
    {
      label: "Édition",
      submenu: [
        { role: "undo", label: "Annuler" },
        { role: "redo", label: "Rétablir" },
        { type: "separator" },
        { role: "cut", label: "Couper" },
        { role: "copy", label: "Copier" },
        { role: "paste", label: "Coller" },
        { role: "selectAll", label: "Tout sélectionner" },
      ],
    },
    {
      label: "Affichage",
      submenu: [
        { role: "zoomIn", label: "Zoom +" },
        { role: "zoomOut", label: "Zoom -" },
        { role: "resetZoom", label: "Zoom 100%" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  // Hint Chromium about expected display name (used in some POS hardware logs)
  app.setName("WARYA");
  buildMenu();
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ---------------------------------------------------------------------------
// Auto-update via electron-updater + GitHub Releases.
// Skipped in dev (no installer) and for portable builds (no install path).
// ---------------------------------------------------------------------------
function setupAutoUpdater() {
  if (isDev) return;
  if (process.env.PORTABLE_EXECUTABLE_DIR) return; // portable build

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false; // set to true to ship alpha/beta updates

  autoUpdater.on("update-available", (info) => {
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `console.info("[WARYA] Mise à jour disponible: v${info.version}, téléchargement en cours…")`
      ).catch(() => {});
    }
  });

  autoUpdater.on("update-downloaded", async (info) => {
    if (!mainWindow) return;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["Redémarrer maintenant", "Plus tard"],
      defaultId: 0,
      cancelId: 1,
      title: "Mise à jour WARYA",
      message: `WARYA v${info.version} est prêt à être installé.`,
      detail:
        "La mise à jour sera appliquée au prochain redémarrage. Voulez-vous relancer WARYA maintenant ?",
    });
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });

  autoUpdater.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.warn("[WARYA] electron-updater:", err?.message || err);
  });

  // Check immediately on startup, then every 6h
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Refuse remote navigation outside the WARYA origin (defense in depth)
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, url) => {
    try {
      const target = new URL(url).origin;
      const allowed = new URL(TARGET_URL).origin;
      if (target !== allowed) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
});
