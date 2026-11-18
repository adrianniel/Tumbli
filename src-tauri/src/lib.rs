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

#[derive(serde::Serialize)]
struct StartupStatus {
    /// running from the Microsoft Store (MSIX) package
    packaged: bool,
    /// StartupTask state when packaged: enabled, disabled, disabled_by_user, ...
    state: String,
}

/// "Start with Windows" for the MSIX build goes through the package's StartupTask;
/// the plain installer uses tauri-plugin-autostart from the frontend instead.
#[tauri::command]
async fn startup_status() -> StartupStatus {
    #[cfg(windows)]
    if startup::is_packaged() {
        return StartupStatus {
            packaged: true,
            state: startup::state(),
        };
    }
    StartupStatus {
        packaged: false,
        state: String::new(),
    }
}

#[tauri::command]
async fn startup_set(enable: bool) -> String {
    #[cfg(windows)]
    return startup::set(enable);
    #[cfg(not(windows))]
    {
        let _ = enable;
        String::new()
    }
}

/// Is the primary mouse button still held? The widget uses it to know when a drag really ended.
#[tauri::command]
fn primary_button_down() -> bool {
    platform::primary_button_down()
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

    pub fn primary_button_down() -> bool {
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_SWAPBUTTON};
        // VK_LBUTTON = 1, VK_RBUTTON = 2; left-handed setups swap them
        let vk = if unsafe { GetSystemMetrics(SM_SWAPBUTTON) } != 0 { 2 } else { 1 };
        (unsafe { GetAsyncKeyState(vk) } as u16 & 0x8000) != 0
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

#[cfg(windows)]
mod startup {
    use windows::core::HSTRING;
    use windows::ApplicationModel::{StartupTask, StartupTaskState};
    use windows_sys::Win32::Storage::Packaging::Appx::GetCurrentPackageFullName;

    /// Must match TaskId in packaging/msix/AppxManifest.template.xml
    const TASK_ID: &str = "TumbliStartup";
    const APPMODEL_ERROR_NO_PACKAGE: u32 = 15700;

    pub fn is_packaged() -> bool {
        let mut len: u32 = 0;
        unsafe { GetCurrentPackageFullName(&mut len, std::ptr::null_mut()) != APPMODEL_ERROR_NO_PACKAGE }
    }

    fn task() -> windows::core::Result<StartupTask> {
        StartupTask::GetAsync(&HSTRING::from(TASK_ID))?.get()
    }

    fn name(s: StartupTaskState) -> &'static str {
        match s {
            StartupTaskState::Enabled => "enabled",
            StartupTaskState::Disabled => "disabled",
            StartupTaskState::DisabledByUser => "disabled_by_user",
            StartupTaskState::DisabledByPolicy => "disabled_by_policy",
            StartupTaskState::EnabledByPolicy => "enabled_by_policy",
            _ => "unknown",
        }
    }

    pub fn state() -> String {
        task().and_then(|t| t.State()).map(name).unwrap_or("unknown").to_string()
    }

    pub fn set(enable: bool) -> String {
        task()
            .and_then(|t| {
                if enable {
                    t.RequestEnableAsync()?.get()
                } else {
                    t.Disable()?;
                    t.State()
                }
            })
            .map(name)
            .unwrap_or("unknown")
            .to_string()
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
    pub fn primary_button_down() -> bool {
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
        .invoke_handler(tauri::generate_handler![system_status, open_settings, startup_status, startup_set, primary_button_down])
        .setup(|app| {
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let reset_i =
                MenuItem::with_id(app, "reset_pos", "Reset widget position", true, None::<&str>)?;
            let pause_hour_i =
                MenuItem::with_id(app, "pause_60", "Pause for 1 hour", true, None::<&str>)?;
            let pause_day_i =
                MenuItem::with_id(app, "pause_day", "Pause until tomorrow", true, None::<&str>)?;
            let resume_i = MenuItem::with_id(app, "resume", "Resume reminders", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Tumbli", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &settings_i,
                    &reset_i,
                    &sep1,
                    &pause_hour_i,
                    &pause_day_i,
                    &resume_i,
                    &sep2,
                    &quit_i,
                ],
            )?;

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
                    // the widget owns the reminder state; it just needs to hear about it
                    "pause_60" => {
                        let _ = app.emit("tumbli:pause", "hour");
                    }
                    "pause_day" => {
                        let _ = app.emit("tumbli:pause", "day");
                    }
                    "resume" => {
                        let _ = app.emit("tumbli:pause", "resume");
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
