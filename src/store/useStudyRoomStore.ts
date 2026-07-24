import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";
import {
  cancelRoom,
  connectRoomSocket,
  createRoom,
  disconnectRoomSocket,
  getActiveRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  setRoomReady,
  startRoom,
  roomHistory,
  recordRemotePomodoro
} from "../lib/cloud/roomBridge";
import type {
  ConnectionState,
  RoomEvent,
  StudyRoom
} from "../lib/cloud/roomTypes";
import { useAuthStore } from "./useAuthStore";
import { useAppStore } from "./useAppStore";

interface StudyRoomStore {
  room: StudyRoom | null;
  teamId: string | null;
  connection: ConnectionState;
  loading: boolean;
  saving: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  loadActive: (teamId: string) => Promise<void>;
  refresh: () => Promise<void>;
  create: (teamId: string, name: string, focusSeconds: number) => Promise<boolean>;
  join: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  start: () => Promise<void>;
  leave: () => Promise<void>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
}

let listeners: Promise<UnlistenFn[]> | null = null;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export const useStudyRoomStore = create<StudyRoomStore>((set, get) => ({
  room: null,
  teamId: null,
  connection: "disconnected",
  loading: false,
  saving: false,
  error: null,

  initialize: async () => {
    if (listeners) return;
    listeners = Promise.all([
      listen<RoomEvent>("cloud://room-event", (event) => {
        const payload = event.payload;
        if (payload.type === "ROOM_STATE_SYNC" && payload.data) {
          set({ room: payload.data as StudyRoom, error: null });
          void syncFinishedSession(payload.roomId);
        } else if (payload.type !== "PONG") {
          void get().refresh();
        }
        if (payload.type === "ROOM_SESSION_FINISHED") {
          void syncFinishedSession(payload.roomId);
        }
      }),
      listen<ConnectionState>("cloud://connection-state", (event) => {
        set({ connection: event.payload });
      })
    ]);
    await listeners;
  },

  loadActive: async (teamId) => {
    set({ teamId, loading: true, error: null });
    try {
      const room = await getActiveRoom(teamId);
      set({ room, loading: false });
      if (room) {
        const currentUserId = useAuthStore.getState().currentUser?.id;
        const joined = room.members.some((member) => member.userId === currentUserId);
        if (joined) await connectRoomSocket(room.id);
      }
    } catch (error) {
      set({ loading: false, error: message(error) });
    }
  },

  refresh: async () => {
    const current = get().room;
    if (!current) return;
    try {
      set({ room: await getRoom(current.id) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  create: async (teamId, name, focusSeconds) => {
    set({ saving: true, error: null });
    try {
      const room = await createRoom({ teamId, name, focusSeconds });
      set({ room, teamId, saving: false });
      await connectRoomSocket(room.id);
      return true;
    } catch (error) {
      set({ saving: false, error: message(error) });
      return false;
    }
  },

  join: async () => {
    const current = get().room;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      const room = await joinRoom(current.id);
      set({ room, saving: false });
      await connectRoomSocket(room.id);
    } catch (error) {
      set({ saving: false, error: message(error) });
    }
  },

  setReady: async (ready) => {
    const current = get().room;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      set({ room: await setRoomReady(current.id, ready), saving: false });
    } catch (error) {
      set({ saving: false, error: message(error) });
    }
  },

  start: async () => {
    const current = get().room;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      set({ room: await startRoom(current.id), saving: false });
    } catch (error) {
      set({ saving: false, error: message(error) });
    }
  },

  leave: async () => {
    const current = get().room;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      await leaveRoom(current.id);
      set({ room: null, saving: false, connection: "disconnected" });
    } catch (error) {
      set({ saving: false, error: message(error) });
    }
  },

  cancel: async () => {
    const current = get().room;
    if (!current) return;
    set({ saving: true, error: null });
    try {
      await cancelRoom(current.id);
      set({ room: null, saving: false, connection: "disconnected" });
    } catch (error) {
      set({ saving: false, error: message(error) });
    }
  },

  reset: async () => {
    await disconnectRoomSocket().catch(() => undefined);
    set({
      room: null,
      teamId: null,
      connection: "disconnected",
      error: null
    });
  }
}));

async function syncFinishedSession(roomId: string) {
  try {
    const [history, currentRoom] = await Promise.all([
      roomHistory(roomId),
      getRoom(roomId)
    ]);
    const latest = history.find((session) => session.status === "FINISHED");
    if (!latest) return;
    await recordRemotePomodoro(latest, currentRoom.name);
    await useAppStore.getState().load();
  } catch {
    // WebSocket may redeliver the event; the unique remote id makes later retries safe.
  }
}
