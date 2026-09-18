// ==========================================================================
// CABAL ONLINE TASK LIST OVERLAY SCRIPT
// ==========================================================================

// --- State Management ---
let state = {
  theme: "theme-ice5",
  overlayOpacity: 100,
  shortcuts: {
    dungeonIncrease: "r",
    dungeonDecrease: "f",
    dropIncrease: "d",
    dropDecrease: "s",
  },
  totalSeconds: 0,
  isTotalRunning: false,
  activeTaskId: 1,
  tasks: [], // Será carregado do tasks.json
};

// --- Timers ---
let totalTimerInterval = null;

// --- Helper Functions ---
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
}

function saveState() {
  const saveData = {
    transparencyVersion: 2,
    theme: state.theme,
    overlayOpacity: state.overlayOpacity,
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
  };
  localStorage.setItem("cabalTaskOverlayState", JSON.stringify(saveData));
  console.log("💾 State saved:", {
    theme: saveData.theme,
    totalSeconds: saveData.totalSeconds,
  });
}

function loadTasksFromJSON() {
  // Load default tasks from tasks.json
  fetch("tasks.json")
    .then((res) => res.json())
    .then((defaultTasks) => {
      console.log("✓ Tasks loaded from JSON:", defaultTasks);

      // Initialize tasks with default data from JSON
      state.tasks = defaultTasks.map((task) => ({
        id: task.id,
        name: task.name,
        time: 0,
        dropName: task.dropName,
        meta: task.meta ?? 1,
        repeatCount: task.repeatCount ?? 0,
        dropCount: task.dropCount ?? 0,
        completed: false,
      }));

      console.log("✓ Tasks initialized in state:", state.tasks);

      // Restore the complete saved list, including order, additions and deletions.
      loadState();
      console.log("✓ State loaded from localStorage, theme:", state.theme);

      // Apply theme
      document.body.className = state.theme;
      applyOverlayTransparency();
      updateShortcutInputs();
      console.log("✓ Theme applied:", state.theme);

      // Update theme button highlights
      const themeButtons = document.querySelectorAll(".theme-btn");
      themeButtons.forEach((btn) => {
        if (btn.dataset.theme === state.theme) {
          btn.classList.add("active");
          console.log("✓ Theme button highlighted:", btn.dataset.theme);
        }
      });

      // Initial render
      renderTasks();
      resizeElectronWindow();
      if (window.electronOverlay) {
        window.electronOverlay.updateShortcuts(state.shortcuts);
        window.electronOverlay.onGlobalShortcut(applyShortcut);
      }
      updateTotalToggleButton();
      // Update total timer display after loading state
      document.getElementById("total-timer").innerText = formatTime(
        state.totalSeconds,
      );
      if (state.isTotalRunning) {
        startTotalTimer();
      }
      console.log("✓ Overlay initialized successfully");
    })
    .catch((error) => console.error("✗ Failed to load tasks.json:", error));
}

function loadState() {
  try {
    const saved = localStorage.getItem("cabalTaskOverlayState");
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (parsed && typeof parsed === "object") {
      if (parsed.theme) {
        state.theme = parsed.theme;
      }
      if (
        parsed.transparencyVersion === 2 &&
        typeof parsed.overlayOpacity === "number"
      ) {
        state.overlayOpacity = Math.max(
          0,
          Math.min(100, parsed.overlayOpacity),
        );
      } else {
        // Older saves used the original semitransparent appearance.
        state.overlayOpacity = 100;
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
        state.tasks = parsed.taskUpdates.map((savedTask) => ({
          id: savedTask.id,
          name: savedTask.name ?? "NOVA TASK",
          time: typeof savedTask.time === "number" ? savedTask.time : 0,
          dropName: savedTask.dropName ?? "NENHUM",
          meta: typeof savedTask.meta === "number" ? savedTask.meta : 1,
          repeatCount:
            typeof savedTask.repeatCount === "number"
              ? savedTask.repeatCount
              : 0,
          dropCount:
            typeof savedTask.dropCount === "number" ? savedTask.dropCount : 0,
          completed:
            typeof savedTask.completed === "boolean"
              ? savedTask.completed
              : false,
        }));
      }
      if (parsed.shortcuts && typeof parsed.shortcuts === "object") {
        state.shortcuts = {
          ...state.shortcuts,
          ...parsed.shortcuts,
        };
      }
    }
  } catch (error) {
    console.error("Failed to load saved state:", error);
  }
}

function updateTotalToggleButton() {
  const btnTotalToggleHeader = document.getElementById(
    "btn-total-toggle-header",
  );
  const text = state.isTotalRunning ? "||" : "▶";
  if (btnTotalToggleHeader) {
    btnTotalToggleHeader.innerText = text;
  }
}

function applyOverlayTransparency() {
  document.documentElement.style.setProperty(
    "--overlay-opacity",
    String(state.overlayOpacity / 100),
  );
  const opacityRange = document.getElementById("overlay-opacity-range");
  const opacityValue = document.getElementById("overlay-opacity-value");
  if (opacityRange) {
    opacityRange.value = String(state.overlayOpacity);
  }
  if (opacityValue) {
    opacityValue.innerText = `${state.overlayOpacity}%`;
  }
}

function resizeElectronWindow() {
  if (!window.electronOverlay) return;
  requestAnimationFrame(() => {
    const overlayHeight =
      document.querySelector(".overlay-container")?.scrollHeight || 0;
    const panelHeight =
      document.querySelector(".control-panel")?.scrollHeight || 0;
    const documentHeight = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      overlayHeight,
      panelHeight,
    );
    window.electronOverlay.resizeToContent(documentHeight + 40);
  });
}

function saveShortcutSettings() {
  saveState();
  updateShortcutInputs();
  if (window.electronOverlay) {
    window.electronOverlay.updateShortcuts(state.shortcuts);
  }
}

function updateShortcutInputs() {
  const shortcutElements = {
    dungeonIncrease: "shortcut-dungeon-increase",
    dungeonDecrease: "shortcut-dungeon-decrease",
    dropIncrease: "shortcut-drop-increase",
    dropDecrease: "shortcut-drop-decrease",
  };
  Object.entries(shortcutElements).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.value = state.shortcuts[key].toUpperCase();
    }
  });
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
  const target = event.target;
  if (target.matches("input, textarea, select, [contenteditable='true']")) {
    return;
  }
  const pressedShortcut = shortcutFromEvent(event);
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return;

  const actionByShortcut = {
    [state.shortcuts.dungeonIncrease]: "dungeonIncrease",
    [state.shortcuts.dungeonDecrease]: "dungeonDecrease",
    [state.shortcuts.dropIncrease]: "dropIncrease",
    [state.shortcuts.dropDecrease]: "dropDecrease",
  };
  if (actionByShortcut[pressedShortcut]) {
    event.preventDefault();
    applyShortcut(actionByShortcut[pressedShortcut]);
  }
}

function applyShortcut(action) {
  const task = state.tasks.find((item) => item.id === state.activeTaskId);
  if (!task) return;

  const actions = {
    dungeonIncrease: () => adjustRepeat(task.id, 1),
    dungeonDecrease: () => adjustRepeat(task.id, -1),
    dropIncrease: () => adjustDropCount(task.id, 1),
    dropDecrease: () => adjustDropCount(task.id, -1),
  };
  if (actions[action]) {
    actions[action]();
  }
}

// --- Render Overlay ---
function renderTasks() {
  const taskListEl = document.getElementById("task-list");
  if (!taskListEl) return;

  const controlPanel = document.getElementById("control-panel");
  const panelOpen = controlPanel
    ? !controlPanel.classList.contains("collapsed")
    : false;
  document.body.classList.toggle("actions-visible", panelOpen);
  taskListEl.innerHTML = "";

  let activeDropText = "DROP: NENHUM";

  state.tasks.forEach((task, index) => {
    const isActive = task.id === state.activeTaskId;
    if (isActive && task.dropName) {
      activeDropText = `DROP: ${task.dropName.toUpperCase()}`;
    }

    const taskEl = document.createElement("div");
    taskEl.className = `task-item ${isActive ? "active" : ""} ${task.completed ? "completed" : ""}`;
    taskEl.classList.toggle("show-actions", panelOpen);
    taskEl.draggable = true;
    taskEl.dataset.taskId = String(task.id);
    taskEl.onclick = () => selectActiveTask(task.id);

    taskEl.innerHTML = `
            <span class="task-checkbox" onclick="event.stopPropagation()">
                <input type="checkbox" ${task.completed ? "checked" : ""} onclick="toggleComplete(event, ${task.id})">
            </span>
            <span class="task-num">${index + 1}</span>
            <div class="task-dungeon">
                <span class="task-name" contenteditable="true" title="${task.name}"
                    onclick="event.stopPropagation()"
                    onblur="saveTaskName(event, ${task.id})"
                    onkeydown="if(event.key === 'Enter'){event.preventDefault(); event.target.blur();}">${task.name}</span>
                <div class="task-repeat-controls">
                    <button class="btn-counter" onclick="adjustRepeat(${task.id}, -1)">-</button>
                    <span class="task-repeat">${task.repeatCount}</span>
                    <button class="btn-counter" onclick="adjustRepeat(${task.id}, 1)">+</button>
                </div>
            </div>
            <input class="task-meta-input" type="number" min="0" value="${task.meta}" title="Meta de repetições" onclick="event.stopPropagation()" onchange="updateTaskMeta(event, ${task.id})">
            <span class="task-time" id="task-time-${task.id}" onclick="toggleTaskTimer(event, ${task.id})">${formatTime(task.time)}</span>
            <div class="task-drop">
                <span class="task-drop-name" contenteditable="true" title="${task.dropName}"
                    onclick="event.stopPropagation()"
                    onblur="saveDropName(event, ${task.id})"
                    onkeydown="if(event.key === 'Enter'){event.preventDefault(); event.target.blur();}">${task.dropName}</span>
                <div class="task-count-controls">
                    <button class="btn-counter" onclick="adjustDropCount(${task.id}, -1)">-</button>
                    <span class="drop-count">${task.dropCount}</span>
                    <button class="btn-counter" onclick="adjustDropCount(${task.id}, 1)">+</button>
                </div>
            </div>
            <div class="task-actions" onclick="event.stopPropagation()">
                <button class="task-delete-btn" onclick="deleteTask(${task.id})" title="Excluir task" aria-label="Excluir task">✕</button>
            </div>
        `;

    taskEl.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(task.id));
      taskEl.classList.add("dragging");
    });

    taskEl.addEventListener("dragend", () => {
      taskEl.classList.remove("dragging");
      document.querySelectorAll(".task-item").forEach((item) => {
        item.classList.remove("drag-target");
      });
    });

    taskEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      taskEl.classList.add("drag-target");
    });

    taskEl.addEventListener("dragleave", () => {
      taskEl.classList.remove("drag-target");
    });

    taskEl.addEventListener("drop", (event) => {
      event.preventDefault();
      taskEl.classList.remove("drag-target");
      const draggedTaskId = Number(event.dataTransfer.getData("text/plain"));
      if (!Number.isNaN(draggedTaskId) && draggedTaskId !== task.id) {
        reorderTasks(draggedTaskId, task.id);
      }
    });

    taskListEl.appendChild(taskEl);
  });

  const footerDropText = document.getElementById("footer-drop-text");
  if (footerDropText) {
    footerDropText.innerText = activeDropText;
  }
  resizeElectronWindow();
}

function reorderTasks(sourceId, targetId) {
  const sourceIndex = state.tasks.findIndex((task) => task.id === sourceId);
  const targetIndex = state.tasks.findIndex((task) => task.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return;
  }

  const [movedTask] = state.tasks.splice(sourceIndex, 1);
  state.tasks.splice(targetIndex, 0, movedTask);

  renderTasks();
  saveState();
}

function deleteTask(taskId) {
  const taskIndex = state.tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) return;

  state.tasks.splice(taskIndex, 1);

  if (state.activeTaskId === taskId) {
    state.activeTaskId = state.tasks[0]?.id ?? null;
  }

  renderTasks();
  saveState();
}

// --- Active Task Logic ---
function selectActiveTask(id) {
  state.activeTaskId = id;
  renderTasks();
  saveState();
}

function adjustRepeat(taskId, amount) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    task.repeatCount = Math.max(0, task.repeatCount + amount);
    completeTaskWhenMetaReached(task);
    renderTasks();
    saveState();
  }
}

function updateTaskMeta(event, taskId) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;
  task.meta = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
  completeTaskWhenMetaReached(task);
  renderTasks();
  saveState();
}

function completeTaskWhenMetaReached(task) {
  if (task.meta <= 0 || task.repeatCount < task.meta || task.completed) {
    return;
  }

  task.completed = true;
  const currentIndex = state.tasks.findIndex((item) => item.id === task.id);
  const nextTask = state.tasks
    .slice(currentIndex + 1)
    .find((item) => !item.completed);
  if (nextTask) {
    state.activeTaskId = nextTask.id;
  }
}

function adjustDropCount(taskId, amount) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    task.dropCount = Math.max(0, task.dropCount + amount);
    renderTasks();
    saveState();
  }
}

function saveTaskName(event, taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    const newName = event.target.innerText.trim();
    task.name = newName.length ? newName : task.name;
    saveState();
    renderTasks();
  }
}

function saveDropName(event, taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    const newDropName = event.target.innerText.trim();
    task.dropName = newDropName.length ? newDropName : task.dropName;
    saveState();
    renderTasks();
  }
}

function toggleTaskTimer(event, taskId) {
  event.stopPropagation();
  if (state.activeTaskId !== taskId) {
    state.activeTaskId = taskId;
  }
  state.isTotalRunning = !state.isTotalRunning;
  if (state.isTotalRunning) {
    startTotalTimer();
  } else {
    stopTotalTimer();
  }
  updateTotalToggleButton();
  renderTasks();
  saveState();
}

function toggleComplete(event, taskId) {
  event.stopPropagation();
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    task.completed = event.target.checked;
    renderTasks();
    saveState();
  }
}

// --- Timer Controls ---
let timerSaveCounter = 0;
function startTotalTimer() {
  if (!totalTimerInterval) {
    totalTimerInterval = setInterval(() => {
      state.totalSeconds++;
      document.getElementById("total-timer").innerText = formatTime(
        state.totalSeconds,
      );

      // Increment active task timer if running
      if (state.activeTaskId) {
        const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
        if (activeTask) {
          activeTask.time++;
          const activeTimeEl = document.getElementById(
            `task-time-${activeTask.id}`,
          );
          if (activeTimeEl) {
            activeTimeEl.innerText = formatTime(activeTask.time);
          }
        }
      }

      // Save state every 5 seconds to avoid excessive localStorage writes
      timerSaveCounter++;
      if (timerSaveCounter >= 5) {
        saveState();
        timerSaveCounter = 0;
      }
    }, 1000);
  }
}

function stopTotalTimer() {
  clearInterval(totalTimerInterval);
  totalTimerInterval = null;
}

// --- DOM Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  if (window.electronOverlay) {
    document.documentElement.classList.add("electron-window");
  }
  document.addEventListener("keydown", handleShortcut);

  document.getElementById("minimize-app-btn")?.addEventListener("click", () => {
    window.electronOverlay?.minimize();
  });

  document
    .getElementById("save-close-app-btn")
    ?.addEventListener("click", () => {
      saveState();
      window.electronOverlay?.saveAndClose();
    });

  // Control Panel Collapse Toggle
  const toggleBtn = document.getElementById("toggle-panel-btn");
  const controlPanel = document.getElementById("control-panel");
  toggleBtn.addEventListener("click", () => {
    controlPanel.classList.toggle("collapsed");
    renderTasks();
    resizeElectronWindow();
  });

  // Theme Switcher - Setup event listeners (state.theme will be applied by loadTasksFromJSON)
  const themeButtons = document.querySelectorAll(".theme-btn");
  themeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      themeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.body.className = btn.dataset.theme;
      state.theme = btn.dataset.theme;
      saveState();
    });
  });

  const opacityRange = document.getElementById("overlay-opacity-range");
  if (opacityRange) {
    opacityRange.addEventListener("input", (event) => {
      state.overlayOpacity = Number(event.target.value);
      applyOverlayTransparency();
      saveState();
    });
  }

  setupShortcutInput("shortcut-dungeon-increase", "dungeonIncrease");
  setupShortcutInput("shortcut-dungeon-decrease", "dungeonDecrease");
  setupShortcutInput("shortcut-drop-increase", "dropIncrease");
  setupShortcutInput("shortcut-drop-decrease", "dropDecrease");

  // Start/Pause Total Timer
  const btnTotalToggleHeader = document.getElementById(
    "btn-total-toggle-header",
  );
  const toggleTimer = () => {
    state.isTotalRunning = !state.isTotalRunning;
    if (state.isTotalRunning) {
      startTotalTimer();
    } else {
      stopTotalTimer();
    }
    updateTotalToggleButton();
    saveState();
  };
  if (btnTotalToggleHeader) {
    btnTotalToggleHeader.addEventListener("click", toggleTimer);
  }

  // Reset Total Timer
  document.getElementById("btn-total-reset").addEventListener("click", () => {
    state.totalSeconds = 0;
    document.getElementById("total-timer").innerText = formatTime(0);
    saveState();
  });

  // Reset All (Time and Counters)
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
    document.getElementById("total-timer").innerText = formatTime(0);
    updateTotalToggleButton();
    renderTasks();
    saveState();
  }

  document.getElementById("btn-reset-all").addEventListener("click", () => {
    resetAll();
  });

  // Add Task
  document.getElementById("btn-add-task").addEventListener("click", () => {
    const nameInput = document.getElementById("input-dg-name");
    const dropInput = document.getElementById("input-drop-name");

    if (nameInput.value.trim() !== "") {
      const newTask = {
        id: Date.now(),
        name: nameInput.value.trim(),
        time: 0,
        dropName: dropInput.value.trim() || "NENHUM",
        meta: 1,
        repeatCount: 1,
        dropCount: 0,
        completed: false,
      };
      state.tasks.push(newTask);
      nameInput.value = "";
      dropInput.value = "";
      renderTasks();
      saveState();
    }
  });

  // Initial Render
  loadTasksFromJSON();
});
