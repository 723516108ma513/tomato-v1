import { describe, expect, it } from "vitest";
import {
  createTimerState,
  elapsedSeconds,
  formatClock,
  getRemainingSeconds,
  pauseTimer,
  startTimer
} from "./timer";

describe("timer domain", () => {
  it("derives remaining time from a wall-clock target", () => {
    const timer = startTimer(createTimerState("focus", 1500), 1_000);
    expect(getRemainingSeconds(timer, 61_000)).toBe(1440);
  });

  it("freezes the remaining time when paused", () => {
    const timer = startTimer(createTimerState("focus", 60), 10_000);
    const paused = pauseTimer(timer, 25_000);
    expect(paused.status).toBe("paused");
    expect(paused.remainingSeconds).toBe(45);
    expect(getRemainingSeconds(paused, 100_000)).toBe(45);
  });

  it("never reports negative time and formats a stable clock", () => {
    const timer = startTimer(createTimerState("focus", 10), 0);
    expect(getRemainingSeconds(timer, 20_000)).toBe(0);
    expect(elapsedSeconds(timer, 20_000)).toBe(10);
    expect(formatClock(65)).toBe("01:05");
  });
});
