package com.tomato.companion.server.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank(message = "昵称不能为空")
        @Size(max = 40, message = "昵称最多 40 个字符")
        String nickname) {
}
