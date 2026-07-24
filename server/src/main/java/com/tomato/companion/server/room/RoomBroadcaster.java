package com.tomato.companion.server.room;

public interface RoomBroadcaster {
    void publish(String roomId, String eventType);

    boolean isOnline(String roomId, String userId);
}
