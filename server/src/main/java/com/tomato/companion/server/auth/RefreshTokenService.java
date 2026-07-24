package com.tomato.companion.server.auth;

import com.tomato.companion.server.config.AuthProperties;
import com.tomato.companion.server.exception.ApiException;
import com.tomato.companion.server.user.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final RefreshTokenRepository repository;
    private final AuthProperties properties;

    public RefreshTokenService(
            RefreshTokenRepository repository,
            AuthProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    public IssuedRefreshToken create(User user, String deviceName, Instant now) {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken entity = new RefreshToken(
                UUID.randomUUID().toString(),
                user,
                hash(rawToken),
                now.plusSeconds(properties.refreshTokenTtlSeconds()),
                sanitizeDeviceName(deviceName),
                now);
        repository.save(entity);
        return new IssuedRefreshToken(rawToken, entity);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public RotatedRefreshToken rotate(String rawToken, String deviceName, Instant now) {
        RefreshToken current = repository.findByTokenHash(hash(rawToken))
                .orElseThrow(() -> invalidRefreshToken("Refresh Token 无效"));
        if (current.getRevokedAt() != null) {
            if (current.getReplacedByTokenId() != null) {
                revokeAll(current.getUser().getId(), now);
                throw new ApiException(
                        "REFRESH_TOKEN_REUSED",
                        "检测到已轮换凭证被重复使用，请重新登录",
                        HttpStatus.UNAUTHORIZED);
            }
            throw invalidRefreshToken("Refresh Token 已撤销");
        }
        if (!current.getExpiresAt().isAfter(now)) {
            current.revoke(now);
            throw invalidRefreshToken("Refresh Token 已过期");
        }
        IssuedRefreshToken replacement = create(current.getUser(), deviceName, now);
        current.rotateTo(replacement.entity().getId(), now);
        repository.save(current);
        return new RotatedRefreshToken(current.getUser(), replacement.rawToken());
    }

    @Transactional
    public void revokeForUser(String userId, String rawToken, Instant now) {
        repository.findByTokenHash(hash(rawToken))
                .filter(token -> token.getUser().getId().equals(userId))
                .ifPresent(token -> {
                    token.revoke(now);
                    repository.save(token);
                });
    }

    private void revokeAll(String userId, Instant now) {
        repository.findAllByUserIdAndRevokedAtIsNull(userId).forEach(token -> {
            token.revoke(now);
            repository.save(token);
        });
    }

    private static ApiException invalidRefreshToken(String message) {
        return new ApiException(
                "INVALID_REFRESH_TOKEN",
                message,
                HttpStatus.UNAUTHORIZED);
    }

    private static String hash(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(
                    digest.digest(rawToken.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String sanitizeDeviceName(String deviceName) {
        if (deviceName == null || deviceName.isBlank()) {
            return "Tomato Companion Desktop";
        }
        String trimmed = deviceName.trim();
        return trimmed.length() <= 120 ? trimmed : trimmed.substring(0, 120);
    }

    public record IssuedRefreshToken(String rawToken, RefreshToken entity) {
    }

    public record RotatedRefreshToken(User user, String rawToken) {
    }
}
