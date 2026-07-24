package com.tomato.companion.server.team;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "team_members")
public class TeamMember {
    @Id
    @Column(length = 36, nullable = false)
    private String id;

    @Column(name = "team_id", length = 36, nullable = false)
    private String teamId;

    @Column(name = "user_id", length = 36, nullable = false)
    private String userId;

    @Column(length = 20, nullable = false)
    private String role;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected TeamMember() {
    }

    public TeamMember(
            String id,
            String teamId,
            String userId,
            String role,
            Instant joinedAt) {
        this.id = id;
        this.teamId = teamId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public String getId() {
        return id;
    }

    public String getTeamId() {
        return teamId;
    }

    public String getUserId() {
        return userId;
    }

    public String getRole() {
        return role;
    }

    public Instant getJoinedAt() {
        return joinedAt;
    }
}
