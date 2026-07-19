use reqwest::Client;
use serde_json::{json, Value};

use crate::models::{ChatMessage, ProviderCatalogItem};

#[derive(Debug, Clone)]
pub struct ProviderRuntime {
    pub provider_type: String,
    pub base_url: String,
    pub model: String,
    pub api_key: Option<String>,
}

fn item(
    id: &str,
    name: &str,
    provider_type: &str,
    base_url: &str,
    default_model: &str,
    requires_key: bool,
    description: &str,
) -> ProviderCatalogItem {
    ProviderCatalogItem {
        id: id.to_string(),
        name: name.to_string(),
        provider_type: provider_type.to_string(),
        base_url: base_url.to_string(),
        default_model: default_model.to_string(),
        requires_key,
        description: description.to_string(),
    }
}

pub fn catalog() -> Vec<ProviderCatalogItem> {
    vec![
        item(
            "deepseek",
            "DeepSeek",
            "openai-compatible",
            "https://api.deepseek.com",
            "deepseek-chat",
            true,
            "适合中文学习、推理与知识拆解",
        ),
        item(
            "openai",
            "OpenAI",
            "openai-compatible",
            "https://api.openai.com/v1",
            "gpt-5-mini",
            true,
            "通用能力均衡，适合学习规划和讲解",
        ),
        item(
            "qwen",
            "通义千问",
            "openai-compatible",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "qwen-plus",
            true,
            "中文体验良好，使用阿里云百炼密钥",
        ),
        item(
            "anthropic",
            "Anthropic Claude",
            "anthropic",
            "https://api.anthropic.com",
            "claude-sonnet-5",
            true,
            "擅长长文本理解与耐心讲解",
        ),
        item(
            "gemini",
            "Google Gemini",
            "gemini",
            "https://generativelanguage.googleapis.com/v1beta",
            "gemini-3.5-flash",
            true,
            "响应快速，支持 Google Gemini API Key",
        ),
        item(
            "ollama",
            "Ollama 本地模型",
            "ollama",
            "http://127.0.0.1:11434",
            "qwen2.5:7b",
            false,
            "完全在本机运行，需要先安装并启动 Ollama",
        ),
    ]
}

pub fn catalog_item(id: &str) -> Option<ProviderCatalogItem> {
    catalog().into_iter().find(|item| item.id == id)
}

fn endpoint(base: &str, suffix: &str) -> String {
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        suffix.trim_start_matches('/')
    )
}

pub async fn complete(
    runtime: &ProviderRuntime,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|error| format!("无法初始化模型连接：{error}"))?;

    match runtime.provider_type.as_str() {
        "anthropic" => complete_anthropic(&client, runtime, system_prompt, messages).await,
        "gemini" => complete_gemini(&client, runtime, system_prompt, messages).await,
        "ollama" => complete_ollama(&client, runtime, system_prompt, messages).await,
        _ => complete_openai_compatible(&client, runtime, system_prompt, messages).await,
    }
}

async fn complete_openai_compatible(
    client: &Client,
    runtime: &ProviderRuntime,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let mut payload_messages = vec![json!({"role": "system", "content": system_prompt})];
    payload_messages.extend(
        messages
            .iter()
            .map(|message| json!({"role": message.role, "content": message.content})),
    );
    let body = if runtime.base_url.contains("api.openai.com") {
        json!({
            "model": runtime.model,
            "messages": payload_messages,
            "max_completion_tokens": 1800
        })
    } else {
        json!({
            "model": runtime.model,
            "messages": payload_messages,
            "max_tokens": 1800
        })
    };
    let mut request = client
        .post(endpoint(&runtime.base_url, "chat/completions"))
        .json(&body);
    if let Some(key) = &runtime.api_key {
        request = request.bearer_auth(key);
    }
    let value = send_json(request).await?;
    value["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| response_error(&value))
}

async fn complete_anthropic(
    client: &Client,
    runtime: &ProviderRuntime,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let request = client
        .post(endpoint(&runtime.base_url, "v1/messages"))
        .header("x-api-key", runtime.api_key.as_deref().unwrap_or_default())
        .header("anthropic-version", "2023-06-01")
        .json(&json!({
            "model": runtime.model,
            "system": system_prompt,
            "messages": messages.iter().map(|message| json!({
                "role": message.role,
                "content": message.content
            })).collect::<Vec<_>>(),
            "max_tokens": 1800
        }));
    let value = send_json(request).await?;
    value["content"][0]["text"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| response_error(&value))
}

async fn complete_gemini(
    client: &Client,
    runtime: &ProviderRuntime,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let url = endpoint(
        &runtime.base_url,
        &format!("models/{}:generateContent", runtime.model),
    );
    let request = client
        .post(url)
        .header(
            "x-goog-api-key",
            runtime.api_key.as_deref().unwrap_or_default(),
        )
        .json(&json!({
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": messages.iter().map(|message| json!({
                "role": if message.role == "assistant" { "model" } else { "user" },
                "parts": [{"text": message.content}]
            })).collect::<Vec<_>>(),
            "generationConfig": {"temperature": 0.65, "maxOutputTokens": 1800}
        }));
    let value = send_json(request).await?;
    value["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| response_error(&value))
}

async fn complete_ollama(
    client: &Client,
    runtime: &ProviderRuntime,
    system_prompt: &str,
    messages: &[ChatMessage],
) -> Result<String, String> {
    let mut payload_messages = vec![json!({"role": "system", "content": system_prompt})];
    payload_messages.extend(
        messages
            .iter()
            .map(|message| json!({"role": message.role, "content": message.content})),
    );
    let request = client
        .post(endpoint(&runtime.base_url, "api/chat"))
        .json(&json!({
            "model": runtime.model,
            "messages": payload_messages,
            "stream": false
        }));
    let value = send_json(request).await?;
    value["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| response_error(&value))
}

async fn send_json(request: reqwest::RequestBuilder) -> Result<Value, String> {
    let response = request
        .send()
        .await
        .map_err(|error| format!("无法连接模型服务：{error}"))?;
    let status = response.status();
    let value: Value = response
        .json()
        .await
        .map_err(|error| format!("模型服务返回了无法解析的内容：{error}"))?;
    if !status.is_success() {
        return Err(format!(
            "模型服务返回错误 {}：{}",
            status.as_u16(),
            response_error(&value)
        ));
    }
    Ok(value)
}

fn response_error(value: &Value) -> String {
    value["error"]["message"]
        .as_str()
        .or_else(|| value["message"].as_str())
        .unwrap_or("响应中没有可显示的文本")
        .to_string()
}
