package com.tomato.companion.server.room;

import java.time.Instant;

public record StudySessionResponse(
        String id,
        String roomId,
        String status,
        Instant startTime,
        Instant endTime,
        int durationSeconds,
        Instant finishedAt) {

    static StudySessionResponse from(StudySession session) {
        return new StudySessionResponse(
                session.getId(),
                session.getRoomId(),
                session.getStatus(),
                session.getStartTime(),
                session.getEndTime(),
                session.getDurationSeconds(),
                session.getFinishedAt());
    }
}
