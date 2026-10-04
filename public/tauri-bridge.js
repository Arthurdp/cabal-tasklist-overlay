// Ponte fina entre a interface existente e os comandos Rust do Tauri.
// Em navegador/OBS este arquivo não instala a API desktop.
(() => {
  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke || !tauri?.event?.listen) return;

  const { invoke } = tauri.core;
  const { listen } = tauri.event;

  window.tauriOverlay = {
    updateShortcuts: (shortcuts) => invoke("update_shortcuts", { shortcuts }),
    loadState: () => invoke("load_overlay_state"),
    saveState: (payload) => invoke("save_overlay_state", { payload }),
    minimize: () => invoke("minimize_app"),
    saveAndClose: () => invoke("close_app"),
    onGlobalShortcut: (callback) =>
      listen("global-shortcut", (event) => callback(event.payload)),
    resizeToContent: ({ width, height }) =>
      invoke("resize_to_content", { width, height }),
    setAlwaysOnTop: (enabled) => invoke("set_always_on_top", { enabled }),
    openExternal: (url) => invoke("open_external", { url }),
    startDragging: () => tauri.window.getCurrentWindow().startDragging(),
  };
})();
