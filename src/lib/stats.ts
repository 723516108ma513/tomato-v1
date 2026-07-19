import type { PomodoroSession } from "../types";

export type StatsPeriod = "day" | "week" | "month";

export interface PeriodSummary {
  count: number;
  minutes: number;
  activeDays: number;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfPeriod(period: StatsPeriod, now = new Date()): Date {
  const start = startOfDay(now);
  if (period === "week") {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  } else if (period === "month") {
    start.setDate(1);
  }
  return start;
}

export function sessionsInPeriod(
  sessions: PomodoroSession[],
  period: StatsPeriod,
  now = new Date()
): PomodoroSession[] {
  const start = startOfPeriod(period, now).getTime();
  const end = now.getTime();
  return sessions.filter((session) => {
    const stamp = new Date(session.endedAt).getTime();
    return session.completed && stamp >= start && stamp <= end;
  });
}

export function summarizePeriod(
  sessions: PomodoroSession[],
  period: StatsPeriod,
  now = new Date()
): PeriodSummary {
  const matching = sessionsInPeriod(sessions, period, now);
  const days = new Set(
    matching.map((session) => startOfDay(new Date(session.endedAt)).toISOString())
  );
  return {
    count: matching.length,
    minutes: Math.round(
      matching.reduce((total, session) => total + session.actualSeconds, 0) / 60
    ),
    activeDays: days.size
  };
}

export function periodChart(
  sessions: PomodoroSession[],
  period: StatsPeriod,
  now = new Date()
) {
  const count = period === "day" ? 8 : period === "week" ? 7 : 30;
  const start = startOfPeriod(period, now);
  return Array.from({ length: count }, (_, index) => {
    let rangeStart: Date;
    let rangeEnd: Date;
    let label: string;

    if (period === "day") {
      rangeStart = new Date(start);
      rangeStart.setHours(index * 3);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setHours(rangeEnd.getHours() + 3);
      label = `${String(index * 3).padStart(2, "0")}:00`;
    } else {
      rangeStart = new Date(start);
      rangeStart.setDate(rangeStart.getDate() + index);
      rangeEnd = new Date(rangeStart);
      rangeEnd.setDate(rangeEnd.getDate() + 1);
      label =
        period === "week"
          ? new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(rangeStart)
          : `${rangeStart.getDate()}日`;
    }

    const matching = sessions.filter((session) => {
      const stamp = new Date(session.endedAt).getTime();
      return stamp >= rangeStart.getTime() && stamp < rangeEnd.getTime();
    });
    return {
      label,
      count: matching.length,
      minutes: Math.round(
        matching.reduce((total, session) => total + session.actualSeconds, 0) / 60
      )
    };
  });
}
