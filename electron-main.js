const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  screen,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");

// --------------------------------------------------------------------------
// Instância única: se o app já estiver aberto, apenas traz a janela para frente.
// --------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.setAppUserModelId("com.cabal.tasklistoverlay");

let mainWindow = null;
const registeredShortcuts = new Set();

// Último tamanho (em pixels CSS, sem zoom) informado pelo renderer.
let lastContentSize = { width: 600, height: 420 };
let uiScale = 1;

// --------------------------------------------------------------------------
// Persistência da posição da janela (arquivo pequeno em userData)
// --------------------------------------------------------------------------
const boundsFile = () => path.join(app.getPath("userData"), "window-bounds.json");

function readSavedBounds() {
  try {
    const parsed = JSON.parse(fs.readFileSync(boundsFile(), "utf8"));
    if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch (_) {
    /* primeiro uso ou arquivo inválido */
  }
  return null;
}

let saveBoundsTimer = null;
function scheduleSaveBounds() {
  clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [x, y] = mainWindow.getPosition();
    try {
      fs.writeFileSync(boundsFile(), JSON.stringify({ x, y }));
    } catch (_) {
      /* ignora falha de escrita */
    }
  }, 400);
}

function isPositionVisible(x, y) {
  return screen.getAllDisplays().some(({ workArea }) => {
    return (
      x >= workArea.x - 50 &&
      y >= workArea.y - 50 &&
      x < workArea.x + workArea.width - 50 &&
      y < workArea.y + workArea.height - 50
    );
  });
}

// --------------------------------------------------------------------------
// Atalhos globais
// --------------------------------------------------------------------------
function shortcutToElectron(shortcut) {
  const names = {
    ctrl: "CommandOrControl",
    meta: "CommandOrControl",
    alt: "Alt",
    shift: "Shift",
    space: "Space",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
  };
  return String(shortcut || "")
    .split("+")
    .filter(Boolean)
    .map((part) => names[part.toLowerCase()] || part)
    .join("+");
}

function registerGlobalShortcuts(shortcuts) {
  registeredShortcuts.forEach((shortcut) => globalShortcut.unregister(shortcut));
  registeredShortcuts.clear();

  const actions = {
    dungeonIncrease: shortcuts?.dungeonIncrease,
    dungeonDecrease: shortcuts?.dungeonDecrease,
    dropIncrease: shortcuts?.dropIncrease,
    dropDecrease: shortcuts?.dropDecrease,
  };

  Object.entries(actions).forEach(([action, configuredShortcut]) => {
    const shortcut = shortcutToElectron(configuredShortcut);
    if (!shortcut || registeredShortcuts.has(shortcut)) return;
    try {
      const ok = globalShortcut.register(shortcut, () => {
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused()) {
          mainWindow.webContents.send("global-shortcut", action);
        }
      });
      if (ok) registeredShortcuts.add(shortcut);
    } catch (_) {
      /* atalho inválido: ignora */
    }
  });
}

// --------------------------------------------------------------------------
// Janela
// --------------------------------------------------------------------------
function applyContentSize() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // Nunca deixa a janela maior que a área útil do monitor onde ela está.
  const { workArea } = screen.getDisplayMatching(mainWindow.getBounds());
  const width = Math.min(
    workArea.width,
    Math.max(200, Math.ceil(lastContentSize.width * uiScale)),
  );
  const height = Math.min(
    workArea.height,
    Math.max(120, Math.ceil(lastContentSize.height * uiScale)),
  );
  const [currentW, currentH] = mainWindow.getContentSize();
  if (currentW === width && currentH === height) return;
  mainWindow.setContentSize(width, height);
}

function createWindow() {
  const saved = readSavedBounds();
  const position =
    saved && isPositionVisible(saved.x, saved.y) ? saved : { x: 80, y: 80 };

  mainWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: 920,
    height: 1080,
    useContentSize: true,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: "#00000000",
    title: "Cabal Tasklist Overlay",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.setMenuBarVisibility(false);

  // Links externos (redes sociais) abrem no navegador padrão.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadFile(path.join(__dirname, "public", "index.html"));

  mainWindow.on("move", scheduleSaveBounds);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --------------------------------------------------------------------------
// IPC
// --------------------------------------------------------------------------
ipcMain.on("update-shortcuts", (_event, shortcuts) => {
  registerGlobalShortcuts(shortcuts);
});

ipcMain.on("resize-to-content", (_event, size) => {
  if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    return;
  }
  lastContentSize = {
    width: Math.min(4000, Math.max(200, size.width)),
    height: Math.min(4000, Math.max(120, size.height)),
  };
  applyContentSize();
});

ipcMain.on("set-ui-scale", (_event, scale) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const clamped = Math.min(2, Math.max(0.5, Number(scale) || 1));
  uiScale = clamped;
  mainWindow.webContents.setZoomFactor(clamped);
  applyContentSize();
});

ipcMain.on("set-always-on-top", (_event, enabled) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // "screen-saver" é o nível mais alto disponível: fica acima de jogos em
  // janela/borderless. (Jogos em tela cheia exclusiva não permitem overlay.)
  mainWindow.setAlwaysOnTop(Boolean(enabled), "screen-saver");
});

ipcMain.on("open-external", (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    shell.openExternal(url);
  }
});

ipcMain.on("minimize-app", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on("save-and-close-app", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

// --------------------------------------------------------------------------
// Ciclo de vida
// --------------------------------------------------------------------------
app.on("second-instance", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
