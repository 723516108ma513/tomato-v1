package com.tomato.companion.server.team;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamMemberRepository extends JpaRepository<TeamMember, String> {
    List<TeamMember> findAllByUserIdOrderByJoinedAtAsc(String userId);

    List<TeamMember> findAllByTeamIdOrderByJoinedAtAsc(String teamId);

    Optional<TeamMember> findByTeamIdAndUserId(String teamId, String userId);

    boolean existsByTeamIdAndUserId(String teamId, String userId);

    long countByTeamId(String teamId);

    void deleteAllByTeamId(String teamId);
}
