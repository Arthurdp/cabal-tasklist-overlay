const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronOverlay", {
  updateShortcuts: (shortcuts) => ipcRenderer.send("update-shortcuts", shortcuts),
  minimize: () => ipcRenderer.send("minimize-app"),
  saveAndClose: () => ipcRenderer.send("save-and-close-app"),
  onGlobalShortcut: (callback) => {
    ipcRenderer.removeAllListeners("global-shortcut");
    ipcRenderer.on("global-shortcut", (_event, action) => callback(action));
  },
  // size = { width, height } em pixels CSS (antes do zoom)
  resizeToContent: (size) => ipcRenderer.send("resize-to-content", size),
  setUiScale: (scale) => ipcRenderer.send("set-ui-scale", scale),
  setAlwaysOnTop: (enabled) => ipcRenderer.send("set-always-on-top", enabled),
  openExternal: (url) => ipcRenderer.send("open-external", url),
});
