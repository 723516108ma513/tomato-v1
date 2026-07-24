use reqwest::{Method, StatusCode};
use serde::{de::DeserializeOwned, Serialize};
use std::{fmt, time::Duration};

use super::models::ApiEnvelope;

#[derive(Debug)]
pub struct CloudError {
    pub status: StatusCode,
    pub code: String,
    pub message: String,
}

impl CloudError {
    pub fn is_unauthorized(&self) -> bool {
        self.status == StatusCode::UNAUTHORIZED
    }
}

impl fmt::Display for CloudError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.code, self.message)
    }
}

pub fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(concat!("Tomato-Companion/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| format!("创建云端网络客户端失败：{error}"))
}

pub async fn request_json<T, B>(
    client: &reqwest::Client,
    server_url: &str,
    method: Method,
    path: &str,
    body: Option<&B>,
    access_token: Option<&str>,
) -> Result<T, CloudError>
where
    T: DeserializeOwned,
    B: Serialize + ?Sized,
{
    let url = format!("{server_url}{path}");
    let mut request = client.request(method, url);
    if let Some(body) = body {
        request = request.json(body);
    }
    if let Some(access_token) = access_token {
        request = request.bearer_auth(access_token);
    }

    let response = request.send().await.map_err(|error| CloudError {
        status: StatusCode::SERVICE_UNAVAILABLE,
        code: "CLOUD_UNAVAILABLE".to_string(),
        message: format!("无法连接云端服务：{error}"),
    })?;
    let status = response.status();
    let envelope = response
        .json::<ApiEnvelope<T>>()
        .await
        .map_err(|error| CloudError {
            status,
            code: "INVALID_SERVER_RESPONSE".to_string(),
            message: format!("云端返回了无法识别的数据：{error}"),
        })?;

    if status.is_success() && envelope.success {
        return envelope.data.ok_or_else(|| CloudError {
            status,
            code: "EMPTY_SERVER_RESPONSE".to_string(),
            message: "云端没有返回所需数据".to_string(),
        });
    }

    Err(CloudError {
        status,
        code: envelope
            .code
            .unwrap_or_else(|| format!("HTTP_{}", status.as_u16())),
        message: envelope
            .message
            .unwrap_or_else(|| "云端请求失败，请稍后重试".to_string()),
    })
}

pub async fn request_empty<B>(
    client: &reqwest::Client,
    server_url: &str,
    method: Method,
    path: &str,
    body: Option<&B>,
    access_token: Option<&str>,
) -> Result<(), CloudError>
where
    B: Serialize + ?Sized,
{
    let url = format!("{server_url}{path}");
    let mut request = client.request(method, url);
    if let Some(body) = body {
        request = request.json(body);
    }
    if let Some(access_token) = access_token {
        request = request.bearer_auth(access_token);
    }
    let response = request.send().await.map_err(|error| CloudError {
        status: StatusCode::SERVICE_UNAVAILABLE,
        code: "CLOUD_UNAVAILABLE".to_string(),
        message: format!("无法连接云端服务：{error}"),
    })?;
    let status = response.status();
    let envelope = response
        .json::<ApiEnvelope<serde_json::Value>>()
        .await
        .map_err(|error| CloudError {
            status,
            code: "INVALID_SERVER_RESPONSE".to_string(),
            message: format!("云端返回了无法识别的数据：{error}"),
        })?;
    if status.is_success() && envelope.success {
        return Ok(());
    }
    Err(CloudError {
        status,
        code: envelope
            .code
            .unwrap_or_else(|| format!("HTTP_{}", status.as_u16())),
        message: envelope
            .message
            .unwrap_or_else(|| "云端请求失败，请稍后重试".to_string()),
    })
}
