use chrono::{Duration, Utc};
use reqwest::Method;

use super::{
    client::{request_json, CloudError},
    models::{
        AuthPayload, CloudSession, CloudUser, LoginRequest, LogoutRequest, RefreshRequest,
        RegisterRequest, UpdateUserRequest,
    },
    state::CloudState,
    token_store,
};

pub async fn register(
    state: &CloudState,
    request: &RegisterRequest,
) -> Result<CloudSession, CloudError> {
    let auth = request_json::<AuthPayload, _>(
        &state.client,
        &state.server_url,
        Method::POST,
        "/api/v1/auth/register",
        Some(request),
        None,
    )
    .await?;
    state.apply_auth(&auth).await.map_err(storage_error)?;
    Ok(CloudSession::from(&auth))
}

pub async fn login(state: &CloudState, request: &LoginRequest) -> Result<CloudSession, CloudError> {
    let auth = request_json::<AuthPayload, _>(
        &state.client,
        &state.server_url,
        Method::POST,
        "/api/v1/auth/login",
        Some(request),
        None,
    )
    .await?;
    state.apply_auth(&auth).await.map_err(storage_error)?;
    Ok(CloudSession::from(&auth))
}

pub async fn refresh(state: &CloudState) -> Result<CloudSession, CloudError> {
    let _refresh_guard = state.refresh_lock.lock().await;
    let refresh_token = token_store::load_refresh_token()
        .map_err(storage_error)?
        .ok_or_else(|| CloudError {
            status: reqwest::StatusCode::UNAUTHORIZED,
            code: "NO_REFRESH_TOKEN".to_string(),
            message: "本机没有可恢复的登录状态".to_string(),
        })?;
    let request = RefreshRequest { refresh_token };
    let auth = request_json::<AuthPayload, _>(
        &state.client,
        &state.server_url,
        Method::POST,
        "/api/v1/auth/refresh",
        Some(&request),
        None,
    )
    .await?;
    state.apply_auth(&auth).await.map_err(storage_error)?;
    Ok(CloudSession::from(&auth))
}

pub async fn logout(state: &CloudState) -> Result<(), String> {
    let refresh_token = token_store::load_refresh_token().ok().flatten();
    let access_token = state.access_token.read().await.clone();

    if let (Some(refresh_token), Some(access_token)) = (refresh_token, access_token) {
        let request = LogoutRequest { refresh_token };
        let _: Result<serde_json::Value, _> = request_json(
            &state.client,
            &state.server_url,
            Method::POST,
            "/api/v1/auth/logout",
            Some(&request),
            Some(&access_token),
        )
        .await;
    }

    state.clear().await
}

pub async fn update_current_user(
    state: &CloudState,
    request: &UpdateUserRequest,
) -> Result<CloudUser, CloudError> {
    let access_token = state
        .access_token
        .read()
        .await
        .clone()
        .ok_or_else(|| CloudError {
            status: reqwest::StatusCode::UNAUTHORIZED,
            code: "NOT_AUTHENTICATED".to_string(),
            message: "请先登录账号".to_string(),
        })?;

    let user = request_json::<CloudUser, _>(
        &state.client,
        &state.server_url,
        Method::PATCH,
        "/api/v1/users/me",
        Some(request),
        Some(&access_token),
    )
    .await?;
    *state.current_user.write().await = Some(user.clone());
    Ok(user)
}

fn storage_error(message: String) -> CloudError {
    CloudError {
        status: reqwest::StatusCode::INTERNAL_SERVER_ERROR,
        code: "CREDENTIAL_STORE_ERROR".to_string(),
        message,
    }
}

pub async fn valid_access_token(state: &CloudState) -> Result<String, CloudError> {
    let expires_at = *state.access_token_expires_at.read().await;
    let needs_refresh = expires_at
        .map(|expires| expires <= Utc::now() + Duration::seconds(60))
        .unwrap_or(true);
    if needs_refresh {
        refresh(state).await?;
    }
    state
        .access_token
        .read()
        .await
        .clone()
        .ok_or_else(|| CloudError {
            status: reqwest::StatusCode::UNAUTHORIZED,
            code: "NOT_AUTHENTICATED".to_string(),
            message: "请先登录账号".to_string(),
        })
}
