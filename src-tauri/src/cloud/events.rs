use tauri::{AppHandle, Emitter};

pub const AUTH_EXPIRED_EVENT: &str = "cloud://auth-expired";
pub const ROOM_EVENT: &str = "cloud://room-event";
pub const CONNECTION_STATE_EVENT: &str = "cloud://connection-state";

pub fn emit_auth_expired(app: &AppHandle) {
    let _ = app.emit(AUTH_EXPIRED_EVENT, ());
}

pub fn emit_room_event(app: &AppHandle, payload: serde_json::Value) {
    let _ = app.emit(ROOM_EVENT, payload);
}

pub fn emit_connection_state(app: &AppHandle, state: &str) {
    let _ = app.emit(CONNECTION_STATE_EVENT, state);
}
