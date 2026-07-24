package com.tomato.companion.server.auth;

import com.tomato.companion.server.user.UserResponse;
import java.time.Instant;

public record AuthResponse(
        UserResponse user,
        String accessToken,
        String refreshToken,
        Instant accessTokenExpiresAt) {
}
