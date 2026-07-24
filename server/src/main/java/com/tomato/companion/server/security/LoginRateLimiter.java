package com.tomato.companion.server.security;

import com.tomato.companion.server.config.SecurityProperties;
import com.tomato.companion.server.exception.ApiException;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class LoginRateLimiter {
    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);
    private final StringRedisTemplate redis;
    private final SecurityProperties properties;

    public LoginRateLimiter(
            StringRedisTemplate redis,
            SecurityProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    public void check(String normalizedEmail, String remoteAddress) {
        String safeIp = remoteAddress == null ? "unknown" : remoteAddress.replaceAll("[^0-9A-Fa-f:.]", "");
        String key = "rate:login:" + safeIp + ":" + Integer.toHexString(normalizedEmail.hashCode());
        try {
            Long attempts = redis.opsForValue().increment(key);
            if (attempts != null && attempts == 1) {
                redis.expire(key, Duration.ofMinutes(1));
            }
            if (attempts != null && attempts > properties.loginRateLimit()) {
                throw new ApiException(
                        "RATE_LIMITED",
                        "登录尝试过于频繁，请稍后重试",
                        HttpStatus.TOO_MANY_REQUESTS);
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            if (!properties.rateLimitFailOpen()) {
                throw new ApiException(
                        "RATE_LIMIT_UNAVAILABLE",
                        "安全服务暂时不可用",
                        HttpStatus.SERVICE_UNAVAILABLE);
            }
            log.warn("Redis unavailable; login limiter is fail-open in this environment");
        }
    }
}
