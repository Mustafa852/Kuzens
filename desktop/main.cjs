/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  Menu,
  nativeImage,
  nativeTheme,
  session,
  shell,
  Tray,
} = require("electron");
const { autoUpdater } = require("electron-updater");

const APP_URL = process.env.KUZENS_APP_URL || "https://kuzens-chat.ilhanilhan239.chatgpt.site/";
const APP_ORIGIN = new URL(APP_URL).origin;
const APP_HOSTNAME = new URL(APP_URL).hostname;
const SESSION_PARTITION = "persist:kuzens";
const ALLOWED_PERMISSIONS = new Set(["display-capture", "fullscreen", "media", "notifications"]);
const AUTH_HOSTS = new Set([
  "accounts.google.com",
  "appleid.apple.com",
  "auth.openai.com",
  "chatgpt.com",
  "login.microsoftonline.com",
]);

let mainWindow = null;
let tray = null;
let isQuitting = false;
let updateCheckInProgress = false;

const secureWebPreferences = {
  allowRunningInsecureContent: false,
  contextIsolation: true,
  nodeIntegration: false,
  partition: SESSION_PARTITION,
  sandbox: true,
  spellcheck: true,
  webSecurity: true,
  webviewTag: false,
};

function parseHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function isAllowedNavigation(value) {
  const parsed = parseHttpsUrl(value);
  if (!parsed) return false;

  return (
    parsed.hostname === APP_HOSTNAME ||
    AUTH_HOSTS.has(parsed.hostname) ||
    parsed.hostname.endsWith(".openai.com") ||
    parsed.hostname.endsWith(".chatgpt.com")
  );
}

async function openExternalSafely(value) {
  const parsed = parseHttpsUrl(value);
  if (!parsed) return;
  await shell.openExternal(parsed.toString());
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function hardenWebContents(contents) {
  contents.on("will-attach-webview", (event) => event.preventDefault());

  contents.on("will-navigate", (event, targetUrl) => {
    if (targetUrl.startsWith("file://") || isAllowedNavigation(targetUrl)) return;

    event.preventDefault();
    void openExternalSafely(targetUrl);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      if (mainWindow && !mainWindow.isDestroyed()) void mainWindow.loadURL(url);
    } else {
      void openExternalSafely(url);
    }

    return { action: "deny" };
  });
}

function configurePermissions(appSession) {
  const mayUsePermission = (permission, requestingOrigin) =>
    requestingOrigin === APP_ORIGIN && ALLOWED_PERMISSIONS.has(permission);

  appSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) =>
    mayUsePermission(permission, requestingOrigin),
  );

  appSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const requestingOrigin = (() => {
      try {
        return new URL(webContents.getURL()).origin;
      } catch {
        return "";
      }
    })();

    callback(mayUsePermission(permission, requestingOrigin));
  });

  appSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const requestUrl = request.frame?.url || "";
      if (new URL(requestUrl).origin !== APP_ORIGIN) {
        callback({});
        return;
      }

      const sources = await desktopCapturer.getSources({
        fetchWindowIcons: true,
        thumbnailSize: { width: 320, height: 180 },
        types: ["screen", "window"],
      });
      const visibleSources = sources.slice(0, 10);
      if (visibleSources.length === 0) {
        callback({});
        return;
      }

      const cancelId = visibleSources.length;
      const result = await dialog.showMessageBox(mainWindow, {
        buttons: [...visibleSources.map((source) => source.name), "İptal"],
        cancelId,
        defaultId: 0,
        detail: "Paylaşmak istediğin ekranı veya pencereyi seç.",
        message: "Ekran paylaşımı",
        noLink: true,
        title: "Kuzens",
        type: "question",
      });

      if (result.response === cancelId) {
        callback({});
        return;
      }

      callback({
        audio: request.audioRequested ? "loopback" : undefined,
        video: visibleSources[result.response],
      });
    } catch {
      callback({});
    }
  });

  appSession.on("will-download", (_event, item) => {
    item.setSaveDialogOptions({
      defaultPath: item.getFilename(),
      title: "Dosyayı kaydet",
    });
  });
}

function createMainWindow() {
  const iconPath = path.join(__dirname, "icon-512.png");

  mainWindow = new BrowserWindow({
    backgroundColor: "#09080f",
    center: true,
    height: 900,
    icon: iconPath,
    minHeight: 680,
    minWidth: 1060,
    show: false,
    title: "Kuzens",
    width: 1500,
    webPreferences: secureWebPreferences,
  });

  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} KuzensDesktop/${app.getVersion()}`);
  hardenWebContents(mainWindow.webContents);

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || validatedUrl.startsWith("file://")) return;
    void mainWindow?.loadFile(path.join(__dirname, "offline.html"));
  });

  void mainWindow.loadURL(APP_URL);
  return mainWindow;
}

function createTray() {
  const sourceIcon = nativeImage.createFromPath(path.join(__dirname, "icon-512.png"));
  tray = new Tray(sourceIcon.resize({ height: 24, width: 24 }));
  tray.setToolTip("Kuzens");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Kuzens'i aç", click: focusMainWindow },
      { label: "Güncellemeleri denetle", click: () => void checkForUpdates(true) },
      { type: "separator" },
      {
        label: "Tamamen kapat",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", focusMainWindow);
}

async function checkForUpdates(showCurrentMessage = false) {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE || updateCheckInProgress) {
    if (showCurrentMessage) {
      await dialog.showMessageBox(mainWindow, {
        message: process.env.PORTABLE_EXECUTABLE_FILE
          ? "Taşınabilir sürüm otomatik güncellenmez. Yeni Portable dosyasını GitHub'dan indirebilirsin."
          : "Güncelleme denetimi kurulu Kuzens sürümünde çalışır.",
        title: "Kuzens güncelleme",
        type: "info",
      });
    }
    return;
  }

  updateCheckInProgress = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (showCurrentMessage && result?.updateInfo?.version === app.getVersion()) {
      await dialog.showMessageBox(mainWindow, {
        message: "Kuzens güncel.",
        title: "Kuzens güncelleme",
        type: "info",
      });
    }
  } catch (error) {
    if (showCurrentMessage) {
      await dialog.showMessageBox(mainWindow, {
        detail: error instanceof Error ? error.message : "Bilinmeyen hata",
        message: "Güncelleme sunucusuna ulaşılamadı.",
        title: "Kuzens güncelleme",
        type: "warning",
      });
    }
  } finally {
    updateCheckInProgress = false;
  }
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", () => {});
  autoUpdater.on("update-downloaded", async () => {
    const result = await dialog.showMessageBox(mainWindow, {
      buttons: ["Şimdi yeniden başlat", "Sonra"],
      cancelId: 1,
      defaultId: 0,
      detail: "Yeni sürüm indirildi. Göndermediğin mesajları önce gönder; ardından uygulama yeniden başlayacak.",
      message: "Kuzens güncellemeye hazır",
      title: "Kuzens güncelleme",
      type: "info",
    });

    if (result.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall(false, true);
    }
  });

  setTimeout(() => void checkForUpdates(false), 12_000);
  setInterval(() => void checkForUpdates(false), 6 * 60 * 60 * 1000);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);

  app.whenReady().then(() => {
    app.setAppUserModelId("com.kuzens.chat");
    nativeTheme.themeSource = "dark";
    Menu.setApplicationMenu(null);

    const appSession = session.fromPartition(SESSION_PARTITION);
    configurePermissions(appSession);
    createMainWindow();
    createTray();
    configureAutoUpdater();
  });
}

app.on("activate", focusMainWindow);
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("window-all-closed", () => {});
