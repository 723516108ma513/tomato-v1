use std::path::Path;
use std::sync::Mutex;

use rusqlite::Connection;

pub struct DbState(pub Mutex<Connection>);

pub fn open(path: &Path) -> Result<Connection, rusqlite::Error> {
    let connection = Connection::open(path)?;
    connection.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 5000;
        "#,
    )?;
    migrate(&connection)?;
    Ok(connection)
}

fn migrate(connection: &Connection) -> Result<(), rusqlite::Error> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('todo', 'done')),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          estimated_pomodoros INTEGER NOT NULL DEFAULT 1,
          completed_pomodoros INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          started_at TEXT NOT NULL,
          ended_at TEXT NOT NULL,
          planned_seconds INTEGER NOT NULL,
          actual_seconds INTEGER NOT NULL,
          note TEXT,
          completed INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_ended_at
          ON pomodoro_sessions(ended_at DESC);
        CREATE INDEX IF NOT EXISTS idx_sessions_task_id
          ON pomodoro_sessions(task_id);

        CREATE TABLE IF NOT EXISTS provider_connections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider_type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          default_model TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
          key TEXT PRIMARY KEY,
          value_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS companion_profile (
          id TEXT PRIMARY KEY CHECK (id = 'default'),
          name TEXT NOT NULL,
          style_id TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        INSERT OR IGNORE INTO companion_profile(id, name, style_id, updated_at)
        VALUES ('default', '小番', 'gentle', datetime('now'));

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL DEFAULT '新的学习对话',
          summary TEXT NOT NULL DEFAULT '',
          compacted_message_count INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
          ON messages(conversation_id, created_at);

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL,
          content TEXT NOT NULL,
          importance REAL NOT NULL DEFAULT 0.5,
          confidence REAL NOT NULL DEFAULT 0.7,
          source_conversation_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          UNIQUE(kind, content),
          FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memories_rank
          ON memories(archived, importance DESC, confidence DESC, updated_at DESC);

        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (1, datetime('now'));

        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (2, datetime('now'));

        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (3, datetime('now'));

        INSERT OR IGNORE INTO schema_migrations(version, applied_at)
        VALUES (4, datetime('now'));
        "#,
    )?;

    let has_project_id = {
        let mut statement = connection.prepare("PRAGMA table_info(tasks)")?;
        let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
        columns
            .collect::<Result<Vec<_>, _>>()?
            .iter()
            .any(|name| name == "project_id")
    };
    if !has_project_id {
        connection.execute(
            "ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL",
            [],
        )?;
    }
    connection.execute(
        "CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)",
        [],
    )?;
    let has_message_visibility = {
        let mut statement = connection.prepare("PRAGMA table_info(messages)")?;
        let columns = statement.query_map([], |row| row.get::<_, String>(1))?;
        columns
            .collect::<Result<Vec<_>, _>>()?
            .iter()
            .any(|name| name == "visible")
    };
    if !has_message_visibility {
        connection.execute(
            "ALTER TABLE messages ADD COLUMN visible INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }
    let session_columns = {
        let mut statement = connection.prepare("PRAGMA table_info(pomodoro_sessions)")?;
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))?
            .collect::<Result<Vec<_>, _>>()?;
        columns
    };
    if !session_columns.iter().any(|name| name == "source") {
        connection.execute(
            "ALTER TABLE pomodoro_sessions ADD COLUMN source TEXT NOT NULL DEFAULT 'local'",
            [],
        )?;
    }
    if !session_columns
        .iter()
        .any(|name| name == "remote_session_id")
    {
        connection.execute(
            "ALTER TABLE pomodoro_sessions ADD COLUMN remote_session_id TEXT",
            [],
        )?;
    }
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_remote_id ON pomodoro_sessions(remote_session_id) WHERE remote_session_id IS NOT NULL",
        [],
    )?;
    connection.execute(
        "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (5, datetime('now'))",
        [],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::migrate;
    use rusqlite::Connection;

    #[test]
    fn migration_creates_projects_and_task_relation() {
        let connection = Connection::open_in_memory().expect("in-memory database");
        migrate(&connection).expect("first migration");
        migrate(&connection).expect("migration is idempotent");

        let project_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
                [],
                |row| row.get(0),
            )
            .expect("projects table");
        assert_eq!(project_count, 1);

        let mut statement = connection
            .prepare("PRAGMA table_info(tasks)")
            .expect("task columns");
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("column query")
            .collect::<Result<Vec<_>, _>>()
            .expect("column values");
        assert!(columns.iter().any(|name| name == "project_id"));

        let mut statement = connection
            .prepare("PRAGMA table_info(messages)")
            .expect("message columns");
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("column query")
            .collect::<Result<Vec<_>, _>>()
            .expect("column values");
        assert!(columns.iter().any(|name| name == "visible"));

        let mut statement = connection
            .prepare("PRAGMA table_info(pomodoro_sessions)")
            .expect("session columns");
        let columns = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("column query")
            .collect::<Result<Vec<_>, _>>()
            .expect("column values");
        assert!(columns.iter().any(|name| name == "source"));
        assert!(columns.iter().any(|name| name == "remote_session_id"));

        connection
            .execute(
                "INSERT INTO pomodoro_sessions(id, started_at, ended_at, planned_seconds, actual_seconds, completed, source, remote_session_id) VALUES ('a', '2026-01-01T00:00:00Z', '2026-01-01T00:25:00Z', 1500, 1500, 1, 'remote', 'remote-1')",
                [],
            )
            .expect("first remote session");
        connection
            .execute(
                "INSERT OR IGNORE INTO pomodoro_sessions(id, started_at, ended_at, planned_seconds, actual_seconds, completed, source, remote_session_id) VALUES ('b', '2026-01-01T00:00:00Z', '2026-01-01T00:25:00Z', 1500, 1500, 1, 'remote', 'remote-1')",
                [],
            )
            .expect("duplicate remote session ignored");
        let remote_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM pomodoro_sessions WHERE remote_session_id = 'remote-1'",
                [],
                |row| row.get(0),
            )
            .expect("remote count");
        assert_eq!(remote_count, 1);
    }
}
