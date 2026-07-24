mod ai;
mod cloud;
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
            app.manage(cloud::CloudState::new().map_err(std::io::Error::other)?);
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
            commands::record_remote_pomodoro,
            commands::save_provider_config,
            commands::save_provider_secret,
            commands::delete_provider_secret,
            commands::provider_catalog,
            commands::test_provider_connection,
            commands::companion_styles,
            commands::save_companion_profile,
            commands::save_proactive_settings,
            commands::maybe_generate_check_in,
            commands::send_chat,
            commands::generate_learning_plan,
            commands::delete_memory,
            commands::save_timer_state,
            commands::load_timer_state,
            cloud::commands::cloud_register,
            cloud::commands::cloud_login,
            cloud::commands::cloud_restore_session,
            cloud::commands::cloud_refresh_session,
            cloud::commands::cloud_logout,
            cloud::commands::cloud_get_current_user,
            cloud::commands::cloud_update_current_user,
            cloud::commands::cloud_list_teams,
            cloud::commands::cloud_get_team,
            cloud::commands::cloud_create_team,
            cloud::commands::cloud_update_team,
            cloud::commands::cloud_join_team,
            cloud::commands::cloud_rotate_team_invite,
            cloud::commands::cloud_leave_team,
            cloud::commands::cloud_remove_team_member,
            cloud::commands::cloud_delete_team,
            cloud::commands::cloud_create_room,
            cloud::commands::cloud_get_active_room,
            cloud::commands::cloud_get_room,
            cloud::commands::cloud_join_room,
            cloud::commands::cloud_set_room_ready,
            cloud::commands::cloud_start_room,
            cloud::commands::cloud_leave_room,
            cloud::commands::cloud_cancel_room,
            cloud::commands::cloud_room_history,
            cloud::commands::cloud_connect_room_socket,
            cloud::commands::cloud_disconnect_room_socket
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Tomato Companion");
}
