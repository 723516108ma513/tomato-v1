package com.tomato.companion.server.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RefreshRequest(
        @NotBlank(message = "Refresh Token 不能为空")
        @Size(max = 500, message = "Refresh Token 格式无效")
        String refreshToken) {
}
