package com.tomato.companion.server.common;

import java.time.Instant;

public record ApiResponse<T>(
        boolean success,
        T data,
        String code,
        String message,
        Instant timestamp) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null, null, Instant.now());
    }

    public static ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(false, null, code, message, Instant.now());
    }
}
