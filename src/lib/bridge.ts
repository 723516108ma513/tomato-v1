import { invoke } from "@tauri-apps/api/core";
import type {
  AppSnapshot,
  ChatMessage,
  CompanionProfile,
  CompanionStyle,
  ImportLearningPlanInput,
  LearningPlanDraft,
  NewTaskInput,
  PomodoroSession,
  Project,
  ProactiveSettings,
  ProviderCatalogItem,
  ProviderConfig,
  SaveProviderInput,
  SendChatInput,
  SendChatResult,
  Task,
  TimerState
} from "../types";

const SNAPSHOT_KEY = "tomato-companion.snapshot.v1";
const TIMER_KEY = "tomato-companion.timer.v1";

const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

const seedSnapshot: AppSnapshot = {
  projects: [],
  tasks: [
    {
      id: "welcome-deep-work",
      projectId: null,
      title: "完成第一颗专注番茄",
      status: "todo",
      priority: "high",
      estimatedPomodoros: 1,
      completedPomodoros: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    {
      id: "welcome-plan",
      projectId: null,
      title: "和伙伴梳理本周学习目标",
      status: "todo",
      priority: "medium",
      estimatedPomodoros: 2,
      completedPomodoros: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ],
  sessions: [],
  providers: [],
  companionProfile: {
    name: "小番",
    styleId: "gentle",
    updatedAt: nowIso()
  },
  proactiveSettings: {
    enabled: true,
    frequency: 2
  },
  messages: [],
  memories: []
};

const fallbackCatalog: ProviderCatalogItem[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    providerType: "openai-compatible",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    requiresKey: true,
    description: "适合中文学习、推理与知识拆解"
  },
  {
    id: "openai",
    name: "OpenAI",
    providerType: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5-mini",
    requiresKey: true,
    description: "通用能力均衡，适合学习规划和讲解"
  },
  {
    id: "qwen",
    name: "通义千问",
    providerType: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus",
    requiresKey: true,
    description: "中文体验良好，使用阿里云百炼密钥"
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    providerType: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-5",
    requiresKey: true,
    description: "擅长长文本理解与耐心讲解"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    providerType: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.5-flash",
    requiresKey: true,
    description: "响应快速，支持 Google Gemini API Key"
  },
  {
    id: "ollama",
    name: "Ollama 本地模型",
    providerType: "ollama",
    baseUrl: "http://127.0.0.1:11434",
    defaultModel: "qwen2.5:7b",
    requiresKey: false,
    description: "完全在本机运行，需要先安装并启动 Ollama"
  }
];

export const fallbackStyles: CompanionStyle[] = [
  { id: "gentle", name: "温柔陪伴", description: "耐心、接纳，帮助你降低开始的压力" },
  { id: "coach", name: "行动教练", description: "清晰直接，把目标快速变成下一步行动" },
  { id: "rational", name: "理性导师", description: "结构严谨，重视原理、证据与复盘" },
  { id: "energetic", name: "元气同伴", description: "积极有活力，及时庆祝真实的小进展" }
];

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function readFallback(): AppSnapshot {
  try {
    const value = localStorage.getItem(SNAPSHOT_KEY);
    if (!value) return seedSnapshot;
    const parsed = JSON.parse(value) as Partial<AppSnapshot>;
    return {
      ...seedSnapshot,
      ...parsed,
      tasks: (parsed.tasks ?? seedSnapshot.tasks).map((task) => ({
        ...task,
        projectId: task.projectId ?? null
      })),
      projects: parsed.projects ?? [],
      sessions: parsed.sessions ?? [],
      providers: parsed.providers ?? [],
      messages: parsed.messages ?? [],
      memories: parsed.memories ?? [],
      companionProfile: parsed.companionProfile ?? seedSnapshot.companionProfile
    };
  } catch {
    return seedSnapshot;
  }
}

function writeFallback(snapshot: AppSnapshot): AppSnapshot {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (isTauriRuntime()) {
    return invoke<AppSnapshot>("load_snapshot");
  }
  const snapshot = readFallback();
  writeFallback(snapshot);
  return snapshot;
}

export async function createTask(input: NewTaskInput): Promise<Task> {
  if (isTauriRuntime()) {
    return invoke<Task>("create_task", { input });
  }
  const snapshot = readFallback();
  const stamp = nowIso();
  const task: Task = {
    id: newId(),
    projectId: input.projectId ?? null,
    title: input.title.trim(),
    status: "todo",
    priority: input.priority,
    estimatedPomodoros: input.estimatedPomodoros,
    completedPomodoros: 0,
    createdAt: stamp,
    updatedAt: stamp
  };
  writeFallback({ ...snapshot, tasks: [task, ...snapshot.tasks] });
  return task;
}

export async function createProject(
  name: string,
  description = ""
): Promise<Project> {
  if (isTauriRuntime()) {
    return invoke<Project>("create_project", {
      input: { name, description }
    });
  }
  const snapshot = readFallback();
  const stamp = nowIso();
  const project: Project = {
    id: newId(),
    name: name.trim(),
    description: description.trim(),
    createdAt: stamp,
    updatedAt: stamp
  };
  writeFallback({ ...snapshot, projects: [project, ...snapshot.projects] });
  return project;
}

export async function generateLearningPlan(
  providerId: string,
  goal: string
): Promise<LearningPlanDraft> {
  if (!isTauriRuntime()) {
    throw new Error("AI 任务拆解只在 Windows 桌面程序中启用");
  }
  return invoke<LearningPlanDraft>("generate_learning_plan", {
    input: { providerId, goal }
  });
}

export async function importLearningPlan(
  input: ImportLearningPlanInput
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("import_learning_plan", { input });
    return;
  }
  const snapshot = readFallback();
  const stamp = nowIso();
  let projects = snapshot.projects;
  let projectId = input.projectId ?? null;
  if (input.newProjectName?.trim()) {
    const project: Project = {
      id: newId(),
      name: input.newProjectName.trim(),
      description: input.projectDescription?.trim() ?? "",
      createdAt: stamp,
      updatedAt: stamp
    };
    projects = [project, ...projects];
    projectId = project.id;
  }
  const tasks: Task[] = input.tasks.map((item) => ({
    id: newId(),
    projectId,
    title: item.title.trim(),
    status: "todo",
    priority: item.priority,
    estimatedPomodoros: item.estimatedPomodoros,
    completedPomodoros: 0,
    createdAt: stamp,
    updatedAt: stamp
  }));
  writeFallback({
    ...snapshot,
    projects,
    tasks: [...tasks, ...snapshot.tasks]
  });
}

export async function toggleTask(taskId: string): Promise<Task> {
  if (isTauriRuntime()) {
    return invoke<Task>("toggle_task", { taskId });
  }
  const snapshot = readFallback();
  let changed: Task | undefined;
  const tasks = snapshot.tasks.map((task) => {
    if (task.id !== taskId) return task;
    changed = {
      ...task,
      status: task.status === "done" ? "todo" : "done",
      updatedAt: nowIso()
    };
    return changed;
  });
  if (!changed) throw new Error("没有找到这个任务");
  writeFallback({ ...snapshot, tasks });
  return changed;
}

export async function deleteTask(taskId: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_task", { taskId });
    return;
  }
  const snapshot = readFallback();
  writeFallback({
    ...snapshot,
    tasks: snapshot.tasks.filter((task) => task.id !== taskId)
  });
}

export interface CompletePomodoroInput {
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  actualSeconds: number;
  note?: string;
}

export async function completePomodoro(
  input: CompletePomodoroInput
): Promise<PomodoroSession> {
  if (isTauriRuntime()) {
    return invoke<PomodoroSession>("complete_pomodoro", { input });
  }
  const snapshot = readFallback();
  const session: PomodoroSession = {
    id: newId(),
    taskId: input.taskId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    plannedSeconds: input.plannedSeconds,
    actualSeconds: input.actualSeconds,
    note: input.note ?? null,
    completed: true,
    source: "local",
    remoteSessionId: null
  };
  const tasks = snapshot.tasks.map((task) =>
    task.id === input.taskId
      ? {
          ...task,
          completedPomodoros: task.completedPomodoros + 1,
          updatedAt: nowIso()
        }
      : task
  );
  writeFallback({
    ...snapshot,
    tasks,
    sessions: [session, ...snapshot.sessions]
  });
  return session;
}

export async function saveProvider(
  input: SaveProviderInput
): Promise<ProviderConfig> {
  if (isTauriRuntime()) {
    const provider = await invoke<ProviderConfig>("save_provider_config", {
      input: {
        id: input.id ?? null,
        name: input.name,
        catalogId: input.catalogId,
        customBaseUrl: input.customBaseUrl ?? null,
        customModel: input.customModel ?? null
      }
    });
    if (input.apiKey?.trim()) {
      await invoke("save_provider_secret", {
        providerId: provider.id,
        secret: input.apiKey.trim()
      });
      provider.hasSecret = true;
    }
    return provider;
  }

  const snapshot = readFallback();
  const stamp = nowIso();
  const catalog = fallbackCatalog.find((item) => item.id === input.catalogId);
  if (!catalog) throw new Error("不支持这个模型服务商");
  const existing = input.id
    ? snapshot.providers.find((provider) => provider.id === input.id)
    : undefined;
  const provider: ProviderConfig = {
    id: existing?.id ?? newId(),
    name: input.name.trim(),
    providerType: catalog.providerType,
    baseUrl: input.customBaseUrl?.trim() || catalog.baseUrl,
    defaultModel: input.customModel?.trim() || catalog.defaultModel,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
    hasSecret: false
  };
  writeFallback({
    ...snapshot,
    providers: [
      provider,
      ...snapshot.providers.filter((item) => item.id !== provider.id)
    ]
  });
  return provider;
}

export async function loadProviderCatalog(): Promise<ProviderCatalogItem[]> {
  return isTauriRuntime()
    ? invoke<ProviderCatalogItem[]>("provider_catalog")
    : fallbackCatalog;
}

export async function loadCompanionStyles(): Promise<CompanionStyle[]> {
  return isTauriRuntime()
    ? invoke<CompanionStyle[]>("companion_styles")
    : fallbackStyles;
}

export async function saveCompanionProfile(
  name: string,
  styleId: CompanionProfile["styleId"]
): Promise<CompanionProfile> {
  if (isTauriRuntime()) {
    return invoke<CompanionProfile>("save_companion_profile", {
      input: { name, styleId }
    });
  }
  const snapshot = readFallback();
  const profile = { name: name.trim(), styleId, updatedAt: nowIso() };
  writeFallback({ ...snapshot, companionProfile: profile });
  return profile;
}

export async function saveProactiveSettings(
  settings: ProactiveSettings
): Promise<ProactiveSettings> {
  if (isTauriRuntime()) {
    return invoke<ProactiveSettings>("save_proactive_settings", { settings });
  }
  const snapshot = readFallback();
  const saved = {
    enabled: settings.enabled,
    frequency: Math.min(6, Math.max(1, settings.frequency))
  };
  writeFallback({ ...snapshot, proactiveSettings: saved });
  return saved;
}

export async function maybeGenerateCheckIn(
  providerId: string
): Promise<ChatMessage | null> {
  if (!isTauriRuntime()) return null;
  return invoke<ChatMessage | null>("maybe_generate_check_in", { providerId });
}

export async function testProviderConnection(providerId: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error("连接测试只在 Windows 桌面程序中启用");
  }
  return invoke<string>("test_provider_connection", { providerId });
}

export async function sendChat(input: SendChatInput): Promise<SendChatResult> {
  if (!isTauriRuntime()) {
    throw new Error("AI 对话只在 Windows 桌面程序中启用");
  }
  return invoke<SendChatResult>("send_chat", { input });
}

export async function deleteMemory(memoryId: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("delete_memory", { memoryId });
    return;
  }
  const snapshot = readFallback();
  writeFallback({
    ...snapshot,
    memories: snapshot.memories.filter((memory) => memory.id !== memoryId)
  });
}

export async function saveTimerState(state: TimerState): Promise<void> {
  localStorage.setItem(TIMER_KEY, JSON.stringify(state));
  if (isTauriRuntime()) {
    await invoke("save_timer_state", { state });
  }
}

export async function loadTimerState(): Promise<TimerState | null> {
  if (isTauriRuntime()) {
    const native = await invoke<TimerState | null>("load_timer_state");
    if (native) return native;
  }
  try {
    const value = localStorage.getItem(TIMER_KEY);
    return value ? (JSON.parse(value) as TimerState) : null;
  } catch {
    return null;
  }
}
