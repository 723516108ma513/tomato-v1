package com.tomato.companion.server.user;

import com.tomato.companion.server.common.ApiResponse;
import com.tomato.companion.server.exception.ApiException;
import jakarta.validation.Valid;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    private final UserRepository users;

    public UserController(UserRepository users) {
        this.users = users;
    }

    @GetMapping("/me")
    ApiResponse<UserResponse> current(Authentication authentication) {
        return ApiResponse.success(UserResponse.from(requireUser(authentication.getName())));
    }

    @PatchMapping("/me")
    @Transactional
    ApiResponse<UserResponse> update(
            Authentication authentication,
            @Valid @RequestBody UpdateUserRequest request) {
        User user = requireUser(authentication.getName());
        user.updateNickname(request.nickname().trim(), Instant.now());
        return ApiResponse.success(UserResponse.from(users.save(user)));
    }

    private User requireUser(String userId) {
        return users.findById(userId)
                .filter(user -> "ACTIVE".equals(user.getStatus()))
                .orElseThrow(() -> new ApiException(
                        "USER_NOT_FOUND",
                        "用户不存在或已停用",
                        HttpStatus.NOT_FOUND));
    }
}
