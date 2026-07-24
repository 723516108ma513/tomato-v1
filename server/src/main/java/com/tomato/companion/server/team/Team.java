package com.tomato.companion.server.team;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "teams")
public class Team {
    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(length = 80, nullable = false)
    private String name;

    @Column(length = 500, nullable = false)
    private String description;

    @Column(name = "owner_id", length = 36, nullable = false)
    private String ownerId;

    @Column(name = "invite_code", length = 16, nullable = false, unique = true)
    private String inviteCode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Team() {
    }

    public Team(
            String id,
            String name,
            String description,
            String ownerId,
            String inviteCode,
            Instant now) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.ownerId = ownerId;
        this.inviteCode = inviteCode;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public String getInviteCode() {
        return inviteCode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(String name, String description, Instant now) {
        this.name = name;
        this.description = description;
        this.updatedAt = now;
    }

    public void rotateInviteCode(String inviteCode, Instant now) {
        this.inviteCode = inviteCode;
        this.updatedAt = now;
    }
}
