package com.tomato.companion.server.team;

import java.time.Instant;
import java.util.List;

public record TeamResponse(
        String id,
        String name,
        String description,
        String ownerId,
        String inviteCode,
        String currentUserRole,
        long memberCount,
        List<TeamMemberResponse> members,
        Instant createdAt,
        Instant updatedAt) {

    static TeamResponse summary(Team team, TeamMember membership, long memberCount) {
        return from(team, membership, memberCount, List.of());
    }

    static TeamResponse detail(
            Team team,
            TeamMember membership,
            long memberCount,
            List<TeamMemberResponse> members) {
        return from(team, membership, memberCount, members);
    }

    private static TeamResponse from(
            Team team,
            TeamMember membership,
            long memberCount,
            List<TeamMemberResponse> members) {
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getDescription(),
                team.getOwnerId(),
                team.getInviteCode(),
                membership.getRole(),
                memberCount,
                members,
                team.getCreatedAt(),
                team.getUpdatedAt());
    }
}
