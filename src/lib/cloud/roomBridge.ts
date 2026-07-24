import { invoke } from "@tauri-apps/api/core";
import type { StudyRoom, StudySession } from "./roomTypes";

export function createRoom(input: {
  teamId: string;
  name: string;
  focusSeconds: number;
}) {
  return invoke<StudyRoom>("cloud_create_room", input);
}

export function getActiveRoom(teamId: string) {
  return invoke<StudyRoom | null>("cloud_get_active_room", { teamId });
}

export function getRoom(roomId: string) {
  return invoke<StudyRoom>("cloud_get_room", { roomId });
}

export function joinRoom(roomId: string) {
  return invoke<StudyRoom>("cloud_join_room", { roomId });
}

export function setRoomReady(roomId: string, ready: boolean) {
  return invoke<StudyRoom>("cloud_set_room_ready", { roomId, ready });
}

export function startRoom(roomId: string) {
  return invoke<StudyRoom>("cloud_start_room", { roomId });
}

export function leaveRoom(roomId: string) {
  return invoke<void>("cloud_leave_room", { roomId });
}

export function cancelRoom(roomId: string) {
  return invoke<void>("cloud_cancel_room", { roomId });
}

export function roomHistory(roomId: string) {
  return invoke<StudySession[]>("cloud_room_history", { roomId });
}

export function connectRoomSocket(roomId: string) {
  return invoke<void>("cloud_connect_room_socket", { roomId });
}

export function disconnectRoomSocket() {
  return invoke<void>("cloud_disconnect_room_socket");
}

export function recordRemotePomodoro(session: StudySession, roomName: string) {
  return invoke("record_remote_pomodoro", {
    input: {
      remoteSessionId: session.id,
      startedAt: session.startTime,
      endedAt: session.endTime,
      durationSeconds: session.durationSeconds,
      note: `组队学习 · ${roomName}`
    }
  });
}
