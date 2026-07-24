use tauri::{AppHandle, State};

use super::{
    auth,
    events::emit_auth_expired,
    models::{
        CloudSession, CloudUser, CreateRoomRequest, LoginRequest, RegisterRequest, StudyRoom,
        StudySession, Team, TeamWriteRequest, UpdateUserRequest,
    },
    room, team, websocket, CloudState,
};

#[tauri::command]
pub async fn cloud_register(
    state: State<'_, CloudState>,
    email: String,
    password: String,
    nickname: String,
) -> Result<CloudSession, String> {
    let request = RegisterRequest {
        email,
        password,
        nickname,
    };
    auth::register(&state, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_login(
    state: State<'_, CloudState>,
    email: String,
    password: String,
) -> Result<CloudSession, String> {
    let request = LoginRequest { email, password };
    auth::login(&state, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_restore_session(
    state: State<'_, CloudState>,
) -> Result<Option<CloudSession>, String> {
    match auth::refresh(&state).await {
        Ok(session) => Ok(Some(session)),
        Err(error) => {
            if error.is_unauthorized() {
                let _ = state.clear().await;
            }
            Ok(None)
        }
    }
}

#[tauri::command]
pub async fn cloud_refresh_session(
    app: AppHandle,
    state: State<'_, CloudState>,
) -> Result<CloudSession, String> {
    match auth::refresh(&state).await {
        Ok(session) => Ok(session),
        Err(error) => {
            if error.is_unauthorized() {
                let _ = state.clear().await;
                emit_auth_expired(&app);
            }
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn cloud_logout(state: State<'_, CloudState>) -> Result<(), String> {
    auth::logout(&state).await
}

#[tauri::command]
pub async fn cloud_get_current_user(
    state: State<'_, CloudState>,
) -> Result<Option<CloudUser>, String> {
    Ok(state.current_user.read().await.clone())
}

#[tauri::command]
pub async fn cloud_update_current_user(
    app: AppHandle,
    state: State<'_, CloudState>,
    nickname: String,
    avatar_url: Option<String>,
) -> Result<CloudUser, String> {
    let request = UpdateUserRequest {
        nickname,
        avatar_url,
    };
    match auth::update_current_user(&state, &request).await {
        Ok(user) => Ok(user),
        Err(error) => {
            if error.is_unauthorized() {
                let _ = state.clear().await;
                emit_auth_expired(&app);
            }
            Err(error.to_string())
        }
    }
}

#[tauri::command]
pub async fn cloud_list_teams(state: State<'_, CloudState>) -> Result<Vec<Team>, String> {
    team::list(&state).await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_get_team(state: State<'_, CloudState>, team_id: String) -> Result<Team, String> {
    team::detail(&state, &team_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_create_team(
    state: State<'_, CloudState>,
    name: String,
    description: String,
) -> Result<Team, String> {
    let request = TeamWriteRequest { name, description };
    team::create(&state, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_update_team(
    state: State<'_, CloudState>,
    team_id: String,
    name: String,
    description: String,
) -> Result<Team, String> {
    let request = TeamWriteRequest { name, description };
    team::update(&state, &team_id, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_join_team(
    state: State<'_, CloudState>,
    invite_code: String,
) -> Result<Team, String> {
    team::join(&state, &invite_code)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_rotate_team_invite(
    state: State<'_, CloudState>,
    team_id: String,
) -> Result<Team, String> {
    team::rotate_invite(&state, &team_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_leave_team(state: State<'_, CloudState>, team_id: String) -> Result<(), String> {
    team::leave(&state, &team_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_remove_team_member(
    state: State<'_, CloudState>,
    team_id: String,
    user_id: String,
) -> Result<(), String> {
    team::remove_member(&state, &team_id, &user_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_delete_team(
    state: State<'_, CloudState>,
    team_id: String,
) -> Result<(), String> {
    team::delete(&state, &team_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_create_room(
    state: State<'_, CloudState>,
    team_id: String,
    name: String,
    focus_seconds: i32,
) -> Result<StudyRoom, String> {
    let request = CreateRoomRequest {
        name,
        focus_seconds,
    };
    room::create(&state, &team_id, &request)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_get_active_room(
    state: State<'_, CloudState>,
    team_id: String,
) -> Result<Option<StudyRoom>, String> {
    room::active(&state, &team_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_get_room(
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<StudyRoom, String> {
    room::detail(&state, &room_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_join_room(
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<StudyRoom, String> {
    room::action(&state, &room_id, "join")
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_set_room_ready(
    state: State<'_, CloudState>,
    room_id: String,
    ready: bool,
) -> Result<StudyRoom, String> {
    room::ready(&state, &room_id, ready)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_start_room(
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<StudyRoom, String> {
    room::action(&state, &room_id, "start")
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_leave_room(
    app: AppHandle,
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<(), String> {
    let result = room::empty_action(&state, &room_id, "leave")
        .await
        .map_err(|error| error.to_string());
    websocket::disconnect(&app, &state).await;
    result
}

#[tauri::command]
pub async fn cloud_cancel_room(
    app: AppHandle,
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<(), String> {
    let result = room::empty_action(&state, &room_id, "cancel")
        .await
        .map_err(|error| error.to_string());
    websocket::disconnect(&app, &state).await;
    result
}

#[tauri::command]
pub async fn cloud_room_history(
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<Vec<StudySession>, String> {
    room::history(&state, &room_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn cloud_connect_room_socket(
    app: AppHandle,
    state: State<'_, CloudState>,
    room_id: String,
) -> Result<(), String> {
    websocket::connect(app, state.inner().clone(), room_id).await
}

#[tauri::command]
pub async fn cloud_disconnect_room_socket(
    app: AppHandle,
    state: State<'_, CloudState>,
) -> Result<(), String> {
    websocket::disconnect(&app, &state).await;
    Ok(())
}
