package com.tomato.companion.server.room;

import com.tomato.companion.server.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RoomController {
    private final RoomService rooms;

    public RoomController(RoomService rooms) {
        this.rooms = rooms;
    }

    @PostMapping("/teams/{teamId}/rooms")
    ApiResponse<RoomResponse> create(
            Authentication authentication,
            @PathVariable String teamId,
            @Valid @RequestBody CreateRoomRequest request) {
        return ApiResponse.success(rooms.create(authentication.getName(), teamId, request));
    }

    @GetMapping("/teams/{teamId}/rooms/active")
    ApiResponse<RoomResponse> active(
            Authentication authentication,
            @PathVariable String teamId) {
        return ApiResponse.success(rooms.active(authentication.getName(), teamId));
    }

    @GetMapping("/rooms/{roomId}")
    ApiResponse<RoomResponse> detail(
            Authentication authentication,
            @PathVariable String roomId) {
        return ApiResponse.success(rooms.detail(authentication.getName(), roomId));
    }

    @PostMapping("/rooms/{roomId}/join")
    ApiResponse<RoomResponse> join(
            Authentication authentication,
            @PathVariable String roomId) {
        return ApiResponse.success(rooms.join(authentication.getName(), roomId));
    }

    @PostMapping("/rooms/{roomId}/leave")
    ApiResponse<Void> leave(
            Authentication authentication,
            @PathVariable String roomId) {
        rooms.leave(authentication.getName(), roomId);
        return ApiResponse.success(null);
    }

    @PutMapping("/rooms/{roomId}/ready")
    ApiResponse<RoomResponse> ready(
            Authentication authentication,
            @PathVariable String roomId,
            @RequestBody ReadyRequest request) {
        return ApiResponse.success(
                rooms.ready(authentication.getName(), roomId, request.ready()));
    }

    @PostMapping("/rooms/{roomId}/start")
    ApiResponse<RoomResponse> start(
            Authentication authentication,
            @PathVariable String roomId) {
        return ApiResponse.success(rooms.start(authentication.getName(), roomId));
    }

    @PostMapping("/rooms/{roomId}/cancel")
    ApiResponse<Void> cancel(
            Authentication authentication,
            @PathVariable String roomId) {
        rooms.cancel(authentication.getName(), roomId);
        return ApiResponse.success(null);
    }

    @GetMapping("/rooms/{roomId}/sessions")
    ApiResponse<List<StudySessionResponse>> history(
            Authentication authentication,
            @PathVariable String roomId) {
        return ApiResponse.success(rooms.history(authentication.getName(), roomId));
    }
}
