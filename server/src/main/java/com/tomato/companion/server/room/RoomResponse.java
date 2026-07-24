package com.tomato.companion.server.room;

import java.time.Instant;
import java.util.List;

public record RoomResponse(
        String id,
        String teamId,
        String hostUserId,
        String name,
        int focusSeconds,
        String status,
        List<RoomMemberResponse> members,
        StudySessionResponse currentSession,
        boolean currentUserIsHost,
        Instant serverTime,
        Instant createdAt,
        Instant updatedAt) {
}
