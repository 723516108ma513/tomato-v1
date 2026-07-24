package com.tomato.companion.server.room;

import com.tomato.companion.server.user.User;
import java.time.Instant;

public record RoomMemberResponse(
        String userId,
        String nickname,
        String avatarUrl,
        boolean ready,
        boolean host,
        boolean online,
        Instant joinedAt) {

    static RoomMemberResponse from(RoomMember member, User user, String hostUserId, boolean online) {
        return new RoomMemberResponse(
                user.getId(),
                user.getNickname(),
                user.getAvatarUrl(),
                member.isReady(),
                user.getId().equals(hostUserId),
                online,
                member.getJoinedAt());
    }
}
