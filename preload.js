const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronOverlay", {
  updateShortcuts: (shortcuts) => {
    ipcRenderer.send("update-shortcuts", shortcuts);
  },
  minimize: () => {
    ipcRenderer.send("minimize-app");
  },
  saveAndClose: () => {
    ipcRenderer.send("save-and-close-app");
  },
  onGlobalShortcut: (callback) => {
    ipcRenderer.on("global-shortcut", (_event, action) => callback(action));
  },
  resizeToContent: (height) => {
    ipcRenderer.send("resize-to-content", height);
  },
});
