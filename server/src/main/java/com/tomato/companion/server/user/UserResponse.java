package com.tomato.companion.server.user;

import java.time.Instant;

public record UserResponse(
        String id,
        String email,
        String nickname,
        String avatarUrl,
        Instant createdAt,
        Instant updatedAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getNickname(),
                user.getAvatarUrl(),
                user.getCreatedAt(),
                user.getUpdatedAt());
    }
}
