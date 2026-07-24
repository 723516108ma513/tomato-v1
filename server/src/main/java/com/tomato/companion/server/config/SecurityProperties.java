package com.tomato.companion.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(
        int loginRateLimit,
        int inviteRateLimit,
        boolean rateLimitFailOpen) {
}
