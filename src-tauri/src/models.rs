use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub estimated_pomodoros: i64,
    pub completed_pomodoros: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTaskInput {
    pub project_id: Option<String>,
    pub title: String,
    pub priority: String,
    pub estimated_pomodoros: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewProjectInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateLearningPlanInput {
    pub provider_id: String,
    pub goal: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPlanTask {
    pub title: String,
    pub detail: String,
    pub estimated_pomodoros: i64,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPlanDraft {
    pub project_name: String,
    pub summary: String,
    pub tasks: Vec<LearningPlanTask>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlanTaskInput {
    pub title: String,
    pub estimated_pomodoros: i64,
    pub priority: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLearningPlanInput {
    pub project_id: Option<String>,
    pub new_project_name: Option<String>,
    pub project_description: Option<String>,
    pub tasks: Vec<ImportPlanTaskInput>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLearningPlanResult {
    pub project: Option<Project>,
    pub tasks: Vec<Task>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PomodoroSession {
    pub id: String,
    pub task_id: Option<String>,
    pub started_at: String,
    pub ended_at: String,
    pub planned_seconds: i64,
    pub actual_seconds: i64,
    pub note: Option<String>,
    pub completed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletePomodoroInput {
    pub task_id: Option<String>,
    pub started_at: String,
    pub ended_at: String,
    pub planned_seconds: i64,
    pub actual_seconds: i64,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub default_model: String,
    pub created_at: String,
    pub updated_at: String,
    pub has_secret: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProviderInput {
    pub id: Option<String>,
    pub name: String,
    pub catalog_id: String,
    pub custom_base_url: Option<String>,
    pub custom_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionProfile {
    pub name: String,
    pub style_id: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCompanionProfileInput {
    pub name: String,
    pub style_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProactiveSettings {
    pub enabled: bool,
    pub frequency: i64,
}

impl Default for ProactiveSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            frequency: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionStyle {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCatalogItem {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub default_model: String,
    pub requires_key: bool,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatInput {
    pub provider_id: String,
    pub conversation_id: Option<String>,
    pub content: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatResult {
    pub conversation_id: String,
    pub user_message: ChatMessage,
    pub assistant_message: ChatMessage,
    pub memory_compacted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryItem {
    pub id: String,
    pub kind: String,
    pub content: String,
    pub importance: f64,
    pub confidence: f64,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSnapshot {
    pub projects: Vec<Project>,
    pub tasks: Vec<Task>,
    pub sessions: Vec<PomodoroSession>,
    pub providers: Vec<ProviderConfig>,
    pub companion_profile: CompanionProfile,
    pub proactive_settings: ProactiveSettings,
    pub messages: Vec<ChatMessage>,
    pub memories: Vec<MemoryItem>,
}
