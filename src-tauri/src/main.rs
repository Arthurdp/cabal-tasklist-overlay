#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Deserialize;
use std::{collections::HashMap, str::FromStr, sync::Mutex};
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, Position, Size, WebviewWindow,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_opener::OpenerExt;

#[derive(Default)]
struct ShortcutActions(Mutex<HashMap<String, String>>);

#[derive(Deserialize)]
struct SavedPosition {
    x: i32,
    y: i32,
}

fn normalize_shortcut(shortcut: &str) -> String {
    shortcut
        .split('+')
        .map(str::trim)
        .filter(|part| !part.is_empty())
        .map(|part| match part.to_ascii_lowercase().as_str() {
            "meta" | "ctrl" | "control" => "ctrl".to_string(),
            "arrowup" => "up".to_string(),
            "arrowdown" => "down".to_string(),
            "arrowleft" => "left".to_string(),
            "arrowright" => "right".to_string(),
            other => other.to_string(),
        })
        .collect::<Vec<_>>()
        .join("+")
}

#[tauri::command]
fn update_shortcuts(app: AppHandle, shortcuts: HashMap<String, String>) -> Result<(), String> {
    app.global_shortcut()
        .unregister_all()
        .map_err(|error| format!("Não foi possível liberar os atalhos anteriores: {error}"))?;
    let mut actions = HashMap::new();
    let mut errors = Vec::new();
    let mut configured_shortcuts: Vec<_> = shortcuts.into_iter().collect();
    configured_shortcuts.sort_by(|a, b| a.0.cmp(&b.0));
    let mut shortcut_owners = HashMap::new();

    for (action, configured) in configured_shortcuts {
        if !matches!(
            action.as_str(),
            "dungeonIncrease" | "dungeonDecrease" | "dropIncrease" | "dropDecrease"
        ) {
            continue;
        }

        let normalized = normalize_shortcut(&configured);
        if normalized.is_empty() {
            continue;
        }

        if let Some(existing_action) = shortcut_owners.get(&normalized) {
            errors.push(format!(
                "'{configured}' está duplicado nas ações {existing_action} e {action}"
            ));
            continue;
        }
        shortcut_owners.insert(normalized.clone(), action.clone());

        let shortcut = match Shortcut::from_str(&normalized) {
            Ok(shortcut) => shortcut,
            Err(error) => {
                errors.push(format!("'{configured}' é inválido: {error}"));
                continue;
            }
        };
        match app.global_shortcut().register(shortcut.clone()) {
            Ok(()) => {
                actions.insert(shortcut.to_string().to_ascii_lowercase(), action);
            }
            Err(error) => errors.push(format!(
                "não foi possível registrar '{configured}' para {action}: {error}"
            )),
        }
    }

    if let Ok(mut current) = app.state::<ShortcutActions>().0.lock() {
        *current = actions;
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[tauri::command]
fn resize_to_content(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    let width = width.ceil().clamp(200.0, 4000.0);
    let height = height.ceil().clamp(120.0, 4000.0);
    window
        .set_size(Size::Logical(LogicalSize::new(width, height)))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_always_on_top(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn minimize_app(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn close_app(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if !lower.starts_with("https://") && !lower.starts_with("http://") {
        return Err("Somente links HTTP/HTTPS são permitidos".into());
    }
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|error| error.to_string())
}

fn restore_position(window: &WebviewWindow, app: &AppHandle) {
    let Ok(path) = app.path().app_data_dir() else {
        return;
    };
    let Ok(saved) = std::fs::read_to_string(path.join("window-bounds.json")) else {
        return;
    };
    let Ok(position) = serde_json::from_str::<SavedPosition>(&saved) else {
        return;
    };
    let Ok(monitors) = window.available_monitors() else {
        return;
    };

    let visible = monitors.iter().any(|monitor| {
        let origin = monitor.position();
        let size = monitor.size();
        position.x >= origin.x - 50
            && position.y >= origin.y - 50
            && position.x < origin.x + size.width as i32 - 50
            && position.y < origin.y + size.height as i32 - 50
    });

    if visible {
        let _ = window.set_position(Position::Physical(PhysicalPosition::new(
            position.x, position.y,
        )));
    }
}

fn save_position(window: &tauri::Window, position: &PhysicalPosition<i32>) {
    let Ok(mut path) = window.app_handle().path().app_data_dir() else {
        return;
    };
    if std::fs::create_dir_all(&path).is_err() {
        return;
    }
    path.push("window-bounds.json");
    let contents = format!("{{\"x\":{},\"y\":{}}}", position.x, position.y);
    let _ = std::fs::write(path, contents);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(ShortcutActions::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let key = shortcut.to_string().to_ascii_lowercase();
                    let action = app
                        .state::<ShortcutActions>()
                        .0
                        .lock()
                        .ok()
                        .and_then(|actions| actions.get(&key).cloned());
                    let Some(action) = action else {
                        return;
                    };
                    if let Some(window) = app.get_webview_window("main") {
                        if !window.is_focused().unwrap_or(false) {
                            let _ = app.emit("global-shortcut", action);
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            update_shortcuts,
            resize_to_content,
            set_always_on_top,
            minimize_app,
            close_app,
            open_external
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                restore_position(&window, app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Moved(position) = event {
                save_position(window, position);
            }
        })
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o aplicativo Tauri");
}

fn main() {
    run();
}
