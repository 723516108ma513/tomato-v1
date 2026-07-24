use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::AppHandle;
use tokio::time::{interval, sleep};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{
        client::IntoClientRequest,
        http::{header::AUTHORIZATION, HeaderValue},
        Message,
    },
};

use super::{
    auth::valid_access_token,
    events::{emit_connection_state, emit_room_event},
    state::CloudState,
};

pub async fn connect(app: AppHandle, state: CloudState, room_id: String) -> Result<(), String> {
    disconnect(&app, &state).await;
    *state.active_room_id.write().await = Some(room_id.clone());
    let task_state = state.clone();
    let task = tokio::spawn(async move {
        run_connection(app, task_state, room_id).await;
    });
    *state.websocket_task.lock().await = Some(task);
    Ok(())
}

pub async fn disconnect(app: &AppHandle, state: &CloudState) {
    *state.active_room_id.write().await = None;
    if let Some(task) = state.websocket_task.lock().await.take() {
        task.abort();
    }
    emit_connection_state(app, "disconnected");
}

async fn run_connection(app: AppHandle, state: CloudState, room_id: String) {
    let mut attempt: u32 = 0;
    loop {
        if state.active_room_id.read().await.as_deref() != Some(room_id.as_str()) {
            break;
        }
        let access_token = match valid_access_token(&state).await {
            Ok(token) => token,
            Err(_) => {
                emit_connection_state(&app, "auth-expired");
                break;
            }
        };
        let ws_base = if state.server_url.starts_with("https://") {
            state.server_url.replacen("https://", "wss://", 1)
        } else {
            state.server_url.replacen("http://", "ws://", 1)
        };
        let url = format!("{ws_base}/ws/v1/rooms/{room_id}");
        let mut request = match url.into_client_request() {
            Ok(request) => request,
            Err(_) => break,
        };
        let header = match HeaderValue::from_str(&format!("Bearer {access_token}")) {
            Ok(header) => header,
            Err(_) => break,
        };
        request.headers_mut().insert(AUTHORIZATION, header);

        if let Ok((socket, _)) = connect_async(request).await {
            attempt = 0;
            emit_connection_state(&app, "connected");
            let (mut writer, mut reader) = socket.split();
            let mut heartbeat = interval(Duration::from_secs(25));
            let disconnected = loop {
                tokio::select! {
                    _ = heartbeat.tick() => {
                        let ping = json!({"type":"PING","timestamp":chrono::Utc::now()}).to_string();
                        if writer.send(Message::Text(ping.into())).await.is_err() {
                            break true;
                        }
                    }
                    message = reader.next() => {
                        match message {
                            Some(Ok(Message::Text(text))) => {
                                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                                    emit_room_event(&app, value);
                                }
                            }
                            Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break true,
                            _ => {}
                        }
                    }
                }
                if state.active_room_id.read().await.as_deref() != Some(room_id.as_str()) {
                    break false;
                }
            };
            if !disconnected {
                break;
            }
        }

        attempt = attempt.saturating_add(1);
        emit_connection_state(&app, "reconnecting");
        let base = 2_u64.saturating_pow(attempt.min(4)).min(30);
        let jitter = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.subsec_millis() as u64 % 700)
            .unwrap_or(0);
        sleep(Duration::from_millis(base * 1000 + jitter)).await;
    }
    emit_connection_state(&app, "disconnected");
}
