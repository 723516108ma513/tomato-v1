package com.tomato.companion.server.room;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class RoomWebSocketHandler extends TextWebSocketHandler {
    private final RoomSocketRegistry registry;
    private final RoomService rooms;

    public RoomWebSocketHandler(RoomSocketRegistry registry, RoomService rooms) {
        this.registry = registry;
        this.rooms = rooms;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String roomId = attribute(session, "roomId");
        String userId = attribute(session, "userId");
        registry.add(roomId, userId, session);
        registry.sendState(session, roomId, rooms.detail(userId, roomId));
        registry.publish(roomId, "ROOM_MEMBER_ONLINE");
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String roomId = attribute(session, "roomId");
        if (message.getPayload().contains("\"PING\"")) {
            registry.sendPong(session, roomId);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String roomId = attribute(session, "roomId");
        registry.remove(roomId, session);
        registry.publish(roomId, "ROOM_MEMBER_OFFLINE");
    }

    private String attribute(WebSocketSession session, String name) {
        return String.valueOf(session.getAttributes().get(name));
    }
}
