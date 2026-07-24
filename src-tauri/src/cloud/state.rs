use chrono::{DateTime, Utc};
use std::sync::Arc;
use tokio::{
    sync::{Mutex, RwLock},
    task::JoinHandle,
};

use super::{
    client::build_http_client,
    models::{AuthPayload, CloudSession, CloudUser},
    token_store,
};

#[derive(Clone)]
pub struct CloudState {
    pub client: reqwest::Client,
    pub server_url: String,
    pub access_token: Arc<RwLock<Option<String>>>,
    pub access_token_expires_at: Arc<RwLock<Option<DateTime<Utc>>>>,
    pub current_user: Arc<RwLock<Option<CloudUser>>>,
    pub refresh_lock: Arc<Mutex<()>>,
    pub websocket_task: Arc<Mutex<Option<JoinHandle<()>>>>,
    pub active_room_id: Arc<RwLock<Option<String>>>,
}

impl CloudState {
    pub fn new() -> Result<Self, String> {
        let default_url = if cfg!(debug_assertions) {
            "http://127.0.0.1:8080"
        } else {
            "https://api.example.com"
        };
        let server_url = option_env!("TOMATO_CLOUD_SERVER_URL")
            .unwrap_or(default_url)
            .trim_end_matches('/')
            .to_string();

        Ok(Self {
            client: build_http_client()?,
            server_url,
            access_token: Arc::new(RwLock::new(None)),
            access_token_expires_at: Arc::new(RwLock::new(None)),
            current_user: Arc::new(RwLock::new(None)),
            refresh_lock: Arc::new(Mutex::new(())),
            websocket_task: Arc::new(Mutex::new(None)),
            active_room_id: Arc::new(RwLock::new(None)),
        })
    }

    pub async fn apply_auth(&self, auth: &AuthPayload) -> Result<CloudSession, String> {
        token_store::save_refresh_token(&auth.refresh_token)?;
        *self.access_token.write().await = Some(auth.access_token.clone());
        *self.access_token_expires_at.write().await = Some(auth.access_token_expires_at);
        *self.current_user.write().await = Some(auth.user.clone());
        Ok(CloudSession::from(auth))
    }

    pub async fn clear(&self) -> Result<(), String> {
        if let Some(task) = self.websocket_task.lock().await.take() {
            task.abort();
        }
        *self.active_room_id.write().await = None;
        *self.access_token.write().await = None;
        *self.access_token_expires_at.write().await = None;
        *self.current_user.write().await = None;
        token_store::delete_refresh_token()
    }
}
