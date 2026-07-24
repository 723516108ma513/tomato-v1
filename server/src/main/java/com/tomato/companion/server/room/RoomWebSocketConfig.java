package com.tomato.companion.server.room;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RoomWebSocketConfig implements WebSocketConfigurer {
    private final RoomWebSocketHandler handler;
    private final RoomHandshakeInterceptor handshake;

    public RoomWebSocketConfig(RoomWebSocketHandler handler, RoomHandshakeInterceptor handshake) {
        this.handler = handler;
        this.handshake = handshake;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/ws/v1/rooms/{roomId}")
                .addInterceptors(handshake)
                .setAllowedOrigins(
                        "tauri://localhost",
                        "https://tauri.localhost",
                        "http://tauri.localhost");
    }
}
