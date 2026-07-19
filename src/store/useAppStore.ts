import { create } from "zustand";
import * as bridge from "../lib/bridge";
import type {
  AppSnapshot,
  CompanionProfile,
  ChatMessage,
  ImportLearningPlanInput,
  NewTaskInput,
  PageId,
  SaveProviderInput,
  SendChatInput,
  ProactiveSettings
} from "../types";

interface AppStore {
  page: PageId;
  snapshot: AppSnapshot;
  loading: boolean;
  error: string | null;
  proactiveMessage: ChatMessage | null;
  setPage: (page: PageId) => void;
  load: () => Promise<void>;
  addTask: (input: NewTaskInput) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  importPlan: (input: ImportLearningPlanInput) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  finishPomodoro: (input: bridge.CompletePomodoroInput) => Promise<void>;
  saveProvider: (input: SaveProviderInput) => Promise<void>;
  saveCompanion: (
    name: string,
    styleId: CompanionProfile["styleId"]
  ) => Promise<void>;
  saveProactiveSettings: (settings: ProactiveSettings) => Promise<void>;
  dismissProactiveMessage: () => void;
  sendChat: (input: SendChatInput) => Promise<void>;
  removeMemory: (memoryId: string) => Promise<void>;
  clearError: () => void;
}

const emptySnapshot: AppSnapshot = {
  projects: [],
  tasks: [],
  sessions: [],
  providers: [],
  companionProfile: {
    name: "小番",
    styleId: "gentle",
    updatedAt: new Date().toISOString()
  },
  proactiveSettings: {
    enabled: true,
    frequency: 2
  },
  messages: [],
  memories: []
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useAppStore = create<AppStore>((set, get) => ({
  page: "focus",
  snapshot: emptySnapshot,
  loading: true,
  error: null,
  proactiveMessage: null,
  setPage: (page) => set({ page }),
  clearError: () => set({ error: null }),
  dismissProactiveMessage: () => set({ proactiveMessage: null }),
  load: async () => {
    set({ loading: true, error: null });
    try {
      const snapshot = await bridge.loadSnapshot();
      set({ snapshot, loading: false });
    } catch (error) {
      set({ error: messageFrom(error), loading: false });
    }
  },
  addTask: async (input) => {
    try {
      const task = await bridge.createTask(input);
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          tasks: [task, ...state.snapshot.tasks]
        }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  createProject: async (name, description = "") => {
    try {
      await bridge.createProject(name, description);
      const snapshot = await bridge.loadSnapshot();
      set({ snapshot });
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  importPlan: async (input) => {
    try {
      await bridge.importLearningPlan(input);
      const snapshot = await bridge.loadSnapshot();
      set({ snapshot });
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  toggleTask: async (taskId) => {
    try {
      const task = await bridge.toggleTask(taskId);
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          tasks: state.snapshot.tasks.map((item) =>
            item.id === task.id ? task : item
          )
        }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  removeTask: async (taskId) => {
    try {
      await bridge.deleteTask(taskId);
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          tasks: state.snapshot.tasks.filter((task) => task.id !== taskId)
        }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  finishPomodoro: async (input) => {
    try {
      const session = await bridge.completePomodoro(input);
      const snapshot = await bridge.loadSnapshot();
      set({
        snapshot: {
          ...snapshot,
          sessions: snapshot.sessions.some((item) => item.id === session.id)
            ? snapshot.sessions
            : [session, ...snapshot.sessions]
        }
      });
      const provider = snapshot.providers[0];
      if (provider && snapshot.proactiveSettings.enabled) {
        void bridge
          .maybeGenerateCheckIn(provider.id)
          .then(async (message) => {
            if (!message) return;
            const refreshed = await bridge.loadSnapshot();
            set({ snapshot: refreshed, proactiveMessage: message });
          })
          .catch(() => {
            // 主动问候不应影响本地计时和番茄入罐。
          });
      }
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  saveProvider: async (input) => {
    try {
      await bridge.saveProvider(input);
      const snapshot = await bridge.loadSnapshot();
      set({ snapshot });
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  },
  saveCompanion: async (name, styleId) => {
    try {
      const companionProfile = await bridge.saveCompanionProfile(name, styleId);
      set((state) => ({
        snapshot: { ...state.snapshot, companionProfile }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  saveProactiveSettings: async (settings) => {
    try {
      const proactiveSettings = await bridge.saveProactiveSettings(settings);
      set((state) => ({
        snapshot: { ...state.snapshot, proactiveSettings }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  sendChat: async (input) => {
    try {
      const result = await bridge.sendChat(input);
      const snapshot = await bridge.loadSnapshot();
      set({
        snapshot: {
          ...snapshot,
          messages: snapshot.messages.length
            ? snapshot.messages
            : [result.userMessage, result.assistantMessage]
        }
      });
    } catch (error) {
      set({ error: messageFrom(error) });
      throw error;
    }
  },
  removeMemory: async (memoryId) => {
    try {
      await bridge.deleteMemory(memoryId);
      set((state) => ({
        snapshot: {
          ...state.snapshot,
          memories: state.snapshot.memories.filter(
            (memory) => memory.id !== memoryId
          )
        }
      }));
    } catch (error) {
      set({ error: messageFrom(error) });
    }
  }
}));
