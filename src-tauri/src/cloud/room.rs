use reqwest::Method;

use super::{
    auth::valid_access_token,
    client::{request_empty, request_json, CloudError},
    models::{CreateRoomRequest, ReadyRequest, StudyRoom, StudySession},
    state::CloudState,
};

async fn token(state: &CloudState) -> Result<String, CloudError> {
    valid_access_token(state).await
}

pub async fn create(
    state: &CloudState,
    team_id: &str,
    request: &CreateRoomRequest,
) -> Result<StudyRoom, CloudError> {
    let access = token(state).await?;
    request_json(
        &state.client,
        &state.server_url,
        Method::POST,
        &format!("/api/v1/teams/{team_id}/rooms"),
        Some(request),
        Some(&access),
    )
    .await
}

pub async fn active(state: &CloudState, team_id: &str) -> Result<Option<StudyRoom>, CloudError> {
    let access = token(state).await?;
    let url = format!(
        "{}{path}",
        state.server_url,
        path = format!("/api/v1/teams/{team_id}/rooms/active")
    );
    let response = state
        .client
        .get(url)
        .bearer_auth(access)
        .send()
        .await
        .map_err(|error| CloudError {
            status: reqwest::StatusCode::SERVICE_UNAVAILABLE,
            code: "CLOUD_UNAVAILABLE".to_string(),
            message: format!("无法连接云端服务：{error}"),
        })?;
    let status = response.status();
    let envelope = response
        .json::<super::models::ApiEnvelope<StudyRoom>>()
        .await
        .map_err(|error| CloudError {
            status,
            code: "INVALID_SERVER_RESPONSE".to_string(),
            message: format!("云端返回了无法识别的数据：{error}"),
        })?;
    if status.is_success() && envelope.success {
        return Ok(envelope.data);
    }
    Err(CloudError {
        status,
        code: envelope
            .code
            .unwrap_or_else(|| format!("HTTP_{}", status.as_u16())),
        message: envelope
            .message
            .unwrap_or_else(|| "云端请求失败".to_string()),
    })
}

pub async fn detail(state: &CloudState, room_id: &str) -> Result<StudyRoom, CloudError> {
    let access = token(state).await?;
    request_json::<StudyRoom, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::GET,
        &format!("/api/v1/rooms/{room_id}"),
        None,
        Some(&access),
    )
    .await
}

pub async fn action(
    state: &CloudState,
    room_id: &str,
    action: &str,
) -> Result<StudyRoom, CloudError> {
    let access = token(state).await?;
    request_json::<StudyRoom, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::POST,
        &format!("/api/v1/rooms/{room_id}/{action}"),
        None,
        Some(&access),
    )
    .await
}

pub async fn ready(
    state: &CloudState,
    room_id: &str,
    ready: bool,
) -> Result<StudyRoom, CloudError> {
    let access = token(state).await?;
    let request = ReadyRequest { ready };
    request_json(
        &state.client,
        &state.server_url,
        Method::PUT,
        &format!("/api/v1/rooms/{room_id}/ready"),
        Some(&request),
        Some(&access),
    )
    .await
}

pub async fn empty_action(
    state: &CloudState,
    room_id: &str,
    action: &str,
) -> Result<(), CloudError> {
    let access = token(state).await?;
    request_empty::<serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::POST,
        &format!("/api/v1/rooms/{room_id}/{action}"),
        None,
        Some(&access),
    )
    .await
}

pub async fn history(state: &CloudState, room_id: &str) -> Result<Vec<StudySession>, CloudError> {
    let access = token(state).await?;
    request_json::<Vec<StudySession>, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::GET,
        &format!("/api/v1/rooms/{room_id}/sessions"),
        None,
        Some(&access),
    )
    .await
}
