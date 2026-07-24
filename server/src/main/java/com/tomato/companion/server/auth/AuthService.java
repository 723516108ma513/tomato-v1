package com.tomato.companion.server.auth;

import com.tomato.companion.server.exception.ApiException;
import com.tomato.companion.server.security.JwtService;
import com.tomato.companion.server.security.LoginRateLimiter;
import com.tomato.companion.server.user.User;
import com.tomato.companion.server.user.UserRepository;
import com.tomato.companion.server.user.UserResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokens;
    private final LoginRateLimiter loginRateLimiter;

    public AuthService(
            UserRepository users,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokens,
            LoginRateLimiter loginRateLimiter) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokens = refreshTokens;
        this.loginRateLimiter = loginRateLimiter;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request, String deviceName) {
        String email = normalizeEmail(request.email());
        validatePasswordBytes(request.password());
        if (users.existsByEmail(email)) {
            throw emailExists();
        }
        Instant now = Instant.now();
        User user = new User(
                UUID.randomUUID().toString(),
                email,
                passwordEncoder.encode(request.password()),
                request.nickname().trim(),
                now);
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException exception) {
            throw emailExists();
        }
        return issue(user, deviceName, now);
    }

    @Transactional
    public AuthResponse login(
            LoginRequest request,
            String deviceName,
            String remoteAddress) {
        String email = normalizeEmail(request.email());
        loginRateLimiter.check(email, remoteAddress);
        User user = users.findByEmail(email)
                .filter(candidate -> "ACTIVE".equals(candidate.getStatus()))
                .filter(candidate -> passwordEncoder.matches(
                        request.password(),
                        candidate.getPasswordHash()))
                .orElseThrow(() -> new ApiException(
                        "INVALID_CREDENTIALS",
                        "邮箱或密码不正确",
                        HttpStatus.UNAUTHORIZED));
        return issue(user, deviceName, Instant.now());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse refresh(RefreshRequest request, String deviceName) {
        Instant now = Instant.now();
        RefreshTokenService.RotatedRefreshToken rotated =
                refreshTokens.rotate(request.refreshToken(), deviceName, now);
        JwtService.IssuedAccessToken access = jwtService.issue(rotated.user(), now);
        return new AuthResponse(
                UserResponse.from(rotated.user()),
                access.token(),
                rotated.rawToken(),
                access.expiresAt());
    }

    @Transactional
    public void logout(String userId, LogoutRequest request) {
        refreshTokens.revokeForUser(userId, request.refreshToken(), Instant.now());
    }

    private AuthResponse issue(User user, String deviceName, Instant now) {
        JwtService.IssuedAccessToken access = jwtService.issue(user, now);
        RefreshTokenService.IssuedRefreshToken refresh =
                refreshTokens.create(user, deviceName, now);
        return new AuthResponse(
                UserResponse.from(user),
                access.token(),
                refresh.rawToken(),
                access.expiresAt());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static void validatePasswordBytes(String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(
                    "VALIDATION_ERROR",
                    "密码 UTF-8 长度不能超过 72 字节",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private static ApiException emailExists() {
        return new ApiException(
                "EMAIL_ALREADY_EXISTS",
                "该邮箱已经注册",
                HttpStatus.CONFLICT);
    }
}
