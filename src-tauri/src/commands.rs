use chrono::Utc;
use keyring::Entry;
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::Value;
use tauri::State;
use uuid::Uuid;

use crate::ai::{self, ProviderRuntime};
use crate::db::DbState;
use crate::models::{
    AppSnapshot, ChatMessage, CompanionProfile, CompanionStyle, CompletePomodoroInput,
    GenerateLearningPlanInput, ImportLearningPlanInput, ImportLearningPlanResult,
    LearningPlanDraft, LearningPlanTask, MemoryItem, NewProjectInput, NewTaskInput,
    PomodoroSession, ProactiveSettings, Project, ProviderCatalogItem, ProviderConfig,
    RecordRemotePomodoroInput, SaveCompanionProfileInput, SaveProviderInput, SendChatInput,
    SendChatResult, Task,
};

const KEYRING_SERVICE: &str = "Tomato Companion";

fn internal_error(error: impl std::fmt::Display) -> String {
    format!("本地数据操作失败：{error}")
}

fn style_catalog() -> Vec<CompanionStyle> {
    vec![
        CompanionStyle {
            id: "gentle".into(),
            name: "温柔陪伴".into(),
            description: "耐心、接纳，帮助你降低开始的压力".into(),
        },
        CompanionStyle {
            id: "coach".into(),
            name: "行动教练".into(),
            description: "清晰直接，把目标快速变成下一步行动".into(),
        },
        CompanionStyle {
            id: "rational".into(),
            name: "理性导师".into(),
            description: "结构严谨，重视原理、证据与复盘".into(),
        },
        CompanionStyle {
            id: "energetic".into(),
            name: "元气同伴".into(),
            description: "积极有活力，及时庆祝真实的小进展".into(),
        },
    ]
}

fn style_prompt(style_id: &str) -> &'static str {
    match style_id {
        "coach" => "你是一位行动教练。表达简洁明确，优先给出可以立刻开始的下一步；要求清晰的完成标准，但不使用羞辱、威胁或打卡惩罚。",
        "rational" => "你是一位理性导师。解释时先给结构，再讲原理、依据和取舍；遇到不确定信息明确说明，不编造事实。",
        "energetic" => "你是一位积极而克制的学习同伴。语气有活力，真诚庆祝具体进展；不幼稚化用户，也不堆砌夸张感叹。",
        _ => "你是一位温柔耐心的学习同伴。先理解用户的困难，再用低压力、可执行的小步骤帮助开始；不评判、不催促。",
    }
}

fn validate_priority(priority: &str) -> Result<(), String> {
    match priority {
        "low" | "medium" | "high" => Ok(()),
        _ => Err("任务优先级无效".to_string()),
    }
}

fn keyring_entry(provider_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, provider_id).map_err(internal_error)
}

fn provider_has_secret(provider_id: &str) -> bool {
    keyring_entry(provider_id)
        .and_then(|entry| entry.get_password().map_err(internal_error))
        .is_ok()
}

fn load_proactive_settings(connection: &rusqlite::Connection) -> Result<ProactiveSettings, String> {
    let raw: Option<String> = connection
        .query_row(
            "SELECT value_json FROM app_settings WHERE key = 'proactive_settings'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal_error)?;
    Ok(raw
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_default())
}

#[tauri::command]
pub fn load_snapshot(state: State<'_, DbState>) -> Result<AppSnapshot, String> {
    let connection = state.0.lock().map_err(internal_error)?;

    let projects = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, name, description, created_at, updated_at
                FROM projects
                ORDER BY updated_at DESC
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };

    let tasks = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, project_id, title, status, priority, estimated_pomodoros,
                       completed_pomodoros, created_at, updated_at
                FROM tasks
                ORDER BY
                  CASE status WHEN 'todo' THEN 0 ELSE 1 END,
                  CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  updated_at DESC
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    estimated_pomodoros: row.get(5)?,
                    completed_pomodoros: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };

    let sessions = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, task_id, started_at, ended_at, planned_seconds,
                       actual_seconds, note, completed, source, remote_session_id
                FROM pomodoro_sessions
                ORDER BY ended_at DESC
                LIMIT 5000
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                Ok(PomodoroSession {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    planned_seconds: row.get(4)?,
                    actual_seconds: row.get(5)?,
                    note: row.get(6)?,
                    completed: row.get::<_, i64>(7)? != 0,
                    source: row.get(8)?,
                    remote_session_id: row.get(9)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };

    let providers = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, name, provider_type, base_url, default_model,
                       created_at, updated_at
                FROM provider_connections
                ORDER BY updated_at DESC
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                let id: String = row.get(0)?;
                Ok(ProviderConfig {
                    has_secret: provider_has_secret(&id),
                    id,
                    name: row.get(1)?,
                    provider_type: row.get(2)?,
                    base_url: row.get(3)?,
                    default_model: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };

    let companion_profile = connection
        .query_row(
            "SELECT name, style_id, updated_at FROM companion_profile WHERE id = 'default'",
            [],
            |row| {
                Ok(CompanionProfile {
                    name: row.get(0)?,
                    style_id: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            },
        )
        .map_err(internal_error)?;

    let messages = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, conversation_id, role, content, created_at
                FROM messages
                WHERE conversation_id = (
                  SELECT id FROM conversations ORDER BY updated_at DESC LIMIT 1
                )
                  AND visible = 1
                ORDER BY created_at ASC
                LIMIT 200
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                Ok(ChatMessage {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };

    let memories = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, kind, content, importance, confidence, updated_at
                FROM memories
                WHERE archived = 0
                ORDER BY importance * confidence DESC, updated_at DESC
                LIMIT 100
                "#,
            )
            .map_err(internal_error)?;
        let values = statement
            .query_map([], |row| {
                Ok(MemoryItem {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    content: row.get(2)?,
                    importance: row.get(3)?,
                    confidence: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(internal_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(internal_error)?;
        values
    };
    let proactive_settings = load_proactive_settings(&connection)?;

    Ok(AppSnapshot {
        projects,
        tasks,
        sessions,
        providers,
        companion_profile,
        proactive_settings,
        messages,
        memories,
    })
}

#[tauri::command]
pub fn create_task(input: NewTaskInput, state: State<'_, DbState>) -> Result<Task, String> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err("任务名称不能为空".to_string());
    }
    validate_priority(&input.priority)?;
    if !(1..=20).contains(&input.estimated_pomodoros) {
        return Err("预计番茄数必须在 1 到 20 之间".to_string());
    }

    let stamp = Utc::now().to_rfc3339();
    let task = Task {
        id: Uuid::new_v4().to_string(),
        project_id: input.project_id,
        title: title.to_string(),
        status: "todo".to_string(),
        priority: input.priority,
        estimated_pomodoros: input.estimated_pomodoros,
        completed_pomodoros: 0,
        created_at: stamp.clone(),
        updated_at: stamp,
    };

    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute(
            r#"
            INSERT INTO tasks(
              id, project_id, title, status, priority, estimated_pomodoros,
              completed_pomodoros, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                task.id,
                task.project_id,
                task.title,
                task.status,
                task.priority,
                task.estimated_pomodoros,
                task.completed_pomodoros,
                task.created_at,
                task.updated_at
            ],
        )
        .map_err(internal_error)?;
    Ok(task)
}

#[tauri::command]
pub fn toggle_task(task_id: String, state: State<'_, DbState>) -> Result<Task, String> {
    let connection = state.0.lock().map_err(internal_error)?;
    let current: Option<String> = connection
        .query_row(
            "SELECT status FROM tasks WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal_error)?;
    let next = match current.as_deref() {
        Some("todo") => "done",
        Some("done") => "todo",
        _ => return Err("没有找到这个任务".to_string()),
    };
    let stamp = Utc::now().to_rfc3339();
    connection
        .execute(
            "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![next, stamp, task_id],
        )
        .map_err(internal_error)?;
    connection
        .query_row(
            r#"
            SELECT id, project_id, title, status, priority, estimated_pomodoros,
                   completed_pomodoros, created_at, updated_at
            FROM tasks WHERE id = ?1
            "#,
            [&task_id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    title: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    estimated_pomodoros: row.get(5)?,
                    completed_pomodoros: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .map_err(internal_error)
}

#[tauri::command]
pub fn delete_task(task_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute("DELETE FROM tasks WHERE id = ?1", [task_id])
        .map_err(internal_error)?;
    Ok(())
}

#[tauri::command]
pub fn create_project(
    input: NewProjectInput,
    state: State<'_, DbState>,
) -> Result<Project, String> {
    let name = input.name.trim();
    if name.is_empty() || name.chars().count() > 80 {
        return Err("项目名称需要在 1 到 80 个字符之间".to_string());
    }
    let stamp = Utc::now().to_rfc3339();
    let project = Project {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        description: input
            .description
            .unwrap_or_default()
            .trim()
            .chars()
            .take(500)
            .collect(),
        created_at: stamp.clone(),
        updated_at: stamp,
    };
    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute(
            r#"
            INSERT INTO projects(id, name, description, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                project.id,
                project.name,
                project.description,
                project.created_at,
                project.updated_at
            ],
        )
        .map_err(internal_error)?;
    Ok(project)
}

#[tauri::command]
pub fn import_learning_plan(
    input: ImportLearningPlanInput,
    state: State<'_, DbState>,
) -> Result<ImportLearningPlanResult, String> {
    if input.project_id.is_some() && input.new_project_name.is_some() {
        return Err("请选择新建项目或已有项目，不能同时选择".to_string());
    }
    if input.tasks.is_empty() || input.tasks.len() > 50 {
        return Err("请选择 1 到 50 个要导入的任务".to_string());
    }
    for task in &input.tasks {
        if task.title.trim().is_empty() || task.title.chars().count() > 120 {
            return Err("任务名称需要在 1 到 120 个字符之间".to_string());
        }
        validate_priority(&task.priority)?;
        if !(1..=20).contains(&task.estimated_pomodoros) {
            return Err("每个任务的预计番茄数必须在 1 到 20 之间".to_string());
        }
    }

    let stamp = Utc::now().to_rfc3339();
    let mut connection = state.0.lock().map_err(internal_error)?;
    let transaction = connection.transaction().map_err(internal_error)?;
    let requested_project_id = input.project_id.clone();

    let project = if let Some(name) = input.new_project_name {
        let trimmed = name.trim();
        if trimmed.is_empty() || trimmed.chars().count() > 80 {
            return Err("项目名称需要在 1 到 80 个字符之间".to_string());
        }
        let project = Project {
            id: Uuid::new_v4().to_string(),
            name: trimmed.to_string(),
            description: input
                .project_description
                .unwrap_or_default()
                .trim()
                .chars()
                .take(500)
                .collect(),
            created_at: stamp.clone(),
            updated_at: stamp.clone(),
        };
        transaction
            .execute(
                r#"
                INSERT INTO projects(id, name, description, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
                params![
                    project.id,
                    project.name,
                    project.description,
                    project.created_at,
                    project.updated_at
                ],
            )
            .map_err(internal_error)?;
        Some(project)
    } else if let Some(project_id) = requested_project_id.clone() {
        transaction
            .query_row(
                r#"
                SELECT id, name, description, created_at, updated_at
                FROM projects WHERE id = ?1
                "#,
                [&project_id],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        created_at: row.get(3)?,
                        updated_at: row.get(4)?,
                    })
                },
            )
            .optional()
            .map_err(internal_error)?
    } else {
        None
    };

    if requested_project_id.is_some() && project.is_none() {
        return Err("没有找到要合并的项目".to_string());
    }
    let project_id = project.as_ref().map(|item| item.id.clone());
    let mut tasks = Vec::with_capacity(input.tasks.len());
    for item in input.tasks {
        let task = Task {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.clone(),
            title: item.title.trim().to_string(),
            status: "todo".to_string(),
            priority: item.priority,
            estimated_pomodoros: item.estimated_pomodoros,
            completed_pomodoros: 0,
            created_at: stamp.clone(),
            updated_at: stamp.clone(),
        };
        transaction
            .execute(
                r#"
                INSERT INTO tasks(
                  id, project_id, title, status, priority, estimated_pomodoros,
                  completed_pomodoros, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    task.id,
                    task.project_id,
                    task.title,
                    task.status,
                    task.priority,
                    task.estimated_pomodoros,
                    task.completed_pomodoros,
                    task.created_at,
                    task.updated_at
                ],
            )
            .map_err(internal_error)?;
        tasks.push(task);
    }
    if let Some(project_id) = &project_id {
        transaction
            .execute(
                "UPDATE projects SET updated_at = ?1 WHERE id = ?2",
                params![stamp, project_id],
            )
            .map_err(internal_error)?;
    }
    transaction.commit().map_err(internal_error)?;
    Ok(ImportLearningPlanResult { project, tasks })
}

#[tauri::command]
pub fn complete_pomodoro(
    input: CompletePomodoroInput,
    state: State<'_, DbState>,
) -> Result<PomodoroSession, String> {
    if input.planned_seconds < 60 || input.actual_seconds <= 0 {
        return Err("番茄时长无效".to_string());
    }
    let session = PomodoroSession {
        id: Uuid::new_v4().to_string(),
        task_id: input.task_id,
        started_at: input.started_at,
        ended_at: input.ended_at,
        planned_seconds: input.planned_seconds,
        actual_seconds: input.actual_seconds,
        note: input.note,
        completed: true,
        source: "local".to_string(),
        remote_session_id: None,
    };
    let mut connection = state.0.lock().map_err(internal_error)?;
    let transaction = connection.transaction().map_err(internal_error)?;
    transaction
        .execute(
            r#"
            INSERT INTO pomodoro_sessions(
              id, task_id, started_at, ended_at, planned_seconds,
              actual_seconds, note, completed
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
            "#,
            params![
                session.id,
                session.task_id,
                session.started_at,
                session.ended_at,
                session.planned_seconds,
                session.actual_seconds,
                session.note
            ],
        )
        .map_err(internal_error)?;
    if let Some(task_id) = &session.task_id {
        transaction
            .execute(
                r#"
                UPDATE tasks
                SET completed_pomodoros = completed_pomodoros + 1,
                    updated_at = ?1
                WHERE id = ?2
                "#,
                params![Utc::now().to_rfc3339(), task_id],
            )
            .map_err(internal_error)?;
    }
    transaction.commit().map_err(internal_error)?;
    Ok(session)
}

#[tauri::command]
pub fn record_remote_pomodoro(
    input: RecordRemotePomodoroInput,
    state: State<'_, DbState>,
) -> Result<PomodoroSession, String> {
    if input.remote_session_id.trim().is_empty() || input.duration_seconds < 60 {
        return Err("远程番茄记录无效".to_string());
    }
    let connection = state.0.lock().map_err(internal_error)?;
    let id = Uuid::new_v4().to_string();
    connection
        .execute(
            r#"
            INSERT OR IGNORE INTO pomodoro_sessions(
              id, task_id, started_at, ended_at, planned_seconds,
              actual_seconds, note, completed, source, remote_session_id
            ) VALUES (?1, NULL, ?2, ?3, ?4, ?4, ?5, 1, 'remote', ?6)
            "#,
            params![
                id,
                input.started_at,
                input.ended_at,
                input.duration_seconds,
                input.note,
                input.remote_session_id
            ],
        )
        .map_err(internal_error)?;
    connection
        .query_row(
            r#"
            SELECT id, task_id, started_at, ended_at, planned_seconds,
                   actual_seconds, note, completed, source, remote_session_id
            FROM pomodoro_sessions
            WHERE remote_session_id = ?1
            "#,
            [input.remote_session_id],
            |row| {
                Ok(PomodoroSession {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    started_at: row.get(2)?,
                    ended_at: row.get(3)?,
                    planned_seconds: row.get(4)?,
                    actual_seconds: row.get(5)?,
                    note: row.get(6)?,
                    completed: row.get::<_, i64>(7)? != 0,
                    source: row.get(8)?,
                    remote_session_id: row.get(9)?,
                })
            },
        )
        .map_err(internal_error)
}

#[tauri::command]
pub fn save_provider_config(
    input: SaveProviderInput,
    state: State<'_, DbState>,
) -> Result<ProviderConfig, String> {
    if input.name.trim().is_empty() {
        return Err("连接名称不能为空".to_string());
    }
    let selected =
        ai::catalog_item(&input.catalog_id).ok_or_else(|| "不支持这个模型服务商".to_string())?;
    let base_url = input
        .custom_base_url
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&selected.base_url)
        .trim()
        .to_string();
    let default_model = input
        .custom_model
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&selected.default_model)
        .trim()
        .to_string();
    let stamp = Utc::now().to_rfc3339();
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let connection = state.0.lock().map_err(internal_error)?;
    let created_at: String = connection
        .query_row(
            "SELECT created_at FROM provider_connections WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal_error)?
        .unwrap_or_else(|| stamp.clone());
    connection
        .execute(
            r#"
            INSERT INTO provider_connections(
              id, name, provider_type, base_url, default_model, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              provider_type = excluded.provider_type,
              base_url = excluded.base_url,
              default_model = excluded.default_model,
              updated_at = excluded.updated_at
            "#,
            params![
                id,
                input.name.trim(),
                selected.provider_type,
                base_url,
                default_model,
                created_at,
                stamp
            ],
        )
        .map_err(internal_error)?;
    Ok(ProviderConfig {
        has_secret: provider_has_secret(&id),
        id,
        name: input.name.trim().to_string(),
        provider_type: selected.provider_type,
        base_url,
        default_model,
        created_at,
        updated_at: stamp,
    })
}

#[tauri::command]
pub fn save_provider_secret(provider_id: String, secret: String) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err("API Key 不能为空".to_string());
    }
    keyring_entry(&provider_id)?
        .set_password(secret.trim())
        .map_err(internal_error)
}

#[tauri::command]
pub fn delete_provider_secret(provider_id: String) -> Result<(), String> {
    keyring_entry(&provider_id)?
        .delete_credential()
        .map_err(internal_error)
}

#[tauri::command]
pub fn provider_catalog() -> Vec<ProviderCatalogItem> {
    ai::catalog()
}

#[tauri::command]
pub fn companion_styles() -> Vec<CompanionStyle> {
    style_catalog()
}

#[tauri::command]
pub fn save_companion_profile(
    input: SaveCompanionProfileInput,
    state: State<'_, DbState>,
) -> Result<CompanionProfile, String> {
    let name = input.name.trim();
    if name.is_empty() || name.chars().count() > 20 {
        return Err("伙伴名字需要在 1 到 20 个字符之间".to_string());
    }
    if !style_catalog()
        .iter()
        .any(|style| style.id == input.style_id)
    {
        return Err("请选择有效的伙伴风格".to_string());
    }
    let stamp = Utc::now().to_rfc3339();
    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute(
            r#"
            UPDATE companion_profile
            SET name = ?1, style_id = ?2, updated_at = ?3
            WHERE id = 'default'
            "#,
            params![name, input.style_id, stamp],
        )
        .map_err(internal_error)?;
    Ok(CompanionProfile {
        name: name.to_string(),
        style_id: input.style_id,
        updated_at: stamp,
    })
}

#[tauri::command]
pub fn save_proactive_settings(
    mut settings: ProactiveSettings,
    state: State<'_, DbState>,
) -> Result<ProactiveSettings, String> {
    settings.frequency = settings.frequency.clamp(1, 6);
    let value = serde_json::to_string(&settings).map_err(internal_error)?;
    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute(
            r#"
            INSERT INTO app_settings(key, value_json, updated_at)
            VALUES ('proactive_settings', ?1, ?2)
            ON CONFLICT(key) DO UPDATE SET
              value_json = excluded.value_json,
              updated_at = excluded.updated_at
            "#,
            params![value, Utc::now().to_rfc3339()],
        )
        .map_err(internal_error)?;
    Ok(settings)
}

fn load_provider_runtime(
    provider_id: &str,
    state: &State<'_, DbState>,
) -> Result<ProviderRuntime, String> {
    let connection = state.0.lock().map_err(internal_error)?;
    let (provider_type, base_url, model): (String, String, String) = connection
        .query_row(
            r#"
            SELECT provider_type, base_url, default_model
            FROM provider_connections WHERE id = ?1
            "#,
            [provider_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(internal_error)?
        .ok_or_else(|| "没有找到这个模型连接".to_string())?;
    drop(connection);
    let api_key = keyring_entry(provider_id)
        .and_then(|entry| entry.get_password().map_err(internal_error))
        .ok();
    if provider_type != "ollama" && api_key.is_none() {
        return Err("请先为这个连接保存 API Key".to_string());
    }
    Ok(ProviderRuntime {
        provider_type,
        base_url,
        model,
        api_key,
    })
}

#[tauri::command]
pub async fn test_provider_connection(
    provider_id: String,
    state: State<'_, DbState>,
) -> Result<String, String> {
    let runtime = load_provider_runtime(&provider_id, &state)?;
    let test_message = ChatMessage {
        id: "connection-test".to_string(),
        conversation_id: "connection-test".to_string(),
        role: "user".to_string(),
        content: "这是一次连接测试。请只回复：连接成功".to_string(),
        created_at: Utc::now().to_rfc3339(),
    };
    ai::complete(
        &runtime,
        "你正在执行一次 API 连接测试。不要调用工具，只用一句中文确认连接成功。",
        &[test_message],
    )
    .await
}

fn memory_context(memories: &[MemoryItem]) -> String {
    if memories.is_empty() {
        return "暂无长期记忆。".to_string();
    }
    memories
        .iter()
        .take(12)
        .map(|memory| format!("- [{}] {}", memory.kind, memory.content))
        .collect::<Vec<_>>()
        .join("\n")
}

fn assistant_system_prompt(
    profile: &CompanionProfile,
    summary: &str,
    memories: &[MemoryItem],
) -> String {
    format!(
        r#"你的名字是“{}”，你是用户长期使用的本地 AI 学习伙伴。

{}

核心工作方式：
1. 帮用户理解知识、定位卡点，并把学习目标拆成一颗颗可在番茄钟内完成的任务。
2. 拆解计划时使用明确步骤；每步给出行动、完成标准和建议番茄数（通常 1-3 颗）。
3. 先回答用户眼前的问题，不要每次都强行生成计划。
4. 不编造事实；对时效性或不确定信息明确提醒用户核对。
5. 不索取或复述 API Key、密码、身份证号等秘密。不要宣称自己有情感、意识或现实世界能力。
6. 记忆只是辅助线索。如果记忆与用户当前说法冲突，以当前说法为准，并温和确认。
7. 回复使用清晰的 Markdown：短段落、必要的小标题和列表；不要把所有内容挤成一段，也不要滥用标题。

对话滚动摘要：
{}

已提取的长期记忆：
{}"#,
        profile.name,
        style_prompt(&profile.style_id),
        if summary.is_empty() {
            "暂无。"
        } else {
            summary
        },
        memory_context(memories)
    )
}

fn bounded_context(mut messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
    const MAX_CONTEXT_CHARS: usize = 60_000;
    let mut total = messages
        .iter()
        .map(|message| message.content.chars().count())
        .sum::<usize>();
    while messages.len() > 1 && total > MAX_CONTEXT_CHARS {
        total = total.saturating_sub(messages[0].content.chars().count());
        messages.remove(0);
    }
    messages
}

fn should_generate_check_in(total: i64, last: i64, settings: &ProactiveSettings) -> bool {
    settings.enabled
        && total >= settings.frequency
        && total.saturating_sub(last) >= settings.frequency
}

#[tauri::command]
pub async fn maybe_generate_check_in(
    provider_id: String,
    state: State<'_, DbState>,
) -> Result<Option<ChatMessage>, String> {
    let runtime = load_provider_runtime(&provider_id, &state)?;
    let (
        settings,
        total_sessions,
        profile,
        memories,
        conversation_id,
        mut context_messages,
        recent_focus,
    ) = {
        let connection = state.0.lock().map_err(internal_error)?;
        let settings = load_proactive_settings(&connection)?;
        let total_sessions = connection
            .query_row(
                "SELECT COUNT(*) FROM pomodoro_sessions WHERE completed = 1",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map_err(internal_error)?;
        let last_count = connection
            .query_row(
                "SELECT value_json FROM app_settings WHERE key = 'last_proactive_session_count'",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(internal_error)?
            .and_then(|raw| serde_json::from_str::<i64>(&raw).ok())
            .unwrap_or(0);
        if !should_generate_check_in(total_sessions, last_count, &settings) {
            return Ok(None);
        }
        let profile = connection
            .query_row(
                "SELECT name, style_id, updated_at FROM companion_profile WHERE id = 'default'",
                [],
                |row| {
                    Ok(CompanionProfile {
                        name: row.get(0)?,
                        style_id: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .map_err(internal_error)?;
        let memories = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, kind, content, importance, confidence, updated_at
                    FROM memories WHERE archived = 0
                    ORDER BY importance * confidence DESC, updated_at DESC
                    LIMIT 12
                    "#,
                )
                .map_err(internal_error)?;
            let values = statement
                .query_map([], |row| {
                    Ok(MemoryItem {
                        id: row.get(0)?,
                        kind: row.get(1)?,
                        content: row.get(2)?,
                        importance: row.get(3)?,
                        confidence: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values
        };
        let conversation_id = connection
            .query_row(
                "SELECT id FROM conversations ORDER BY updated_at DESC LIMIT 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(internal_error)?
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let context_messages = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, conversation_id, role, content, created_at
                    FROM messages WHERE conversation_id = ?1
                    ORDER BY created_at DESC LIMIT 12
                    "#,
                )
                .map_err(internal_error)?;
            let mut values = statement
                .query_map([&conversation_id], |row| {
                    Ok(ChatMessage {
                        id: row.get(0)?,
                        conversation_id: row.get(1)?,
                        role: row.get(2)?,
                        content: row.get(3)?,
                        created_at: row.get(4)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values.reverse();
            values
        };
        let recent_focus = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT COALESCE(tasks.title, '自由专注'), pomodoro_sessions.actual_seconds
                    FROM pomodoro_sessions
                    LEFT JOIN tasks ON tasks.id = pomodoro_sessions.task_id
                    WHERE pomodoro_sessions.completed = 1
                    ORDER BY pomodoro_sessions.ended_at DESC
                    LIMIT ?1
                    "#,
                )
                .map_err(internal_error)?;
            let values = statement
                .query_map([settings.frequency], |row| {
                    let title: String = row.get(0)?;
                    let seconds: i64 = row.get(1)?;
                    Ok(format!("{}（约 {} 分钟）", title, (seconds / 60).max(1)))
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values
        };
        (
            settings,
            total_sessions,
            profile,
            memories,
            conversation_id,
            context_messages,
            recent_focus,
        )
    };

    let event_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: conversation_id.clone(),
        role: "user".to_string(),
        content: format!(
            "【系统学习事件，不是用户直接发言】用户刚完成了 {} 颗番茄，最近的专注内容：{}。请根据已有对话和记忆主动关心这轮学习，询问掌握情况或提出一个简短、具体、可以直接回答的互动问题。",
            settings.frequency,
            recent_focus.join("；")
        ),
        created_at: Utc::now().to_rfc3339(),
    };
    context_messages.push(event_message.clone());
    let context_messages = bounded_context(context_messages);
    let system_prompt = format!(
        "{}\n\n这是一次由番茄完成事件触发的主动关心。只写 2-4 句，联系最近学习内容，最多问一个具体问题；不要假装用户已经回答，不要泛泛夸奖，也不要生成完整学习计划。",
        assistant_system_prompt(&profile, "", &memories)
    );
    let reply = ai::complete(&runtime, &system_prompt, &context_messages).await?;
    if reply.trim().is_empty() {
        return Ok(None);
    }
    let assistant_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: conversation_id.clone(),
        role: "assistant".to_string(),
        content: reply.trim().to_string(),
        created_at: Utc::now().to_rfc3339(),
    };

    let mut connection = state.0.lock().map_err(internal_error)?;
    let transaction = connection.transaction().map_err(internal_error)?;
    transaction
        .execute(
            r#"
            INSERT OR IGNORE INTO conversations(
              id, title, summary, compacted_message_count, created_at, updated_at
            ) VALUES (?1, '学习进度交流', '', 0, ?2, ?2)
            "#,
            params![conversation_id, event_message.created_at],
        )
        .map_err(internal_error)?;
    transaction
        .execute(
            "INSERT INTO messages(id, conversation_id, role, content, created_at, visible) VALUES (?1, ?2, 'user', ?3, ?4, 0)",
            params![
                event_message.id,
                conversation_id,
                event_message.content,
                event_message.created_at
            ],
        )
        .map_err(internal_error)?;
    transaction
        .execute(
            "INSERT INTO messages(id, conversation_id, role, content, created_at, visible) VALUES (?1, ?2, 'assistant', ?3, ?4, 1)",
            params![
                assistant_message.id,
                conversation_id,
                assistant_message.content,
                assistant_message.created_at
            ],
        )
        .map_err(internal_error)?;
    transaction
        .execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![assistant_message.created_at, conversation_id],
        )
        .map_err(internal_error)?;
    transaction
        .execute(
            r#"
            INSERT INTO app_settings(key, value_json, updated_at)
            VALUES ('last_proactive_session_count', ?1, ?2)
            ON CONFLICT(key) DO UPDATE SET
              value_json = excluded.value_json,
              updated_at = excluded.updated_at
            "#,
            params![
                serde_json::to_string(&total_sessions).map_err(internal_error)?,
                assistant_message.created_at
            ],
        )
        .map_err(internal_error)?;
    transaction.commit().map_err(internal_error)?;
    Ok(Some(assistant_message))
}

#[tauri::command]
pub async fn generate_learning_plan(
    input: GenerateLearningPlanInput,
    state: State<'_, DbState>,
) -> Result<LearningPlanDraft, String> {
    let goal = input.goal.trim();
    if goal.is_empty() || goal.chars().count() > 2000 {
        return Err("学习目标需要在 1 到 2000 个字符之间".to_string());
    }
    let runtime = load_provider_runtime(&input.provider_id, &state)?;
    let (profile, memories) = {
        let connection = state.0.lock().map_err(internal_error)?;
        let profile = connection
            .query_row(
                "SELECT name, style_id, updated_at FROM companion_profile WHERE id = 'default'",
                [],
                |row| {
                    Ok(CompanionProfile {
                        name: row.get(0)?,
                        style_id: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .map_err(internal_error)?;
        let memories = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, kind, content, importance, confidence, updated_at
                    FROM memories WHERE archived = 0
                    ORDER BY importance * confidence DESC, updated_at DESC
                    LIMIT 12
                    "#,
                )
                .map_err(internal_error)?;
            let values = statement
                .query_map([], |row| {
                    Ok(MemoryItem {
                        id: row.get(0)?,
                        kind: row.get(1)?,
                        content: row.get(2)?,
                        importance: row.get(3)?,
                        confidence: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values
        };
        (profile, memories)
    };

    let prompt = format!(
        r#"学习目标：{}

请把目标拆成真正可以依次执行的番茄任务，并严格只返回以下 JSON，不要 Markdown、代码围栏或额外解释：
{{"projectName":"不超过30字的项目名称","summary":"不超过200字的阶段目标和完成标准","tasks":[{{"title":"以动词开头的具体任务","detail":"本步的明确产出或完成标准","estimatedPomodoros":1,"priority":"high|medium|low"}}]}}

规则：
1. 生成 3 到 12 个任务，按学习先后排序。
2. 每个任务控制在 1 到 3 颗番茄；更大的步骤必须继续拆分。
3. title 必须具体可执行，不写“学习一下”“继续努力”等模糊动作。
4. detail 写清完成后应留下什么产出。
5. 结合下方长期记忆调整难度，但若记忆与当前目标冲突，以当前目标为准。

长期记忆：
{}"#,
        goal,
        memory_context(&memories)
    );
    let plan_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: "learning-plan-draft".to_string(),
        role: "user".to_string(),
        content: prompt,
        created_at: Utc::now().to_rfc3339(),
    };
    let system = format!(
        "你的名字是“{}”。{} 你现在是学习项目规划器，必须只输出可解析的 JSON。",
        profile.name,
        style_prompt(&profile.style_id)
    );
    let raw = ai::complete(&runtime, &system, &[plan_message]).await?;
    let trimmed = raw.trim();
    let json_text = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };
    let parsed: LearningPlanDraft = serde_json::from_str(json_text)
        .map_err(|_| "模型返回的计划格式不完整，请重新生成一次".to_string())?;
    if parsed.tasks.is_empty() {
        return Err("模型没有生成可导入的任务，请重新生成".to_string());
    }
    let project_name = parsed
        .project_name
        .trim()
        .chars()
        .take(80)
        .collect::<String>();
    let summary = parsed.summary.trim().chars().take(500).collect::<String>();
    let tasks = parsed
        .tasks
        .into_iter()
        .take(30)
        .filter_map(|task| {
            let title = task.title.trim().chars().take(120).collect::<String>();
            if title.is_empty() {
                return None;
            }
            Some(LearningPlanTask {
                title,
                detail: task.detail.trim().chars().take(500).collect(),
                estimated_pomodoros: task.estimated_pomodoros.clamp(1, 20),
                priority: if matches!(task.priority.as_str(), "high" | "medium" | "low") {
                    task.priority
                } else {
                    "medium".to_string()
                },
            })
        })
        .collect::<Vec<_>>();
    if tasks.is_empty() {
        return Err("模型没有生成有效的任务，请重新生成".to_string());
    }
    Ok(LearningPlanDraft {
        project_name: if project_name.is_empty() {
            goal.chars().take(30).collect()
        } else {
            project_name
        },
        summary,
        tasks,
    })
}

#[derive(Debug, Deserialize)]
struct MemoryExtraction {
    summary: String,
    #[serde(default)]
    memories: Vec<ExtractedMemory>,
}

#[derive(Debug, Deserialize)]
struct ExtractedMemory {
    kind: String,
    content: String,
    importance: f64,
    confidence: f64,
}

fn parse_extraction(raw: &str) -> Result<MemoryExtraction, String> {
    let trimmed = raw.trim();
    let json_text = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };
    serde_json::from_str(json_text).map_err(|error| format!("记忆压缩结果无法解析：{error}"))
}

async fn compact_conversation(
    runtime: &ProviderRuntime,
    conversation_id: &str,
    previous_summary: &str,
    messages: &[ChatMessage],
    state: &State<'_, DbState>,
) -> Result<bool, String> {
    let transcript = messages
        .iter()
        .map(|message| {
            format!(
                "{}：{}",
                if message.role == "user" {
                    "用户"
                } else {
                    "伙伴"
                },
                message.content
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let extraction_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: conversation_id.to_string(),
        role: "user".to_string(),
        content: format!(
            r#"已有摘要：
{}

新增对话：
{}

请压缩为严格 JSON（不要 Markdown）：
{{"summary":"最多500字的滚动摘要","memories":[{{"kind":"preference|goal|study_pattern|background","content":"一条可长期复用且不敏感的事实","importance":0.0,"confidence":0.0}}]}}

只保留稳定偏好、长期目标、学习背景和反复出现的学习方式。不要保存 API Key、密码、联系方式、身份证件、健康隐私或一次性闲聊。没有可靠长期记忆时返回空数组。"#,
            if previous_summary.is_empty() {
                "暂无"
            } else {
                previous_summary
            },
            transcript
        ),
        created_at: Utc::now().to_rfc3339(),
    };
    let raw = ai::complete(
        runtime,
        "你是本地记忆压缩器。只输出符合用户指定结构的 JSON，不做任何解释。",
        &[extraction_message],
    )
    .await?;
    let extraction = parse_extraction(&raw)?;
    let stamp = Utc::now().to_rfc3339();
    let mut connection = state.0.lock().map_err(internal_error)?;
    let transaction = connection.transaction().map_err(internal_error)?;
    transaction
        .execute(
            r#"
            UPDATE conversations
            SET summary = ?1,
                compacted_message_count = (
                  SELECT COUNT(*) FROM messages WHERE conversation_id = ?2
                ),
                updated_at = ?3
            WHERE id = ?2
            "#,
            params![
                extraction.summary.chars().take(2000).collect::<String>(),
                conversation_id,
                stamp
            ],
        )
        .map_err(internal_error)?;
    for memory in extraction.memories.into_iter().take(12) {
        let content = memory.content.trim();
        let valid_kind = matches!(
            memory.kind.as_str(),
            "preference" | "goal" | "study_pattern" | "background"
        );
        if content.is_empty() || !valid_kind {
            continue;
        }
        transaction
            .execute(
                r#"
                INSERT INTO memories(
                  id, kind, content, importance, confidence,
                  source_conversation_id, created_at, updated_at, archived
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, 0)
                ON CONFLICT(kind, content) DO UPDATE SET
                  importance = MAX(importance, excluded.importance),
                  confidence = MAX(confidence, excluded.confidence),
                  updated_at = excluded.updated_at,
                  archived = 0
                "#,
                params![
                    Uuid::new_v4().to_string(),
                    memory.kind,
                    content.chars().take(500).collect::<String>(),
                    memory.importance.clamp(0.0, 1.0),
                    memory.confidence.clamp(0.0, 1.0),
                    conversation_id,
                    stamp
                ],
            )
            .map_err(internal_error)?;
    }
    transaction.commit().map_err(internal_error)?;
    Ok(true)
}

#[tauri::command]
pub async fn send_chat(
    input: SendChatInput,
    state: State<'_, DbState>,
) -> Result<SendChatResult, String> {
    let content = input.content.trim();
    if content.is_empty() {
        return Err("消息不能为空".to_string());
    }
    if content.chars().count() > 12_000 {
        return Err("单条消息请控制在 12000 个字符以内".to_string());
    }
    let runtime = load_provider_runtime(&input.provider_id, &state)?;
    let conversation_id = input
        .conversation_id
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let user_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: conversation_id.clone(),
        role: "user".to_string(),
        content: content.to_string(),
        created_at: Utc::now().to_rfc3339(),
    };

    let (profile, summary, memories, context_messages, compacted_count) = {
        let connection = state.0.lock().map_err(internal_error)?;
        connection
            .execute(
                r#"
                INSERT OR IGNORE INTO conversations(
                  id, title, summary, compacted_message_count, created_at, updated_at
                ) VALUES (?1, ?2, '', 0, ?3, ?3)
                "#,
                params![
                    conversation_id,
                    content.chars().take(36).collect::<String>(),
                    user_message.created_at
                ],
            )
            .map_err(internal_error)?;
        connection
            .execute(
                "INSERT INTO messages(id, conversation_id, role, content, created_at) VALUES (?1, ?2, 'user', ?3, ?4)",
                params![
                    user_message.id,
                    conversation_id,
                    user_message.content,
                    user_message.created_at
                ],
            )
            .map_err(internal_error)?;
        connection
            .execute(
                "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
                params![user_message.created_at, conversation_id],
            )
            .map_err(internal_error)?;

        let profile = connection
            .query_row(
                "SELECT name, style_id, updated_at FROM companion_profile WHERE id = 'default'",
                [],
                |row| {
                    Ok(CompanionProfile {
                        name: row.get(0)?,
                        style_id: row.get(1)?,
                        updated_at: row.get(2)?,
                    })
                },
            )
            .map_err(internal_error)?;
        let (summary, compacted_count): (String, i64) = connection
            .query_row(
                "SELECT summary, compacted_message_count FROM conversations WHERE id = ?1",
                [&conversation_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(internal_error)?;
        let memories = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, kind, content, importance, confidence, updated_at
                    FROM memories WHERE archived = 0
                    ORDER BY importance * confidence DESC, updated_at DESC
                    LIMIT 12
                    "#,
                )
                .map_err(internal_error)?;
            let values = statement
                .query_map([], |row| {
                    Ok(MemoryItem {
                        id: row.get(0)?,
                        kind: row.get(1)?,
                        content: row.get(2)?,
                        importance: row.get(3)?,
                        confidence: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values
        };
        let mut context_messages = {
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, conversation_id, role, content, created_at
                    FROM messages WHERE conversation_id = ?1
                    ORDER BY created_at DESC LIMIT 30
                    "#,
                )
                .map_err(internal_error)?;
            let values = statement
                .query_map([&conversation_id], |row| {
                    Ok(ChatMessage {
                        id: row.get(0)?,
                        conversation_id: row.get(1)?,
                        role: row.get(2)?,
                        content: row.get(3)?,
                        created_at: row.get(4)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values
        };
        context_messages.reverse();
        let context_messages = bounded_context(context_messages);
        (
            profile,
            summary,
            memories,
            context_messages,
            compacted_count,
        )
    };

    let system_prompt = assistant_system_prompt(&profile, &summary, &memories);
    let reply = ai::complete(&runtime, &system_prompt, &context_messages).await?;
    let assistant_message = ChatMessage {
        id: Uuid::new_v4().to_string(),
        conversation_id: conversation_id.clone(),
        role: "assistant".to_string(),
        content: reply.trim().to_string(),
        created_at: Utc::now().to_rfc3339(),
    };
    let message_count = {
        let connection = state.0.lock().map_err(internal_error)?;
        connection
            .execute(
                "INSERT INTO messages(id, conversation_id, role, content, created_at) VALUES (?1, ?2, 'assistant', ?3, ?4)",
                params![
                    assistant_message.id,
                    conversation_id,
                    assistant_message.content,
                    assistant_message.created_at
                ],
            )
            .map_err(internal_error)?;
        connection
            .execute(
                "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
                params![assistant_message.created_at, conversation_id],
            )
            .map_err(internal_error)?;
        connection
            .query_row(
                "SELECT COUNT(*) FROM messages WHERE conversation_id = ?1",
                [&conversation_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(internal_error)?
    };

    let memory_compacted = if message_count - compacted_count >= 24 {
        let messages_for_compaction = {
            let connection = state.0.lock().map_err(internal_error)?;
            let mut statement = connection
                .prepare(
                    r#"
                    SELECT id, conversation_id, role, content, created_at
                    FROM messages
                    WHERE conversation_id = ?1
                    ORDER BY created_at DESC LIMIT 24
                    "#,
                )
                .map_err(internal_error)?;
            let mut values = statement
                .query_map([&conversation_id], |row| {
                    Ok(ChatMessage {
                        id: row.get(0)?,
                        conversation_id: row.get(1)?,
                        role: row.get(2)?,
                        content: row.get(3)?,
                        created_at: row.get(4)?,
                    })
                })
                .map_err(internal_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(internal_error)?;
            values.reverse();
            values
        };
        compact_conversation(
            &runtime,
            &conversation_id,
            &summary,
            &messages_for_compaction,
            &state,
        )
        .await
        .unwrap_or(false)
    } else {
        false
    };

    Ok(SendChatResult {
        conversation_id,
        user_message,
        assistant_message,
        memory_compacted,
    })
}

#[tauri::command]
pub fn delete_memory(memory_id: String, state: State<'_, DbState>) -> Result<(), String> {
    let connection = state.0.lock().map_err(internal_error)?;
    connection
        .execute(
            "UPDATE memories SET archived = 1, updated_at = ?1 WHERE id = ?2",
            params![Utc::now().to_rfc3339(), memory_id],
        )
        .map_err(internal_error)?;
    Ok(())
}

#[tauri::command]
pub fn save_timer_state(state: Value, db: State<'_, DbState>) -> Result<(), String> {
    let connection = db.0.lock().map_err(internal_error)?;
    connection
        .execute(
            r#"
            INSERT INTO app_settings(key, value_json, updated_at)
            VALUES ('active_timer', ?1, ?2)
            ON CONFLICT(key) DO UPDATE SET
              value_json = excluded.value_json,
              updated_at = excluded.updated_at
            "#,
            params![state.to_string(), Utc::now().to_rfc3339()],
        )
        .map_err(internal_error)?;
    Ok(())
}

#[tauri::command]
pub fn load_timer_state(db: State<'_, DbState>) -> Result<Option<Value>, String> {
    let connection = db.0.lock().map_err(internal_error)?;
    let value: Option<String> = connection
        .query_row(
            "SELECT value_json FROM app_settings WHERE key = 'active_timer'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal_error)?;
    value
        .map(|raw| serde_json::from_str(&raw).map_err(internal_error))
        .transpose()
}

#[cfg(test)]
mod tests {
    use super::{should_generate_check_in, ProactiveSettings};

    #[test]
    fn proactive_check_in_respects_frequency_and_switch() {
        let enabled = ProactiveSettings {
            enabled: true,
            frequency: 2,
        };
        assert!(!should_generate_check_in(1, 0, &enabled));
        assert!(should_generate_check_in(2, 0, &enabled));
        assert!(!should_generate_check_in(3, 2, &enabled));
        assert!(should_generate_check_in(4, 2, &enabled));

        let disabled = ProactiveSettings {
            enabled: false,
            frequency: 1,
        };
        assert!(!should_generate_check_in(10, 0, &disabled));
    }
}
