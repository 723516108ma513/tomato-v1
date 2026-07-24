package com.tomato.companion.server.room;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "room_members")
public class RoomMember {
    @Id
    @Column(length = 36)
    private String id;
    @Column(name = "room_id", length = 36, nullable = false)
    private String roomId;
    @Column(name = "user_id", length = 36, nullable = false)
    private String userId;
    @Column(nullable = false)
    private boolean ready;
    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;
    @Column(name = "left_at")
    private Instant leftAt;

    protected RoomMember() {
    }

    public RoomMember(String id, String roomId, String userId, Instant now) {
        this.id = id;
        this.roomId = roomId;
        this.userId = userId;
        this.joinedAt = now;
    }

    public String getId() { return id; }
    public String getRoomId() { return roomId; }
    public String getUserId() { return userId; }
    public boolean isReady() { return ready; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getLeftAt() { return leftAt; }
    public boolean isActive() { return leftAt == null; }

    public void rejoin(Instant now) {
        leftAt = null;
        ready = false;
        joinedAt = now;
    }

    public void leave(Instant now) {
        leftAt = now;
        ready = false;
    }

    public void setReady(boolean ready) {
        this.ready = ready;
    }
}
