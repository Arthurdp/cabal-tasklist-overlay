const { app, BrowserWindow, globalShortcut, ipcMain } = require("electron");
const path = require("path");

const { startServer } = require("./server");
const server = startServer();
server.on("error", (error) => {
  if (error.code !== "EADDRINUSE") {
    throw error;
  }
  console.log("Servidor local já está ativo na porta 3000; reutilizando-o.");
});

let mainWindow;
const registeredShortcuts = new Set();

function shortcutToElectron(shortcut) {
  return String(shortcut || "")
    .split("+")
    .map((part) => {
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
      return names[part.toLowerCase()] || part;
    })
    .join("+");
}

function registerGlobalShortcuts(shortcuts) {
  registeredShortcuts.forEach((shortcut) =>
    globalShortcut.unregister(shortcut),
  );
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
    if (
      globalShortcut.register(shortcut, () => {
        if (mainWindow && !mainWindow.isFocused()) {
          mainWindow.webContents.send("global-shortcut", action);
        }
      })
    ) {
      registeredShortcuts.add(shortcut);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1000,
    minHeight: 400,
    transparent: true,
    frame: false,
    resizable: true,
    alwaysOnTop: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("http://localhost:3000");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.on("update-shortcuts", (_event, shortcuts) => {
  registerGlobalShortcuts(shortcuts);
});

ipcMain.on("resize-to-content", (_event, contentHeight) => {
  if (!mainWindow || !Number.isFinite(contentHeight)) return;
  const [width] = mainWindow.getSize();
  const height = Math.max(400, Math.min(2000, Math.ceil(contentHeight)));
  mainWindow.setSize(width, height, true);
});

ipcMain.on("minimize-app", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on("save-and-close-app", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
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
