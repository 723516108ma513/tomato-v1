import type { TimerPhase, TimerState } from "../types";

export const PHASE_SECONDS: Record<TimerPhase, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

export function createTimerState(
  phase: TimerPhase = "focus",
  durationSeconds = PHASE_SECONDS[phase]
): TimerState {
  return {
    phase,
    status: "idle",
    durationSeconds,
    remainingSeconds: durationSeconds,
    taskId: null,
    startedAt: null,
    targetAt: null
  };
}

export function getRemainingSeconds(state: TimerState, now = Date.now()): number {
  if (state.status !== "running" || state.targetAt === null) {
    return Math.max(0, state.remainingSeconds);
  }
  return Math.max(0, Math.ceil((state.targetAt - now) / 1000));
}

export function startTimer(state: TimerState, now = Date.now()): TimerState {
  const remainingSeconds = getRemainingSeconds(state, now);
  return {
    ...state,
    status: "running",
    remainingSeconds,
    startedAt: state.startedAt ?? now,
    targetAt: now + remainingSeconds * 1000
  };
}

export function pauseTimer(state: TimerState, now = Date.now()): TimerState {
  return {
    ...state,
    status: "paused",
    remainingSeconds: getRemainingSeconds(state, now),
    targetAt: null
  };
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    status: "idle",
    remainingSeconds: state.durationSeconds,
    startedAt: null,
    targetAt: null
  };
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function elapsedSeconds(state: TimerState, now = Date.now()): number {
  return Math.max(
    0,
    Math.min(
      state.durationSeconds,
      state.durationSeconds - getRemainingSeconds(state, now)
    )
  );
}
