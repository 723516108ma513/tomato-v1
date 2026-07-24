package com.tomato.companion.server.room;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class RoomSocketRegistry implements RoomBroadcaster {
    private final ObjectMapper objectMapper;
    private final Map<String, Map<String, Client>> rooms = new ConcurrentHashMap<>();

    public RoomSocketRegistry(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void add(String roomId, String userId, WebSocketSession session) {
        rooms.computeIfAbsent(roomId, ignored -> new ConcurrentHashMap<>())
                .put(session.getId(), new Client(userId, session));
    }

    public void remove(String roomId, WebSocketSession session) {
        Map<String, Client> clients = rooms.get(roomId);
        if (clients == null) return;
        clients.remove(session.getId());
        if (clients.isEmpty()) rooms.remove(roomId);
    }

    public void sendState(WebSocketSession session, String roomId, RoomResponse state) {
        send(session, envelope("ROOM_STATE_SYNC", roomId, state));
    }

    public void sendPong(WebSocketSession session, String roomId) {
        send(session, envelope("PONG", roomId, Map.of("serverTime", Instant.now())));
    }

    @Override
    public void publish(String roomId, String eventType) {
        Map<String, Client> clients = rooms.get(roomId);
        if (clients == null) return;
        String payload = envelope(eventType, roomId, Map.of());
        clients.values().forEach(client -> send(client.session(), payload));
    }

    @Override
    public boolean isOnline(String roomId, String userId) {
        Map<String, Client> clients = rooms.get(roomId);
        return clients != null && clients.values().stream()
                .anyMatch(client -> client.userId().equals(userId) && client.session().isOpen());
    }

    private String envelope(String type, String roomId, Object data) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "type", type,
                    "eventId", UUID.randomUUID().toString(),
                    "roomId", roomId,
                    "data", data,
                    "timestamp", Instant.now()));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to serialize room event", exception);
        }
    }

    private void send(WebSocketSession session, String payload) {
        if (!session.isOpen()) return;
        try {
            synchronized (session) {
                session.sendMessage(new TextMessage(payload));
            }
        } catch (Exception ignored) {
            // The close callback removes stale sessions.
        }
    }

    private record Client(String userId, WebSocketSession session) {
    }
}
