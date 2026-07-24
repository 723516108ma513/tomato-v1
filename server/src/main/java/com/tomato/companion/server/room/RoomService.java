package com.tomato.companion.server.room;

import com.tomato.companion.server.exception.ApiException;
import com.tomato.companion.server.team.TeamMemberRepository;
import com.tomato.companion.server.user.User;
import com.tomato.companion.server.user.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class RoomService {
    private static final List<String> ACTIVE_ROOM_STATUSES = List.of("WAITING", "FOCUS");
    private final StudyRoomRepository rooms;
    private final RoomMemberRepository roomMembers;
    private final StudySessionRepository sessions;
    private final SessionParticipantRepository participants;
    private final TeamMemberRepository teamMembers;
    private final UserRepository users;
    private final RoomBroadcaster broadcaster;

    public RoomService(
            StudyRoomRepository rooms,
            RoomMemberRepository roomMembers,
            StudySessionRepository sessions,
            SessionParticipantRepository participants,
            TeamMemberRepository teamMembers,
            UserRepository users,
            RoomBroadcaster broadcaster) {
        this.rooms = rooms;
        this.roomMembers = roomMembers;
        this.sessions = sessions;
        this.participants = participants;
        this.teamMembers = teamMembers;
        this.users = users;
        this.broadcaster = broadcaster;
    }

    @Transactional
    public RoomResponse create(String userId, String teamId, CreateRoomRequest request) {
        requireTeamMember(teamId, userId);
        if (rooms.existsByTeamIdAndStatusIn(teamId, ACTIVE_ROOM_STATUSES)) {
            throw error("ACTIVE_ROOM_ALREADY_EXISTS", "团队已有进行中的学习房间", HttpStatus.CONFLICT);
        }
        Instant now = Instant.now();
        StudyRoom room = new StudyRoom(
                UUID.randomUUID().toString(),
                teamId,
                userId,
                request.name().trim(),
                request.focusSeconds(),
                now);
        rooms.save(room);
        roomMembers.save(new RoomMember(UUID.randomUUID().toString(), room.getId(), userId, now));
        return detail(userId, room.getId());
    }

    @Transactional(readOnly = true)
    public RoomResponse active(String userId, String teamId) {
        requireTeamMember(teamId, userId);
        return rooms.findFirstByTeamIdAndStatusInOrderByCreatedAtDesc(teamId, ACTIVE_ROOM_STATUSES)
                .map(room -> detail(userId, room.getId()))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public RoomResponse detail(String userId, String roomId) {
        StudyRoom room = requireRoom(roomId);
        requireTeamMember(room.getTeamId(), userId);
        List<RoomMember> activeMembers =
                roomMembers.findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(roomId);
        Map<String, User> userMap = users
                .findAllById(activeMembers.stream().map(RoomMember::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        List<RoomMemberResponse> memberResponses = activeMembers.stream()
                .map(member -> RoomMemberResponse.from(
                        member,
                        userMap.get(member.getUserId()),
                        room.getHostUserId(),
                        broadcaster.isOnline(roomId, member.getUserId())))
                .toList();
        StudySessionResponse currentSession = sessions
                .findFirstByRoomIdAndStatusOrderByCreatedAtDesc(roomId, "RUNNING")
                .map(StudySessionResponse::from)
                .orElse(null);
        return new RoomResponse(
                room.getId(),
                room.getTeamId(),
                room.getHostUserId(),
                room.getName(),
                room.getFocusSeconds(),
                room.getStatus(),
                memberResponses,
                currentSession,
                room.getHostUserId().equals(userId),
                Instant.now(),
                room.getCreatedAt(),
                room.getUpdatedAt());
    }

    @Transactional
    public RoomResponse join(String userId, String roomId) {
        StudyRoom room = requireOpenRoom(roomId);
        if (!"WAITING".equals(room.getStatus())) {
            throw error("ROOM_NOT_WAITING", "本轮专注开始后暂时不能加入", HttpStatus.CONFLICT);
        }
        requireTeamMember(room.getTeamId(), userId);
        Instant now = Instant.now();
        RoomMember membership = roomMembers
                .findFirstByRoomIdAndUserIdOrderByJoinedAtDesc(roomId, userId)
                .orElseGet(() -> new RoomMember(UUID.randomUUID().toString(), roomId, userId, now));
        if (!membership.isActive()) membership.rejoin(now);
        roomMembers.save(membership);
        publishAfterCommit(roomId, "ROOM_MEMBER_JOINED");
        return detail(userId, roomId);
    }

    @Transactional
    public void leave(String userId, String roomId) {
        StudyRoom room = requireRoom(roomId);
        RoomMember membership = requireRoomMember(roomId, userId);
        if (room.getHostUserId().equals(userId)) {
            closeRoom(room);
            publishAfterCommit(roomId, "ROOM_CANCELLED");
            return;
        }
        membership.leave(Instant.now());
        roomMembers.save(membership);
        publishAfterCommit(roomId, "ROOM_MEMBER_LEFT");
    }

    @Transactional
    public RoomResponse ready(String userId, String roomId, boolean ready) {
        StudyRoom room = requireOpenRoom(roomId);
        if (!"WAITING".equals(room.getStatus())) {
            throw error("ROOM_NOT_WAITING", "房间当前不能修改准备状态", HttpStatus.CONFLICT);
        }
        RoomMember membership = requireRoomMember(roomId, userId);
        membership.setReady(ready);
        roomMembers.save(membership);
        publishAfterCommit(roomId, "ROOM_MEMBER_READY_CHANGED");
        return detail(userId, roomId);
    }

    @Transactional
    public RoomResponse start(String userId, String roomId) {
        StudyRoom room = requireHost(userId, roomId);
        if (!"WAITING".equals(room.getStatus())) {
            throw error("ROOM_NOT_WAITING", "房间不在等待状态", HttpStatus.CONFLICT);
        }
        List<RoomMember> activeMembers =
                roomMembers.findAllByRoomIdAndLeftAtIsNullOrderByJoinedAtAsc(roomId);
        if (activeMembers.isEmpty() || activeMembers.stream().anyMatch(member -> !member.isReady())) {
            throw error("ROOM_MEMBER_NOT_READY", "仍有成员没有准备", HttpStatus.CONFLICT);
        }
        if (sessions.findFirstByRoomIdAndStatusOrderByCreatedAtDesc(roomId, "RUNNING").isPresent()) {
            throw error("ACTIVE_SESSION_ALREADY_EXISTS", "房间已有进行中的番茄钟", HttpStatus.CONFLICT);
        }
        Instant now = Instant.now();
        StudySession session = new StudySession(
                UUID.randomUUID().toString(), roomId, now, room.getFocusSeconds());
        sessions.save(session);
        participants.saveAll(activeMembers.stream()
                .map(member -> new SessionParticipant(
                        UUID.randomUUID().toString(), session.getId(), member.getUserId(), now))
                .toList());
        activeMembers.forEach(member -> member.setReady(false));
        roomMembers.saveAll(activeMembers);
        room.start(now);
        rooms.save(room);
        publishAfterCommit(roomId, "ROOM_SESSION_STARTED");
        return detail(userId, roomId);
    }

    @Transactional
    public void cancel(String userId, String roomId) {
        StudyRoom room = requireHost(userId, roomId);
        closeRoom(room);
        publishAfterCommit(roomId, "ROOM_CANCELLED");
    }

    @Transactional(readOnly = true)
    public List<StudySessionResponse> history(String userId, String roomId) {
        StudyRoom room = requireRoom(roomId);
        requireTeamMember(room.getTeamId(), userId);
        return sessions.findAllByRoomIdOrderByCreatedAtDesc(roomId).stream()
                .filter(session -> participants.existsBySessionIdAndUserId(session.getId(), userId))
                .map(StudySessionResponse::from)
                .toList();
    }

    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void finishDueSessions() {
        Instant now = Instant.now();
        for (StudySession session :
                sessions.findAllByStatusAndEndTimeLessThanEqual("RUNNING", now)) {
            session.finish(now);
            sessions.save(session);
            List<SessionParticipant> completedParticipants =
                    participants.findAllBySessionId(session.getId());
            completedParticipants.forEach(participant ->
                    participant.complete(session.getDurationSeconds()));
            participants.saveAll(completedParticipants);
            rooms.findById(session.getRoomId()).ifPresent(room -> {
                if (!"CLOSED".equals(room.getStatus())) {
                    room.waitForNextRound(now);
                    rooms.save(room);
                }
            });
            publishAfterCommit(session.getRoomId(), "ROOM_SESSION_FINISHED");
        }
    }

    private void closeRoom(StudyRoom room) {
        Instant now = Instant.now();
        sessions.findFirstByRoomIdAndStatusOrderByCreatedAtDesc(room.getId(), "RUNNING")
                .ifPresent(session -> {
                    session.cancel(now);
                    sessions.save(session);
                });
        room.close(now);
        rooms.save(room);
    }

    private StudyRoom requireHost(String userId, String roomId) {
        StudyRoom room = requireRoom(roomId);
        if (!room.getHostUserId().equals(userId)) {
            throw error("ROOM_HOST_REQUIRED", "只有房主可以执行此操作", HttpStatus.FORBIDDEN);
        }
        return room;
    }

    private StudyRoom requireOpenRoom(String roomId) {
        StudyRoom room = requireRoom(roomId);
        if ("CLOSED".equals(room.getStatus())) {
            throw error("ROOM_NOT_FOUND", "学习房间已关闭", HttpStatus.NOT_FOUND);
        }
        return room;
    }

    private StudyRoom requireRoom(String roomId) {
        return rooms.findById(roomId)
                .orElseThrow(() -> error("ROOM_NOT_FOUND", "学习房间不存在", HttpStatus.NOT_FOUND));
    }

    private RoomMember requireRoomMember(String roomId, String userId) {
        return roomMembers.findFirstByRoomIdAndUserIdOrderByJoinedAtDesc(roomId, userId)
                .filter(RoomMember::isActive)
                .orElseThrow(() -> error("ROOM_NOT_JOINED", "请先加入学习房间", HttpStatus.FORBIDDEN));
    }

    private void requireTeamMember(String teamId, String userId) {
        if (!teamMembers.existsByTeamIdAndUserId(teamId, userId)) {
            throw error("TEAM_ACCESS_DENIED", "你不是该团队成员", HttpStatus.FORBIDDEN);
        }
    }

    private ApiException error(String code, String message, HttpStatus status) {
        return new ApiException(code, message, status);
    }

    private void publishAfterCommit(String roomId, String eventType) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            broadcaster.publish(roomId, eventType);
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                broadcaster.publish(roomId, eventType);
            }
        });
    }
}
