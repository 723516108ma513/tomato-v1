package com.tomato.companion.server.room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "study_sessions")
public class StudySession {
    @Id
    @Column(length = 36)
    private String id;
    @Column(name = "room_id", length = 36, nullable = false)
    private String roomId;
    @Column(length = 20, nullable = false)
    private String status;
    @Column(name = "start_time", nullable = false)
    private Instant startTime;
    @Column(name = "end_time", nullable = false)
    private Instant endTime;
    @Column(name = "duration_seconds", nullable = false)
    private int durationSeconds;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(name = "finished_at")
    private Instant finishedAt;

    protected StudySession() {
    }

    public StudySession(String id, String roomId, Instant startTime, int durationSeconds) {
        this.id = id;
        this.roomId = roomId;
        this.status = "RUNNING";
        this.startTime = startTime;
        this.endTime = startTime.plusSeconds(durationSeconds);
        this.durationSeconds = durationSeconds;
        this.createdAt = startTime;
    }

    public String getId() { return id; }
    public String getRoomId() { return roomId; }
    public String getStatus() { return status; }
    public Instant getStartTime() { return startTime; }
    public Instant getEndTime() { return endTime; }
    public int getDurationSeconds() { return durationSeconds; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getFinishedAt() { return finishedAt; }

    public void finish(Instant now) {
        status = "FINISHED";
        finishedAt = now;
    }

    public void cancel(Instant now) {
        status = "CANCELLED";
        finishedAt = now;
    }
}
