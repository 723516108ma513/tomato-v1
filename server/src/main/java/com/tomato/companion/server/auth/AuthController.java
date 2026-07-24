package com.tomato.companion.server.auth;

import com.tomato.companion.server.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    ApiResponse<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request,
            @RequestHeader(value = "X-Device-Name", required = false) String deviceName) {
        return ApiResponse.success(authService.register(request, deviceName));
    }

    @PostMapping("/login")
    ApiResponse<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            @RequestHeader(value = "X-Device-Name", required = false) String deviceName,
            HttpServletRequest servletRequest) {
        return ApiResponse.success(authService.login(
                request,
                deviceName,
                servletRequest.getRemoteAddr()));
    }

    @PostMapping("/refresh")
    ApiResponse<AuthResponse> refresh(
            @Valid @RequestBody RefreshRequest request,
            @RequestHeader(value = "X-Device-Name", required = false) String deviceName) {
        return ApiResponse.success(authService.refresh(request, deviceName));
    }

    @PostMapping("/logout")
    ApiResponse<Map<String, Boolean>> logout(
            Authentication authentication,
            @Valid @RequestBody LogoutRequest request) {
        authService.logout(authentication.getName(), request);
        return ApiResponse.success(Map.of("loggedOut", true));
    }
}
