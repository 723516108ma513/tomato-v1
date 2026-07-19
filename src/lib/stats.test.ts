import { describe, expect, it } from "vitest";
import type { PomodoroSession } from "../types";
import { sessionsInPeriod, summarizePeriod } from "./stats";

const session = (endedAt: string, seconds = 1500): PomodoroSession => ({
  id: endedAt,
  taskId: null,
  startedAt: endedAt,
  endedAt,
  plannedSeconds: 1500,
  actualSeconds: seconds,
  note: null,
  completed: true
});

describe("period statistics", () => {
  const now = new Date("2026-07-19T18:00:00+08:00");
  const sessions = [
    session("2026-07-19T09:00:00+08:00"),
    session("2026-07-14T09:00:00+08:00", 1200),
    session("2026-07-01T09:00:00+08:00"),
    session("2026-06-30T09:00:00+08:00")
  ];

  it("filters the current local day", () => {
    expect(sessionsInPeriod(sessions, "day", now)).toHaveLength(1);
  });

  it("uses Monday as the first day of the week", () => {
    expect(sessionsInPeriod(sessions, "week", now)).toHaveLength(2);
  });

  it("summarizes the current month", () => {
    expect(summarizePeriod(sessions, "month", now)).toEqual({
      count: 3,
      minutes: 70,
      activeDays: 3
    });
  });
});
