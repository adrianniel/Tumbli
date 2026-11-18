use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};

#[derive(serde::Serialize)]
struct SystemStatus {
    /// Seconds since the last keyboard/mouse input.
    idle_secs: u64,
    /// A fullscreen app, game or presentation is in front.
    busy: bool,
}

#[tauri::command]
fn system_status() -> SystemStatus {
    SystemStatus {
        idle_secs: platform::idle_secs(),
        busy: platform::fullscreen_busy(),
    }
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings(&app);
}

fn show_settings(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg(windows)]
mod platform {
    use windows_sys::Win32::System::SystemInformation::GetTickCount;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};
    use windows_sys::Win32::UI::Shell::SHQueryUserNotificationState;

    pub fn idle_secs() -> u64 {
        unsafe {
            let mut info = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut info) == 0 {
                return 0;
            }
            (GetTickCount().wrapping_sub(info.dwTime) / 1000) as u64
        }
    }

    pub fn fullscreen_busy() -> bool {
        // QUNS_BUSY = 2, QUNS_RUNNING_D3D_FULL_SCREEN = 3, QUNS_PRESENTATION_MODE = 4
        unsafe {
            let mut state = 0;
            if SHQueryUserNotificationState(&mut state) != 0 {
                return false;
            }
            matches!(state, 2 | 3 | 4)
        }
    }
}

#[cfg(not(windows))]
mod platform {
    pub fn idle_secs() -> u64 {
        0
    }
    pub fn fullscreen_busy() -> bool {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // a second launch just opens settings instead of a second widget
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_settings(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![system_status, open_settings])
        .setup(|app| {
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let reset_i =
                MenuItem::with_id(app, "reset_pos", "Reset widget position", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Tumbli", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&settings_i, &reset_i, &sep, &quit_i])?;

            TrayIconBuilder::with_id("tumbli-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Tumbli")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => show_settings(app),
                    "reset_pos" => {
                        let _ = app.emit("tumbli:reset-position", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_settings(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing never quits: settings hides, the widget stays on screen.
            // The only way out is "Quit Tumbli" in the tray menu.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if window.label() == "settings" {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Tumbli");
}
