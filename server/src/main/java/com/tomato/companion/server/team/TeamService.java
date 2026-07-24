package com.tomato.companion.server.team;

import com.tomato.companion.server.exception.ApiException;
import com.tomato.companion.server.room.StudyRoomRepository;
import com.tomato.companion.server.user.User;
import com.tomato.companion.server.user.UserRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TeamService {
    private static final char[] INVITE_ALPHABET =
            "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    private static final int INVITE_LENGTH = 8;

    private final TeamRepository teams;
    private final TeamMemberRepository members;
    private final UserRepository users;
    private final StudyRoomRepository studyRooms;
    private final SecureRandom random = new SecureRandom();

    public TeamService(
            TeamRepository teams,
            TeamMemberRepository members,
            UserRepository users,
            StudyRoomRepository studyRooms) {
        this.teams = teams;
        this.members = members;
        this.users = users;
        this.studyRooms = studyRooms;
    }

    @Transactional
    public TeamResponse create(String userId, CreateTeamRequest request) {
        Instant now = Instant.now();
        Team team = new Team(
                UUID.randomUUID().toString(),
                request.name().trim(),
                normalizeDescription(request.description()),
                userId,
                nextInviteCode(),
                now);
        TeamMember owner = new TeamMember(
                UUID.randomUUID().toString(),
                team.getId(),
                userId,
                "OWNER",
                now);
        teams.save(team);
        members.save(owner);
        return TeamResponse.detail(
                team,
                owner,
                1,
                List.of(TeamMemberResponse.from(owner, requireUser(userId))));
    }

    @Transactional(readOnly = true)
    public List<TeamResponse> list(String userId) {
        return members.findAllByUserIdOrderByJoinedAtAsc(userId).stream()
                .map(membership -> {
                    Team team = requireTeam(membership.getTeamId());
                    return TeamResponse.summary(
                            team,
                            membership,
                            members.countByTeamId(team.getId()));
                })
                .sorted(Comparator.comparing(TeamResponse::updatedAt).reversed())
                .toList();
    }

    @Transactional(readOnly = true)
    public TeamResponse detail(String userId, String teamId) {
        TeamMember membership = requireMember(teamId, userId);
        Team team = requireTeam(teamId);
        List<TeamMember> teamMembers = members.findAllByTeamIdOrderByJoinedAtAsc(teamId);
        Map<String, User> userMap = users
                .findAllById(teamMembers.stream().map(TeamMember::getUserId).toList())
                .stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        List<TeamMemberResponse> memberResponses = teamMembers.stream()
                .map(member -> TeamMemberResponse.from(
                        member,
                        userMap.getOrDefault(member.getUserId(), requireUser(member.getUserId()))))
                .toList();
        return TeamResponse.detail(team, membership, teamMembers.size(), memberResponses);
    }

    @Transactional
    public TeamResponse update(String userId, String teamId, UpdateTeamRequest request) {
        Team team = requireOwner(teamId, userId);
        team.update(
                request.name().trim(),
                normalizeDescription(request.description()),
                Instant.now());
        teams.save(team);
        return detail(userId, teamId);
    }

    @Transactional
    public TeamResponse join(String userId, String rawInviteCode) {
        String inviteCode = rawInviteCode.trim().toUpperCase();
        Team team = teams.findByInviteCode(inviteCode)
                .orElseThrow(() -> new ApiException(
                        "INVALID_INVITE_CODE",
                        "邀请码无效或已失效",
                        HttpStatus.NOT_FOUND));
        if (members.existsByTeamIdAndUserId(team.getId(), userId)) {
            throw new ApiException(
                    "ALREADY_TEAM_MEMBER",
                    "你已经在这个团队中",
                    HttpStatus.CONFLICT);
        }
        TeamMember member = new TeamMember(
                UUID.randomUUID().toString(),
                team.getId(),
                userId,
                "MEMBER",
                Instant.now());
        members.save(member);
        return detail(userId, team.getId());
    }

    @Transactional
    public void leave(String userId, String teamId) {
        Team team = requireTeam(teamId);
        TeamMember member = requireMember(teamId, userId);
        if (team.getOwnerId().equals(userId)) {
            throw new ApiException(
                    "OWNER_CANNOT_LEAVE",
                    "团队创建者不能直接退出，请先删除团队",
                    HttpStatus.CONFLICT);
        }
        members.delete(member);
    }

    @Transactional
    public void removeMember(String userId, String teamId, String memberUserId) {
        Team team = requireOwner(teamId, userId);
        if (team.getOwnerId().equals(memberUserId)) {
            throw new ApiException(
                    "TEAM_OWNER_REQUIRED",
                    "不能移除团队创建者",
                    HttpStatus.CONFLICT);
        }
        TeamMember member = requireMember(teamId, memberUserId);
        members.delete(member);
    }

    @Transactional
    public TeamResponse rotateInviteCode(String userId, String teamId) {
        Team team = requireOwner(teamId, userId);
        team.rotateInviteCode(nextInviteCode(), Instant.now());
        teams.save(team);
        return detail(userId, teamId);
    }

    @Transactional
    public void delete(String userId, String teamId) {
        requireOwner(teamId, userId);
        if (studyRooms.existsByTeamId(teamId)) {
            throw new ApiException(
                    "TEAM_HAS_ROOM_HISTORY",
                    "团队已有学习房间记录，为保护历史暂时不能删除",
                    HttpStatus.CONFLICT);
        }
        members.deleteAllByTeamId(teamId);
        teams.deleteById(teamId);
    }

    private Team requireOwner(String teamId, String userId) {
        Team team = requireTeam(teamId);
        if (!team.getOwnerId().equals(userId)) {
            throw new ApiException(
                    "TEAM_OWNER_REQUIRED",
                    "只有团队创建者可以执行此操作",
                    HttpStatus.FORBIDDEN);
        }
        return team;
    }

    private Team requireTeam(String teamId) {
        return teams.findById(teamId)
                .orElseThrow(() -> new ApiException(
                        "TEAM_NOT_FOUND",
                        "团队不存在",
                        HttpStatus.NOT_FOUND));
    }

    private TeamMember requireMember(String teamId, String userId) {
        return members.findByTeamIdAndUserId(teamId, userId)
                .orElseThrow(() -> new ApiException(
                        "TEAM_ACCESS_DENIED",
                        "你不是该团队成员",
                        HttpStatus.FORBIDDEN));
    }

    private User requireUser(String userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(
                        "USER_NOT_FOUND",
                        "用户不存在",
                        HttpStatus.NOT_FOUND));
    }

    private String nextInviteCode() {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder result = new StringBuilder(INVITE_LENGTH);
            for (int index = 0; index < INVITE_LENGTH; index++) {
                result.append(INVITE_ALPHABET[random.nextInt(INVITE_ALPHABET.length)]);
            }
            String candidate = result.toString();
            if (!teams.existsByInviteCode(candidate)) {
                return candidate;
            }
        }
        throw new ApiException(
                "INVITE_CODE_UNAVAILABLE",
                "暂时无法生成邀请码，请稍后重试",
                HttpStatus.SERVICE_UNAVAILABLE);
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }
}
