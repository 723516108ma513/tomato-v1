export type PageId =
  | "focus"
  | "tasks"
  | "jar"
  | "companion"
  | "insights"
  | "teams"
  | "rooms"
  | "settings";

export type TaskStatus = "todo" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedPomodoros: number;
  completedPomodoros: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  plannedSeconds: number;
  actualSeconds: number;
  note: string | null;
  completed: boolean;
  source?: "local" | "remote";
  remoteSessionId?: string | null;
}

export type ProviderType =
  | "openai-compatible"
  | "anthropic"
  | "gemini"
  | "ollama";

export interface ProviderConfig {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  defaultModel: string;
  createdAt: string;
  updatedAt: string;
  hasSecret?: boolean;
}

export interface ProviderCatalogItem {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  description: string;
}

export type CompanionStyleId =
  | "gentle"
  | "coach"
  | "rational"
  | "energetic";

export interface CompanionStyle {
  id: CompanionStyleId;
  name: string;
  description: string;
}

export interface CompanionProfile {
  name: string;
  styleId: CompanionStyleId;
  updatedAt: string;
}

export interface ProactiveSettings {
  enabled: boolean;
  frequency: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
}

export interface MemoryItem {
  id: string;
  kind: "preference" | "goal" | "study_pattern" | "background";
  content: string;
  importance: number;
  confidence: number;
  updatedAt: string;
}

export interface AppSnapshot {
  projects: Project[];
  tasks: Task[];
  sessions: PomodoroSession[];
  providers: ProviderConfig[];
  companionProfile: CompanionProfile;
  proactiveSettings: ProactiveSettings;
  messages: ChatMessage[];
  memories: MemoryItem[];
}

export type TimerPhase = "focus" | "shortBreak" | "longBreak";
export type TimerStatus = "idle" | "running" | "paused";

export interface TimerState {
  phase: TimerPhase;
  status: TimerStatus;
  durationSeconds: number;
  remainingSeconds: number;
  taskId: string | null;
  startedAt: number | null;
  targetAt: number | null;
}

export interface NewTaskInput {
  projectId?: string | null;
  title: string;
  priority: TaskPriority;
  estimatedPomodoros: number;
}

export interface LearningPlanTask {
  title: string;
  detail: string;
  estimatedPomodoros: number;
  priority: TaskPriority;
}

export interface LearningPlanDraft {
  projectName: string;
  summary: string;
  tasks: LearningPlanTask[];
}

export interface ImportLearningPlanInput {
  projectId?: string | null;
  newProjectName?: string | null;
  projectDescription?: string | null;
  tasks: Array<{
    title: string;
    estimatedPomodoros: number;
    priority: TaskPriority;
  }>;
}

export interface SaveProviderInput {
  id?: string;
  name: string;
  catalogId: string;
  apiKey?: string;
  customBaseUrl?: string;
  customModel?: string;
}

export interface SendChatInput {
  providerId: string;
  conversationId?: string;
  content: string;
}

export interface SendChatResult {
  conversationId: string;
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  memoryCompacted: boolean;
}
