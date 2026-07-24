use reqwest::Method;

use super::{
    auth::valid_access_token,
    client::{request_empty, request_json, CloudError},
    models::{JoinTeamRequest, Team, TeamWriteRequest},
    state::CloudState,
};

pub async fn list(state: &CloudState) -> Result<Vec<Team>, CloudError> {
    let token = valid_access_token(state).await?;
    request_json::<Vec<Team>, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::GET,
        "/api/v1/teams",
        None,
        Some(&token),
    )
    .await
}

pub async fn detail(state: &CloudState, team_id: &str) -> Result<Team, CloudError> {
    let token = valid_access_token(state).await?;
    request_json::<Team, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::GET,
        &format!("/api/v1/teams/{team_id}"),
        None,
        Some(&token),
    )
    .await
}

pub async fn create(state: &CloudState, request: &TeamWriteRequest) -> Result<Team, CloudError> {
    let token = valid_access_token(state).await?;
    request_json(
        &state.client,
        &state.server_url,
        Method::POST,
        "/api/v1/teams",
        Some(request),
        Some(&token),
    )
    .await
}

pub async fn update(
    state: &CloudState,
    team_id: &str,
    request: &TeamWriteRequest,
) -> Result<Team, CloudError> {
    let token = valid_access_token(state).await?;
    request_json(
        &state.client,
        &state.server_url,
        Method::PATCH,
        &format!("/api/v1/teams/{team_id}"),
        Some(request),
        Some(&token),
    )
    .await
}

pub async fn join(state: &CloudState, invite_code: &str) -> Result<Team, CloudError> {
    let token = valid_access_token(state).await?;
    let request = JoinTeamRequest {
        invite_code: invite_code.to_string(),
    };
    request_json(
        &state.client,
        &state.server_url,
        Method::POST,
        "/api/v1/teams/join",
        Some(&request),
        Some(&token),
    )
    .await
}

pub async fn rotate_invite(state: &CloudState, team_id: &str) -> Result<Team, CloudError> {
    let token = valid_access_token(state).await?;
    request_json::<Team, serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::POST,
        &format!("/api/v1/teams/{team_id}/invite-code/rotate"),
        None,
        Some(&token),
    )
    .await
}

pub async fn leave(state: &CloudState, team_id: &str) -> Result<(), CloudError> {
    let token = valid_access_token(state).await?;
    request_empty::<serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::POST,
        &format!("/api/v1/teams/{team_id}/leave"),
        None,
        Some(&token),
    )
    .await
}

pub async fn remove_member(
    state: &CloudState,
    team_id: &str,
    user_id: &str,
) -> Result<(), CloudError> {
    let token = valid_access_token(state).await?;
    request_empty::<serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::DELETE,
        &format!("/api/v1/teams/{team_id}/members/{user_id}"),
        None,
        Some(&token),
    )
    .await
}

pub async fn delete(state: &CloudState, team_id: &str) -> Result<(), CloudError> {
    let token = valid_access_token(state).await?;
    request_empty::<serde_json::Value>(
        &state.client,
        &state.server_url,
        Method::DELETE,
        &format!("/api/v1/teams/{team_id}"),
        None,
        Some(&token),
    )
    .await
}
