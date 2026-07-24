package com.tomato.companion.server.room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "session_participants")
public class SessionParticipant {
    @Id
    @Column(length = 36)
    private String id;
    @Column(name = "session_id", length = 36, nullable = false)
    private String sessionId;
    @Column(name = "user_id", length = 36, nullable = false)
    private String userId;
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;
    @Column(nullable = false)
    private boolean completed;
    @Column(name = "completed_focus_seconds", nullable = false)
    private int completedFocusSeconds;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected SessionParticipant() {
    }

    public SessionParticipant(String id, String sessionId, String userId, Instant now) {
        this.id = id;
        this.sessionId = sessionId;
        this.userId = userId;
        this.joinedAt = now;
        this.createdAt = now;
    }

    public String getId() { return id; }
    public String getSessionId() { return sessionId; }
    public String getUserId() { return userId; }
    public Instant getJoinedAt() { return joinedAt; }
    public boolean isCompleted() { return completed; }
    public int getCompletedFocusSeconds() { return completedFocusSeconds; }

    public void complete(int seconds) {
        completed = true;
        completedFocusSeconds = seconds;
    }
}
