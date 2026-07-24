import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { create } from "zustand";
import {
  isDesktopRuntime,
  loginAccount,
  logoutAccount,
  registerAccount,
  restoreCloudSession,
  updateCloudProfile
} from "../lib/cloud/authBridge";
import type {
  AuthDialogMode,
  AuthStatus,
  CloudSession,
  CloudUser
} from "../lib/cloud/cloudTypes";

interface AuthStore {
  status: AuthStatus;
  initialized: boolean;
  currentUser: CloudUser | null;
  error: string | null;
  dialogOpen: boolean;
  dialogMode: AuthDialogMode;
  initialize: () => Promise<void>;
  openDialog: (mode: AuthDialogMode) => void;
  closeDialog: () => void;
  clearError: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    nickname: string
  ) => Promise<boolean>;
  updateProfile: (
    nickname: string,
    avatarUrl: string | null
  ) => Promise<boolean>;
  logout: () => Promise<void>;
}

let authExpiredListener: Promise<UnlistenFn> | null = null;

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function authenticatedState(session: CloudSession) {
  return {
    status: "authenticated" as const,
    initialized: true,
    currentUser: session.user,
    error: null,
    dialogOpen: false
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: "idle",
  initialized: false,
  currentUser: null,
  error: null,
  dialogOpen: false,
  dialogMode: "login",

  initialize: async () => {
    if (get().status !== "idle") return;
    if (!isDesktopRuntime()) {
      set({ status: "guest", initialized: true });
      return;
    }

    set({ status: "restoring", error: null });
    if (!authExpiredListener) {
      authExpiredListener = listen("cloud://auth-expired", () => {
        set({
          status: "guest",
          currentUser: null,
          error: "登录已过期，请重新登录",
          dialogOpen: true,
          dialogMode: "login"
        });
      });
    }

    try {
      const session = await restoreCloudSession();
      set(
        session
          ? authenticatedState(session)
          : {
              status: "guest",
              initialized: true,
              currentUser: null,
              error: null
            }
      );
    } catch {
      set({
        status: "guest",
        initialized: true,
        currentUser: null,
        error: null
      });
    }
  },

  openDialog: (dialogMode) =>
    set({ dialogOpen: true, dialogMode, error: null }),
  closeDialog: () => set({ dialogOpen: false, error: null }),
  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ status: "authenticating", error: null });
    try {
      const session = await loginAccount({ email: email.trim(), password });
      set(authenticatedState(session));
      return true;
    } catch (error) {
      set({ status: "guest", error: messageFrom(error) });
      return false;
    }
  },

  register: async (email, password, nickname) => {
    set({ status: "authenticating", error: null });
    try {
      const session = await registerAccount({
        email: email.trim(),
        password,
        nickname: nickname.trim()
      });
      set(authenticatedState(session));
      return true;
    } catch (error) {
      set({ status: "guest", error: messageFrom(error) });
      return false;
    }
  },

  updateProfile: async (nickname, avatarUrl) => {
    set({ error: null });
    try {
      const currentUser = await updateCloudProfile({ nickname, avatarUrl });
      set({ currentUser });
      return true;
    } catch (error) {
      set({ error: messageFrom(error) });
      return false;
    }
  },

  logout: async () => {
    try {
      await logoutAccount();
    } finally {
      set({
        status: "guest",
        currentUser: null,
        error: null,
        dialogOpen: false
      });
    }
  }
}));
