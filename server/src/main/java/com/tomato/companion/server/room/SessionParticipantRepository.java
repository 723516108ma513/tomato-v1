package com.tomato.companion.server.room;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, String> {
    List<SessionParticipant> findAllBySessionId(String sessionId);

    boolean existsBySessionIdAndUserId(String sessionId, String userId);
}
