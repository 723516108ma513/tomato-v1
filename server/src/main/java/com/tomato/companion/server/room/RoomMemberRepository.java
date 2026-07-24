package com.tomato.companion.server.room;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomMemberRepository extends JpaRepository<RoomMember, String> {
    Optional<RoomMember> findFirstByRoomIdAndUserIdOrderByJoinedAtDesc(String roomId, String userId);
    List<RoomMember> findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(String roomId);
}
