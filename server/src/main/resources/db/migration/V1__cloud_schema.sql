CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  nickname VARCHAR(40) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE refresh_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at TIMESTAMP(6) NOT NULL,
  revoked_at TIMESTAMP(6) NULL,
  replaced_by_token_id VARCHAR(36) NULL,
  device_name VARCHAR(120) NULL,
  created_at TIMESTAMP(6) NOT NULL,
  last_used_at TIMESTAMP(6) NULL,
  CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_refresh_tokens_replacement FOREIGN KEY (replaced_by_token_id) REFERENCES refresh_tokens(id)
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

CREATE TABLE teams (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(500) NOT NULL,
  owner_id VARCHAR(36) NOT NULL,
  invite_code VARCHAR(16) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT uk_teams_invite_code UNIQUE (invite_code),
  CONSTRAINT fk_teams_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE team_members (
  id VARCHAR(36) PRIMARY KEY,
  team_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  joined_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT uk_team_members_team_user UNIQUE (team_id, user_id),
  CONSTRAINT fk_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT fk_team_members_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_team_members_user ON team_members(user_id);

CREATE TABLE study_rooms (
  id VARCHAR(36) PRIMARY KEY,
  team_id VARCHAR(36) NOT NULL,
  host_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  focus_seconds INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL,
  closed_at TIMESTAMP(6) NULL,
  CONSTRAINT fk_study_rooms_team FOREIGN KEY (team_id) REFERENCES teams(id),
  CONSTRAINT fk_study_rooms_host FOREIGN KEY (host_user_id) REFERENCES users(id)
);
CREATE INDEX idx_study_rooms_team_status ON study_rooms(team_id, status);

CREATE TABLE room_members (
  id VARCHAR(36) PRIMARY KEY,
  room_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP(6) NOT NULL,
  left_at TIMESTAMP(6) NULL,
  CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES study_rooms(id),
  CONSTRAINT fk_room_members_user FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_room_members_room_user ON room_members(room_id, user_id);

CREATE TABLE study_sessions (
  id VARCHAR(36) PRIMARY KEY,
  room_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL,
  start_time TIMESTAMP(6) NOT NULL,
  end_time TIMESTAMP(6) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_at TIMESTAMP(6) NOT NULL,
  finished_at TIMESTAMP(6) NULL,
  CONSTRAINT fk_study_sessions_room FOREIGN KEY (room_id) REFERENCES study_rooms(id)
);
CREATE INDEX idx_study_sessions_room_status ON study_sessions(room_id, status);
CREATE INDEX idx_study_sessions_end_time ON study_sessions(status, end_time);

CREATE TABLE session_participants (
  id VARCHAR(36) PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  joined_at TIMESTAMP(6) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_focus_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(6) NOT NULL,
  CONSTRAINT uk_session_participants_session_user UNIQUE (session_id, user_id),
  CONSTRAINT fk_session_participants_session FOREIGN KEY (session_id) REFERENCES study_sessions(id),
  CONSTRAINT fk_session_participants_user FOREIGN KEY (user_id) REFERENCES users(id)
);
