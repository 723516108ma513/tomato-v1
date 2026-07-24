package com.tomato.companion.server.team;

import com.tomato.companion.server.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/teams")
public class TeamController {
    private final TeamService teamService;
    private final InviteRateLimiter inviteRateLimiter;

    public TeamController(TeamService teamService, InviteRateLimiter inviteRateLimiter) {
        this.teamService = teamService;
        this.inviteRateLimiter = inviteRateLimiter;
    }

    @PostMapping
    ApiResponse<TeamResponse> create(
            Authentication authentication,
            @Valid @RequestBody CreateTeamRequest request) {
        return ApiResponse.success(teamService.create(authentication.getName(), request));
    }

    @GetMapping
    ApiResponse<List<TeamResponse>> list(Authentication authentication) {
        return ApiResponse.success(teamService.list(authentication.getName()));
    }

    @GetMapping("/{teamId}")
    ApiResponse<TeamResponse> detail(
            Authentication authentication,
            @PathVariable String teamId) {
        return ApiResponse.success(teamService.detail(authentication.getName(), teamId));
    }

    @PatchMapping("/{teamId}")
    ApiResponse<TeamResponse> update(
            Authentication authentication,
            @PathVariable String teamId,
            @Valid @RequestBody UpdateTeamRequest request) {
        return ApiResponse.success(teamService.update(authentication.getName(), teamId, request));
    }

    @DeleteMapping("/{teamId}")
    ApiResponse<Void> delete(
            Authentication authentication,
            @PathVariable String teamId) {
        teamService.delete(authentication.getName(), teamId);
        return ApiResponse.success(null);
    }

    @PostMapping("/join")
    ApiResponse<TeamResponse> join(
            Authentication authentication,
            HttpServletRequest servletRequest,
            @Valid @RequestBody JoinTeamRequest request) {
        inviteRateLimiter.check(authentication.getName(), servletRequest.getRemoteAddr());
        return ApiResponse.success(
                teamService.join(authentication.getName(), request.inviteCode()));
    }

    @PostMapping("/{teamId}/leave")
    ApiResponse<Void> leave(
            Authentication authentication,
            @PathVariable String teamId) {
        teamService.leave(authentication.getName(), teamId);
        return ApiResponse.success(null);
    }

    @DeleteMapping("/{teamId}/members/{userId}")
    ApiResponse<Void> removeMember(
            Authentication authentication,
            @PathVariable String teamId,
            @PathVariable String userId) {
        teamService.removeMember(authentication.getName(), teamId, userId);
        return ApiResponse.success(null);
    }

    @PostMapping("/{teamId}/invite-code/rotate")
    ApiResponse<TeamResponse> rotateInviteCode(
            Authentication authentication,
            @PathVariable String teamId) {
        return ApiResponse.success(
                teamService.rotateInviteCode(authentication.getName(), teamId));
    }
}
