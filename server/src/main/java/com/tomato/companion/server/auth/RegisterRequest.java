package com.tomato.companion.server.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "邮箱不能为空")
        @Email(message = "邮箱格式不正确")
        @Size(max = 254, message = "邮箱过长")
        String email,
        @NotBlank(message = "密码不能为空")
        @Size(min = 8, max = 72, message = "密码长度需要在 8 到 72 个字符之间")
        String password,
        @NotBlank(message = "昵称不能为空")
        @Size(max = 40, message = "昵称最多 40 个字符")
        String nickname) {
}
