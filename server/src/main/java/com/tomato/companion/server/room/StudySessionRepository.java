package com.tomato.companion.server.room;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudySessionRepository extends JpaRepository<StudySession, String> {
    Optional<StudySession> findFirstByRoomIdAndStatusOrderByCreatedAtDesc(String roomId, String status);
    List<StudySession> findAllByRoomIdOrderByCreatedAtDesc(String roomId);
    List<StudySession> findAllByStatusAndEndTimeLessThanEqual(String status, Instant endTime);
}
