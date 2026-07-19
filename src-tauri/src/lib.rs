mod ai;
mod commands;
mod db;
mod models;

use std::fs;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let database = db::open(&data_dir.join("tomato-companion.db"))?;
            app.manage(db::DbState(std::sync::Mutex::new(database)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_snapshot,
            commands::create_task,
            commands::create_project,
            commands::import_learning_plan,
            commands::toggle_task,
            commands::delete_task,
            commands::complete_pomodoro,
            commands::save_provider_config,
            commands::save_provider_secret,
            commands::delete_provider_secret,
            commands::provider_catalog,
            commands::test_provider_connection,
            commands::companion_styles,
            commands::save_companion_profile,
            commands::send_chat,
            commands::generate_learning_plan,
            commands::delete_memory,
            commands::save_timer_state,
            commands::load_timer_state
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Tomato Companion");
}
