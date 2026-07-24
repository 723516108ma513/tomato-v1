package com.tomato.companion.server.room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "study_rooms")
public class StudyRoom {
    @Id
    @Column(length = 36)
    private String id;
    @Column(name = "team_id", length = 36, nullable = false)
    private String teamId;
    @Column(name = "host_user_id", length = 36, nullable = false)
    private String hostUserId;
    @Column(length = 100, nullable = false)
    private String name;
    @Column(name = "focus_seconds", nullable = false)
    private int focusSeconds;
    @Column(length = 20, nullable = false)
    private String status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(name = "closed_at")
    private Instant closedAt;

    protected StudyRoom() {
    }

    public StudyRoom(String id, String teamId, String hostUserId, String name, int focusSeconds, Instant now) {
        this.id = id;
        this.teamId = teamId;
        this.hostUserId = hostUserId;
        this.name = name;
        this.focusSeconds = focusSeconds;
        this.status = "WAITING";
        this.createdAt = now;
        this.updatedAt = now;
    }

    public String getId() { return id; }
    public String getTeamId() { return teamId; }
    public String getHostUserId() { return hostUserId; }
    public String getName() { return name; }
    public int getFocusSeconds() { return focusSeconds; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getClosedAt() { return closedAt; }

    public void start(Instant now) {
        status = "FOCUS";
        updatedAt = now;
    }

    public void waitForNextRound(Instant now) {
        status = "WAITING";
        updatedAt = now;
    }

    public void close(Instant now) {
        status = "CLOSED";
        closedAt = now;
        updatedAt = now;
    }
}
