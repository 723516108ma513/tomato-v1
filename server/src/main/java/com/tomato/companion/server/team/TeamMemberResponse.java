package com.tomato.companion.server.team;

import com.tomato.companion.server.user.User;
import java.time.Instant;

public record TeamMemberResponse(
        String userId,
        String nickname,
        String avatarUrl,
        String role,
        Instant joinedAt) {

    static TeamMemberResponse from(TeamMember member, User user) {
        return new TeamMemberResponse(
                user.getId(),
                user.getNickname(),
                user.getAvatarUrl(),
                member.getRole(),
                member.getJoinedAt());
    }
}
