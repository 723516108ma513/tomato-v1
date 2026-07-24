package com.tomato.companion.server.room;

import com.tomato.companion.server.security.JwtService;
import io.jsonwebtoken.JwtException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

@Component
public class RoomHandshakeInterceptor implements HandshakeInterceptor {
    private final JwtService jwt;
    private final StudyRoomRepository rooms;
    private final RoomMemberRepository members;

    public RoomHandshakeInterceptor(
            JwtService jwt,
            StudyRoomRepository rooms,
            RoomMemberRepository members) {
        this.jwt = jwt;
        this.rooms = rooms;
        this.members = members;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Map<String, Object> attributes) {
        try {
            String authorization = request.getHeaders().getFirst("Authorization");
            if (authorization == null || !authorization.startsWith("Bearer ")) {
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }
            String userId = jwt.parse(authorization.substring(7)).getSubject();
            String path = request.getURI().getPath();
            String roomId = path.substring(path.lastIndexOf('/') + 1);
            StudyRoom room = rooms.findById(roomId).orElse(null);
            boolean joined = members.findFirstByRoomIdAndUserIdOrderByJoinedAtDesc(roomId, userId)
                    .filter(RoomMember::isActive)
                    .isPresent();
            if (room == null || "CLOSED".equals(room.getStatus()) || !joined) {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                return false;
            }
            attributes.put("userId", userId);
            attributes.put("roomId", roomId);
            return true;
        } catch (JwtException | IllegalArgumentException exception) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler handler,
            Exception exception) {
    }
}
