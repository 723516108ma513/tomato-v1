export type RoomStatus = "WAITING" | "FOCUS" | "CLOSED";
export type ConnectionState = "disconnected" | "connected" | "reconnecting" | "auth-expired";

export interface RoomMember {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  ready: boolean;
  host: boolean;
  online: boolean;
  joinedAt: string;
}

export interface StudySession {
  id: string;
  roomId: string;
  status: "RUNNING" | "FINISHED" | "CANCELLED";
  startTime: string;
  endTime: string;
  durationSeconds: number;
  finishedAt: string | null;
}

export interface StudyRoom {
  id: string;
  teamId: string;
  hostUserId: string;
  name: string;
  focusSeconds: number;
  status: RoomStatus;
  members: RoomMember[];
  currentSession: StudySession | null;
  currentUserIsHost: boolean;
  serverTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomEvent {
  type: string;
  eventId: string;
  roomId: string;
  data: unknown;
  timestamp: string;
}
