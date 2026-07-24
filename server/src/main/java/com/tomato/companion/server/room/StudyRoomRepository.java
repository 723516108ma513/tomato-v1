package com.tomato.companion.server.room;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StudyRoomRepository extends JpaRepository<StudyRoom, String> {
    boolean existsByTeamId(String teamId);

    boolean existsByTeamIdAndStatusIn(String teamId, List<String> statuses);
    Optional<StudyRoom> findFirstByTeamIdAndStatusInOrderByCreatedAtDesc(String teamId, List<String> statuses);
}
