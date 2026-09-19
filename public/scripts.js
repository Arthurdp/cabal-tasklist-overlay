// ==========================================================================
// CABAL ONLINE TASK LIST OVERLAY SCRIPT
// ==========================================================================

"use strict";

const STORAGE_KEY = "cabalTaskOverlayState";
const isElectron = Boolean(window.electronOverlay);

// --- State Management -----------------------------------------------------
const state = {
  theme: "theme-ice5",
  overlayOpacity: 100,
  uiScale: 100, // porcentagem (50 - 200)
  listMaxHeight: 0, // 0 = automática (sem limite); em px CSS
  alwaysOnTop: false,
  panelSide: "right", // "left" | "right"
  shortcuts: {
    dungeonIncrease: "r",
    dungeonDecrease: "f",
    dropIncrease: "d",
    dropDecrease: "s",
  },
  totalSeconds: 0,
  isTotalRunning: false,
  activeTaskId: 1,
  tasks: [],
};

// --- DOM cache (consultado uma única vez) ---------------------------------
const dom = {};
function cacheDom() {
  dom.body = document.body;
  dom.layout = document.getElementById("app-layout");
  dom.controlPanel = document.getElementById("control-panel");
  dom.taskList = document.getElementById("task-list");
  dom.totalTimer = document.getElementById("total-timer");
  dom.totalToggle = document.getElementById("btn-total-toggle-header");
  dom.opacityRange = document.getElementById("overlay-opacity-range");
  dom.opacityValue = document.getElementById("overlay-opacity-value");
  dom.scaleRange = document.getElementById("ui-scale-range");
  dom.scaleValue = document.getElementById("ui-scale-value");
  dom.listHeightRange = document.getElementById("list-height-range");
  dom.listHeightValue = document.getElementById("list-height-value");
  dom.alwaysOnTop = document.getElementById("always-on-top-toggle");
  dom.themeButtons = Array.from(document.querySelectorAll(".theme-btn"));
  dom.sideButtons = Array.from(document.querySelectorAll(".segment-btn"));
}

// --- Helpers --------------------------------------------------------------
function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = String(Math.floor(s / 3600)).padStart(2, "0");
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const secs = String(s % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

// --- Persistência (com debounce para não martelar o localStorage) ---------
let saveTimer = null;

function serializeState() {
  return JSON.stringify({
    transparencyVersion: 2,
    theme: state.theme,
    overlayOpacity: state.overlayOpacity,
    uiScale: state.uiScale,
    listMaxHeight: state.listMaxHeight,
    alwaysOnTop: state.alwaysOnTop,
    panelSide: state.panelSide,
    shortcuts: state.shortcuts,
    totalSeconds: state.totalSeconds,
    isTotalRunning: state.isTotalRunning,
    activeTaskId: state.activeTaskId,
    taskUpdates: state.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      time: t.time,
      dropName: t.dropName,
      meta: t.meta,
      repeatCount: t.repeatCount,
      dropCount: t.dropCount,
      completed: t.completed,
    })),
  });
}

function saveStateNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORAGE_KEY, serializeState());
  } catch (error) {
    console.error("Falha ao salvar estado:", error);
  }
}

function saveState() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveStateNow, 250);
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object") return;

    if (typeof parsed.theme === "string") state.theme = parsed.theme;

    if (
      parsed.transparencyVersion === 2 &&
      typeof parsed.overlayOpacity === "number"
    ) {
      state.overlayOpacity = clamp(parsed.overlayOpacity, 0, 100);
    }
    if (typeof parsed.uiScale === "number") {
      state.uiScale = clamp(Math.round(parsed.uiScale), 50, 200);
    }
    if (typeof parsed.listMaxHeight === "number") {
      state.listMaxHeight =
        parsed.listMaxHeight > 0 ? clamp(parsed.listMaxHeight, 150, 1400) : 0;
    }
    if (typeof parsed.alwaysOnTop === "boolean") {
      state.alwaysOnTop = parsed.alwaysOnTop;
    }
    if (parsed.panelSide === "left" || parsed.panelSide === "right") {
      state.panelSide = parsed.panelSide;
    }
    if (typeof parsed.totalSeconds === "number") {
      state.totalSeconds = parsed.totalSeconds;
    }
    if (typeof parsed.isTotalRunning === "boolean") {
      state.isTotalRunning = parsed.isTotalRunning;
    }
    if (typeof parsed.activeTaskId === "number") {
      state.activeTaskId = parsed.activeTaskId;
    }
    if (Array.isArray(parsed.taskUpdates)) {
      state.tasks = parsed.taskUpdates
        .filter((t) => t && typeof t.id === "number")
        .map((t) => ({
          id: t.id,
          name: typeof t.name === "string" ? t.name : "NOVA TASK",
          time: typeof t.time === "number" ? t.time : 0,
          dropName: typeof t.dropName === "string" ? t.dropName : "NENHUM",
          meta: typeof t.meta === "number" ? t.meta : 1,
          repeatCount: typeof t.repeatCount === "number" ? t.repeatCount : 0,
          dropCount: typeof t.dropCount === "number" ? t.dropCount : 0,
          completed: typeof t.completed === "boolean" ? t.completed : false,
        }));
    }
    if (parsed.shortcuts && typeof parsed.shortcuts === "object") {
      state.shortcuts = { ...state.shortcuts, ...parsed.shortcuts };
    }
  } catch (error) {
    console.error("Falha ao carregar estado salvo:", error);
  }
}

async function loadDefaultTasks() {
  try {
    const res = await fetch("tasks.json");
    const defaults = await res.json();
    return defaults.map((task) => ({
      id: task.id,
      name: task.name,
      time: 0,
      dropName: task.dropName ?? "NENHUM",
      meta: task.meta ?? 1,
      repeatCount: task.repeatCount ?? 0,
      dropCount: task.dropCount ?? 0,
      completed: false,
    }));
  } catch (error) {
    console.error("Falha ao carregar tasks.json:", error);
    return [];
  }
}

// --- Aplicação de configurações visuais -----------------------------------
function applyTheme() {
  dom.body.classList.remove(
    ...Array.from(dom.body.classList).filter((c) => c.startsWith("theme-")),
  );
  dom.body.classList.add(state.theme);
  dom.themeButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === state.theme);
  });
}

function applyOverlayTransparency() {
  document.documentElement.style.setProperty(
    "--overlay-opacity",
    String(state.overlayOpacity / 100),
  );
  if (dom.opacityRange) dom.opacityRange.value = String(state.overlayOpacity);
  if (dom.opacityValue) dom.opacityValue.textContent = `${state.overlayOpacity}%`;
}

function applyUiScale() {
  if (dom.scaleRange) dom.scaleRange.value = String(state.uiScale);
  if (dom.scaleValue) dom.scaleValue.textContent = `${state.uiScale}%`;
  if (isElectron) {
    // No Electron o zoom é feito pela própria janela (mais nítido) e o
    // tamanho da janela acompanha.
    window.electronOverlay.setUiScale(state.uiScale / 100);
  } else {
    // No navegador / OBS usamos zoom CSS.
    dom.layout.style.zoom = String(state.uiScale / 100);
  }
}

function applyListHeight() {
  const auto = state.listMaxHeight <= 0;
  document.documentElement.style.setProperty(
    "--list-max-height",
    auto ? "none" : `${state.listMaxHeight}px`,
  );
  if (dom.listHeightRange) {
    dom.listHeightRange.value = String(auto ? 1400 : state.listMaxHeight);
  }
  if (dom.listHeightValue) {
    dom.listHeightValue.textContent = auto
      ? "Automática"
      : `${state.listMaxHeight}px`;
  }
}

function applyAlwaysOnTop() {
  if (dom.alwaysOnTop) dom.alwaysOnTop.checked = state.alwaysOnTop;
  if (isElectron) window.electronOverlay.setAlwaysOnTop(state.alwaysOnTop);
}

function applyPanelSide() {
  dom.body.classList.toggle("panel-left", state.panelSide === "left");
  dom.body.classList.toggle("panel-right", state.panelSide === "right");
  dom.sideButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.panelSide === state.panelSide);
  });
}

// --- Ajuste da janela Electron ao conteúdo --------------------------------
// Um único ResizeObserver no layout: sempre que o conteúdo mudar de tamanho
// (abrir painel, adicionar task...), a janela acompanha. Só envia IPC quando
// o tamanho realmente mudou.
let lastSentSize = { width: 0, height: 0 };
function setupWindowAutoResize() {
  if (!isElectron || !dom.layout) return;
  const send = () => {
    const rect = dom.layout.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (width === lastSentSize.width && height === lastSentSize.height) return;
    lastSentSize = { width, height };
    window.electronOverlay.resizeToContent({ width, height });
  };
  const observer = new ResizeObserver(() => requestAnimationFrame(send));
  observer.observe(dom.layout);
  send();
}

// --- Atalhos --------------------------------------------------------------
function updateShortcutInputs() {
  const map = {
    dungeonIncrease: "shortcut-dungeon-increase",
    dungeonDecrease: "shortcut-dungeon-decrease",
    dropIncrease: "shortcut-drop-increase",
    dropDecrease: "shortcut-drop-decrease",
  };
  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.value = (state.shortcuts[key] || "").toUpperCase();
  });
}

function saveShortcutSettings() {
  saveState();
  updateShortcutInputs();
  if (isElectron) window.electronOverlay.updateShortcuts(state.shortcuts);
}

function shortcutFromEvent(event) {
  const modifiers = [];
  if (event.ctrlKey) modifiers.push("ctrl");
  if (event.altKey) modifiers.push("alt");
  if (event.shiftKey) modifiers.push("shift");
  if (event.metaKey) modifiers.push("meta");
  return [...modifiers, event.key.toLowerCase()].join("+");
}

function setupShortcutInput(elementId, shortcutKey) {
  const input = document.getElementById(elementId);
  if (!input) return;
  input.addEventListener("keydown", (event) => {
    event.preventDefault();
    if (event.key === "Escape" || event.key === "Backspace") {
      state.shortcuts[shortcutKey] = "";
    } else if (!["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
      state.shortcuts[shortcutKey] = shortcutFromEvent(event);
    }
    saveShortcutSettings();
  });
  input.addEventListener("focus", () => {
    input.value = "PRESSIONE UMA TECLA";
  });
  input.addEventListener("blur", updateShortcutInputs);
}

function handleShortcut(event) {
  if (event.target.matches("input, textarea, select, [contenteditable='true']")) {
    return;
  }
  const pressed = shortcutFromEvent(event);
  const actionByShortcut = {
    [state.shortcuts.dungeonIncrease]: "dungeonIncrease",
    [state.shortcuts.dungeonDecrease]: "dungeonDecrease",
    [state.shortcuts.dropIncrease]: "dropIncrease",
    [state.shortcuts.dropDecrease]: "dropDecrease",
  };
  const action = actionByShortcut[pressed];
  if (action) {
    event.preventDefault();
    applyShortcut(action);
  }
}

function applyShortcut(action) {
  const task = findTask(state.activeTaskId);
  if (!task) return;
  const actions = {
    dungeonIncrease: () => adjustRepeat(task.id, 1),
    dungeonDecrease: () => adjustRepeat(task.id, -1),
    dropIncrease: () => adjustDropCount(task.id, 1),
    dropDecrease: () => adjustDropCount(task.id, -1),
  };
  actions[action]?.();
}

// --- Render ---------------------------------------------------------------
function taskTemplate(task, index) {
  const name = escapeHtml(task.name);
  const drop = escapeHtml(task.dropName);
  return `
    <span class="task-checkbox">
      <input type="checkbox" data-action="toggle-complete" ${task.completed ? "checked" : ""}>
    </span>
    <span class="task-num">${index + 1}</span>
    <div class="task-dungeon">
      <span class="task-name" contenteditable="true" spellcheck="false" data-field="name" title="${name}">${name}</span>
      <div class="task-repeat-controls">
        <button type="button" class="btn-counter" data-action="repeat" data-amount="-1">-</button>
        <span class="task-repeat">${task.repeatCount}</span>
        <button type="button" class="btn-counter" data-action="repeat" data-amount="1">+</button>
      </div>
    </div>
    <input class="task-meta-input" type="number" min="0" value="${task.meta}" title="Meta de repetições" data-action="meta">
    <span class="task-time" data-action="toggle-timer" data-time-for="${task.id}">${formatTime(task.time)}</span>
    <div class="task-drop">
      <span class="task-drop-name" contenteditable="true" spellcheck="false" data-field="dropName" title="${drop}">${drop}</span>
      <div class="task-count-controls">
        <button type="button" class="btn-counter" data-action="drop" data-amount="-1">-</button>
        <span class="drop-count">${task.dropCount}</span>
        <button type="button" class="btn-counter" data-action="drop" data-amount="1">+</button>
      </div>
    </div>
    <div class="task-actions">
      <button type="button" class="task-delete-btn" data-action="delete" title="Excluir task" aria-label="Excluir task">✕</button>
    </div>`;
}

function renderTasks() {
  if (!dom.taskList) return;

  const panelOpen = !dom.controlPanel.classList.contains("collapsed");
  dom.body.classList.toggle("actions-visible", panelOpen);

  const fragment = document.createDocumentFragment();
  state.tasks.forEach((task, index) => {
    const isActive = task.id === state.activeTaskId;
    const el = document.createElement("div");
    el.className = "task-item";
    if (isActive) el.classList.add("active");
    if (task.completed) el.classList.add("completed");
    if (panelOpen) el.classList.add("show-actions");
    el.draggable = true;
    el.dataset.taskId = String(task.id);
    el.innerHTML = taskTemplate(task, index);
    fragment.appendChild(el);
  });

  // replaceChildren descarta os nós antigos de uma vez (sem handlers órfãos)
  dom.taskList.replaceChildren(fragment);
}

function updateTotalToggleButton() {
  if (dom.totalToggle) dom.totalToggle.textContent = state.isTotalRunning ? "||" : "▶";
}

function updateTotalTimerDisplay() {
  if (dom.totalTimer) dom.totalTimer.textContent = formatTime(state.totalSeconds);
}

// --- Ações das tasks ------------------------------------------------------
function reorderTasks(sourceId, targetId) {
  const from = state.tasks.findIndex((t) => t.id === sourceId);
  const to = state.tasks.findIndex((t) => t.id === targetId);
  if (from === -1 || to === -1 || from === to) return;
  const [moved] = state.tasks.splice(from, 1);
  state.tasks.splice(to, 0, moved);
  renderTasks();
  saveState();
}

function deleteTask(taskId) {
  const index = state.tasks.findIndex((t) => t.id === taskId);
  if (index === -1) return;
  state.tasks.splice(index, 1);
  if (state.activeTaskId === taskId) {
    state.activeTaskId = state.tasks[0]?.id ?? null;
  }
  renderTasks();
  saveState();
}

function selectActiveTask(id) {
  if (state.activeTaskId === id) return;
  state.activeTaskId = id;
  renderTasks();
  saveState();
}

function completeTaskWhenMetaReached(task) {
  if (task.meta <= 0 || task.repeatCount < task.meta || task.completed) return;
  task.completed = true;
  const currentIndex = state.tasks.findIndex((t) => t.id === task.id);
  const next = state.tasks.slice(currentIndex + 1).find((t) => !t.completed);
  if (next) state.activeTaskId = next.id;
}

function adjustRepeat(taskId, amount) {
  const task = findTask(taskId);
  if (!task) return;
  task.repeatCount = Math.max(0, task.repeatCount + amount);
  completeTaskWhenMetaReached(task);
  renderTasks();
  saveState();
}

function adjustDropCount(taskId, amount) {
  const task = findTask(taskId);
  if (!task) return;
  task.dropCount = Math.max(0, task.dropCount + amount);
  renderTasks();
  saveState();
}

function updateTaskMeta(taskId, value) {
  const task = findTask(taskId);
  if (!task) return;
  task.meta = Math.max(0, Number.parseInt(value, 10) || 0);
  completeTaskWhenMetaReached(task);
  renderTasks();
  saveState();
}

function saveTaskField(taskId, field, value) {
  const task = findTask(taskId);
  if (!task) return;
  const text = String(value ?? "").trim().slice(0, 80);
  if (text.length) task[field] = text;
  renderTasks();
  saveState();
}

function toggleTaskTimer(taskId) {
  if (state.activeTaskId !== taskId) state.activeTaskId = taskId;
  toggleTotalTimer();
  renderTasks();
}

function toggleComplete(taskId, checked) {
  const task = findTask(taskId);
  if (!task) return;
  task.completed = checked;
  renderTasks();
  saveState();
}

function addTask(name, dropName) {
  state.tasks.push({
    id: Date.now(),
    name,
    time: 0,
    dropName: dropName || "NENHUM",
    meta: 1,
    repeatCount: 0,
    dropCount: 0,
    completed: false,
  });
  renderTasks();
  saveState();
}

function resetAll() {
  state.totalSeconds = 0;
  state.isTotalRunning = false;
  stopTotalTimer();
  state.tasks.forEach((task) => {
    task.time = 0;
    task.repeatCount = 0;
    task.dropCount = 0;
    task.completed = false;
  });
  updateTotalTimerDisplay();
  updateTotalToggleButton();
  renderTasks();
  saveState();
}

// --- Timer ----------------------------------------------------------------
// O tempo é calculado pela diferença de timestamps (Date.now) e não pela
// contagem de "ticks": assim, mesmo se o sistema atrasar o setInterval
// (janela minimizada, PC ocupado), o relógio continua exato.
let timerInterval = null;
let lastTickAt = 0;
let ticksSinceSave = 0;

function timerTick() {
  const now = Date.now();
  const elapsed = Math.floor((now - lastTickAt) / 1000);
  if (elapsed < 1) return;
  lastTickAt += elapsed * 1000;

  state.totalSeconds += elapsed;
  updateTotalTimerDisplay();

  const active = findTask(state.activeTaskId);
  if (active) {
    active.time += elapsed;
    const el = dom.taskList.querySelector(`[data-time-for="${active.id}"]`);
    if (el) el.textContent = formatTime(active.time);
  }

  ticksSinceSave += elapsed;
  if (ticksSinceSave >= 10) {
    ticksSinceSave = 0;
    saveState();
  }
}

function startTotalTimer() {
  if (timerInterval) return;
  lastTickAt = Date.now();
  ticksSinceSave = 0;
  timerInterval = setInterval(timerTick, 1000);
}

function stopTotalTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function toggleTotalTimer() {
  state.isTotalRunning = !state.isTotalRunning;
  if (state.isTotalRunning) startTotalTimer();
  else stopTotalTimer();
  updateTotalToggleButton();
  saveState();
}

// --- Delegação de eventos da lista ---------------------------------------
// Um único conjunto de listeners no container, em vez de dezenas por task.
function setupTaskListEvents() {
  const list = dom.taskList;

  const taskIdFrom = (target) => {
    const item = target.closest(".task-item");
    return item ? Number(item.dataset.taskId) : null;
  };

  list.addEventListener("click", (event) => {
    const taskId = taskIdFrom(event.target);
    if (taskId === null) return;

    const actionEl = event.target.closest("[data-action]");
    const action = actionEl?.dataset.action;

    if (!action) {
      // Clique em qualquer área "neutra" da linha seleciona a task
      if (!event.target.closest("[contenteditable], input")) {
        selectActiveTask(taskId);
      }
      return;
    }

    switch (action) {
      case "repeat":
        adjustRepeat(taskId, Number(actionEl.dataset.amount));
        break;
      case "drop":
        adjustDropCount(taskId, Number(actionEl.dataset.amount));
        break;
      case "delete":
        deleteTask(taskId);
        break;
      case "toggle-timer":
        toggleTaskTimer(taskId);
        break;
      case "toggle-complete":
        toggleComplete(taskId, actionEl.checked);
        break;
      default:
        break;
    }
  });

  list.addEventListener("change", (event) => {
    if (event.target.dataset.action === "meta") {
      updateTaskMeta(taskIdFrom(event.target), event.target.value);
    }
  });

  // contenteditable: Enter confirma, blur salva
  list.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.dataset.field) {
      event.preventDefault();
      event.target.blur();
    }
  });
  list.addEventListener("focusout", (event) => {
    const field = event.target.dataset?.field;
    if (field) saveTaskField(taskIdFrom(event.target), field, event.target.innerText);
  });

  // Drag & drop para reordenar
  let draggingId = null;
  list.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".task-item");
    if (!item) return;
    draggingId = Number(item.dataset.taskId);
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(draggingId));
  });
  list.addEventListener("dragover", (event) => {
    const item = event.target.closest(".task-item");
    if (!item || draggingId === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    list.querySelectorAll(".drag-target").forEach((el) => {
      if (el !== item) el.classList.remove("drag-target");
    });
    item.classList.add("drag-target");
  });
  list.addEventListener("dragleave", (event) => {
    event.target.closest(".task-item")?.classList.remove("drag-target");
  });
  list.addEventListener("drop", (event) => {
    const item = event.target.closest(".task-item");
    if (!item || draggingId === null) return;
    event.preventDefault();
    const targetId = Number(item.dataset.taskId);
    if (targetId !== draggingId) reorderTasks(draggingId, targetId);
    draggingId = null;
  });
  list.addEventListener("dragend", () => {
    draggingId = null;
    list.querySelectorAll(".dragging, .drag-target").forEach((el) => {
      el.classList.remove("dragging", "drag-target");
    });
  });
}

// --- Painel de controle ---------------------------------------------------
function setupControlPanel() {
  document.getElementById("toggle-panel-btn").addEventListener("click", () => {
    dom.controlPanel.classList.toggle("collapsed");
    renderTasks();
  });

  document.getElementById("minimize-app-btn")?.addEventListener("click", () => {
    window.electronOverlay?.minimize();
  });

  document.getElementById("save-close-app-btn")?.addEventListener("click", () => {
    saveStateNow();
    if (isElectron) window.electronOverlay.saveAndClose();
    else window.close();
  });

  // Always on top
  dom.alwaysOnTop?.addEventListener("change", (event) => {
    state.alwaysOnTop = event.target.checked;
    applyAlwaysOnTop();
    saveState();
  });

  // Tamanho do app: enquanto arrasta só o número muda; aplica ao soltar
  dom.scaleRange?.addEventListener("input", (event) => {
    if (dom.scaleValue) dom.scaleValue.textContent = `${event.target.value}%`;
  });
  dom.scaleRange?.addEventListener("change", (event) => {
    state.uiScale = clamp(Number(event.target.value), 50, 200);
    applyUiScale();
    saveState();
  });

  // Altura da lista de tasks (scroll aparece só quando necessário)
  dom.listHeightRange?.addEventListener("input", (event) => {
    if (dom.listHeightValue) {
      dom.listHeightValue.textContent = `${event.target.value}px`;
    }
  });
  dom.listHeightRange?.addEventListener("change", (event) => {
    const value = Number(event.target.value);
    state.listMaxHeight = value >= 1400 ? 0 : clamp(value, 150, 1400);
    applyListHeight();
    saveState();
  });
  document.getElementById("btn-list-height-auto")?.addEventListener("click", () => {
    state.listMaxHeight = 0;
    applyListHeight();
    saveState();
  });

  // Opacidade
  dom.opacityRange?.addEventListener("input", (event) => {
    state.overlayOpacity = Number(event.target.value);
    applyOverlayTransparency();
    saveState();
  });

  // Posição do painel
  dom.sideButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.panelSide = btn.dataset.panelSide === "left" ? "left" : "right";
      applyPanelSide();
      saveState();
    });
  });

  // Temas
  dom.themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.theme = btn.dataset.theme;
      applyTheme();
      saveState();
    });
  });

  // Atalhos
  setupShortcutInput("shortcut-dungeon-increase", "dungeonIncrease");
  setupShortcutInput("shortcut-dungeon-decrease", "dungeonDecrease");
  setupShortcutInput("shortcut-drop-increase", "dropIncrease");
  setupShortcutInput("shortcut-drop-decrease", "dropDecrease");

  // Timer total
  dom.totalToggle?.addEventListener("click", toggleTotalTimer);

  document.getElementById("btn-total-reset").addEventListener("click", () => {
    state.totalSeconds = 0;
    updateTotalTimerDisplay();
    saveState();
  });

  document.getElementById("btn-reset-all").addEventListener("click", resetAll);

  // Nova task
  const nameInput = document.getElementById("input-dg-name");
  const dropInput = document.getElementById("input-drop-name");
  const submitNewTask = () => {
    const name = nameInput.value.trim();
    if (!name) return;
    addTask(name, dropInput.value.trim());
    nameInput.value = "";
    dropInput.value = "";
  };
  document.getElementById("btn-add-task").addEventListener("click", submitNewTask);
  [nameInput, dropInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submitNewTask();
    });
  });

  // Links externos abrem no navegador padrão quando dentro do Electron
  document.querySelectorAll("a[data-external]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!isElectron) return;
      event.preventDefault();
      window.electronOverlay.openExternal(link.href);
    });
  });

  // Copiar cupom
  const copyBtn = document.getElementById("btn-copy-coupon");
  const couponCode = document.getElementById("coupon-code");
  copyBtn?.addEventListener("click", async () => {
    const code = couponCode?.textContent.trim() || "";
    try {
      await navigator.clipboard.writeText(code);
      copyBtn.textContent = "Copiado!";
    } catch (_) {
      copyBtn.textContent = "Erro";
    }
    setTimeout(() => {
      copyBtn.textContent = "Copiar";
    }, 1500);
  });
}

// --- Inicialização --------------------------------------------------------
async function init() {
  cacheDom();
  if (isElectron) document.documentElement.classList.add("electron-window");

  state.tasks = await loadDefaultTasks();
  loadState();

  applyTheme();
  applyOverlayTransparency();
  applyPanelSide();
  applyListHeight();
  applyAlwaysOnTop();
  applyUiScale();
  updateShortcutInputs();

  setupControlPanel();
  setupTaskListEvents();
  document.addEventListener("keydown", handleShortcut);

  if (isElectron) {
    window.electronOverlay.updateShortcuts(state.shortcuts);
    window.electronOverlay.onGlobalShortcut(applyShortcut);
  }

  renderTasks();
  updateTotalTimerDisplay();
  updateTotalToggleButton();
  if (state.isTotalRunning) startTotalTimer();

  setupWindowAutoResize();

  // Garante que nada se perde ao fechar a janela
  window.addEventListener("beforeunload", saveStateNow);
}

document.addEventListener("DOMContentLoaded", init);
