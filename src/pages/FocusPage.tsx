import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Square,
  Target
} from "lucide-react";
import {
  createTimerState,
  elapsedSeconds,
  formatClock,
  getRemainingSeconds,
  pauseTimer,
  PHASE_SECONDS,
  resetTimer,
  startTimer
} from "../lib/timer";
import { loadTimerState, saveTimerState } from "../lib/bridge";
import { useAppStore } from "../store/useAppStore";
import type { TimerPhase, TimerState } from "../types";

const phaseLabels: Record<TimerPhase, string> = {
  focus: "专注",
  shortBreak: "短休息",
  longBreak: "长休息"
};

export function FocusPage() {
  const tasks = useAppStore((state) => state.snapshot.tasks);
  const sessions = useAppStore((state) => state.snapshot.sessions);
  const finishPomodoro = useAppStore((state) => state.finishPomodoro);
  const setPage = useAppStore((state) => state.setPage);
  const [timer, setTimer] = useState<TimerState>(() => createTimerState());
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [timerHydrated, setTimerHydrated] = useState(false);
  const completingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void loadTimerState()
      .then((saved) => {
        if (active && saved) setTimer(saved);
      })
      .finally(() => {
        if (active) setTimerHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (timerHydrated) {
      void saveTimerState(timer);
    }
  }, [timer, timerHydrated]);

  useEffect(() => {
    if (timer.status !== "running") return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [timer.status]);

  const remaining = getRemainingSeconds(timer, now);
  const progress = Math.min(
    1,
    Math.max(0, 1 - remaining / timer.durationSeconds)
  );

  const finalize = async (natural = false) => {
    if (completingRef.current) return;
    completingRef.current = true;
    const endedAt = Date.now();
    const actual = natural
      ? timer.durationSeconds
      : elapsedSeconds(timer, endedAt);

    if (timer.phase === "focus" && actual > 0) {
      await finishPomodoro({
        taskId: timer.taskId,
        startedAt: new Date(timer.startedAt ?? endedAt - actual * 1000).toISOString(),
        endedAt: new Date(endedAt).toISOString(),
        plannedSeconds: timer.durationSeconds,
        actualSeconds: actual
      });
      setNotice("这颗番茄已经放进番茄罐。");
      setTimer({
        ...createTimerState("shortBreak"),
        taskId: timer.taskId
      });
    } else {
      setNotice("休息结束，慢慢把注意力带回来。");
      setTimer({
        ...createTimerState("focus"),
        taskId: timer.taskId
      });
    }
    completingRef.current = false;
  };

  useEffect(() => {
    if (timer.status === "running" && remaining === 0) {
      void finalize(true);
    }
    // `finalize` intentionally reads the timer snapshot that reached zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, timer.status]);

  const todayKey = new Date().toDateString();
  const todaySessions = sessions.filter(
    (session) => new Date(session.endedAt).toDateString() === todayKey
  );
  const todayMinutes = Math.round(
    todaySessions.reduce((sum, session) => sum + session.actualSeconds, 0) / 60
  );
  const activeTasks = tasks.filter((task) => task.status === "todo");
  const selectedTask = tasks.find((task) => task.id === timer.taskId);

  const ringStyle = useMemo(
    () => ({
      strokeDasharray: `${progress * 100} 100`
    }),
    [progress]
  );

  const setPhase = (phase: TimerPhase) => {
    if (timer.status === "running") return;
    setTimer({
      ...createTimerState(phase),
      taskId: timer.taskId
    });
    setNotice(null);
  };

  const adjustMinutes = (delta: number) => {
    if (timer.status === "running") return;
    const next = Math.min(
      180 * 60,
      Math.max(60, timer.durationSeconds + delta * 60)
    );
    setTimer((current) => ({
      ...current,
      durationSeconds: next,
      remainingSeconds: next,
      status: "idle",
      startedAt: null,
      targetAt: null
    }));
  };

  return (
    <div className="focus-layout">
      <section className="timer-card">
        <div className="phase-tabs" aria-label="计时模式">
          {(Object.keys(phaseLabels) as TimerPhase[]).map((phase) => (
            <button
              type="button"
              key={phase}
              className={timer.phase === phase ? "is-active" : ""}
              onClick={() => setPhase(phase)}
              disabled={timer.status === "running"}
            >
              {phaseLabels[phase]}
            </button>
          ))}
        </div>

        <div className="timer-ring" aria-label={`剩余 ${formatClock(remaining)}`}>
          <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
            <circle className="timer-track" cx="60" cy="60" r="53" pathLength="100" />
            <circle
              className="timer-progress"
              cx="60"
              cy="60"
              r="53"
              pathLength="100"
              style={ringStyle}
            />
          </svg>
          <div className="timer-copy">
            <span>{phaseLabels[timer.phase]}</span>
            <strong>{formatClock(remaining)}</strong>
            <small>
              {selectedTask?.title ??
                (timer.phase === "focus" ? "选择一个任务开始" : "放松眼睛和肩膀")}
            </small>
          </div>
        </div>

        <div className="duration-control" aria-label="调整时长">
          <button
            type="button"
            onClick={() => adjustMinutes(-5)}
            disabled={timer.status === "running"}
            aria-label="减少五分钟"
          >
            <Minus size={16} />
          </button>
          <span>{Math.round(timer.durationSeconds / 60)} 分钟</span>
          <button
            type="button"
            onClick={() => adjustMinutes(5)}
            disabled={timer.status === "running"}
            aria-label="增加五分钟"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="timer-actions">
          {timer.status === "running" ? (
            <button
              type="button"
              className="button button-primary button-large"
              onClick={() => setTimer((current) => pauseTimer(current))}
            >
              <Pause size={19} fill="currentColor" />
              暂停
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary button-large"
              onClick={() => {
                setNotice(null);
                setTimer((current) => startTimer(current));
              }}
            >
              <Play size={19} fill="currentColor" />
              {timer.status === "paused" ? "继续" : "开始专注"}
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            onClick={() => setTimer((current) => resetTimer(current))}
            aria-label="重置计时器"
          >
            <RotateCcw size={19} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void finalize(false)}
            disabled={elapsedSeconds(timer) === 0}
            aria-label="提前完成"
          >
            <Square size={18} />
          </button>
        </div>

        {notice && (
          <div className="success-note" role="status">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
      </section>

      <aside className="focus-rail">
        <div className="mini-stats">
          <article>
            <span>今日番茄</span>
            <strong>{todaySessions.length}</strong>
            <small>颗</small>
          </article>
          <article>
            <span>专注时间</span>
            <strong>{todayMinutes}</strong>
            <small>分钟</small>
          </article>
        </div>

        <section className="panel task-picker">
          <div className="panel-heading">
            <div>
              <span className="section-icon">
                <Target size={18} />
              </span>
              <div>
                <h2>这一颗做什么</h2>
                <p>只选一个清晰的下一步。</p>
              </div>
            </div>
            <button type="button" className="text-button" onClick={() => setPage("tasks")}>
              管理
            </button>
          </div>
          <div className="task-choice-list">
            {activeTasks.slice(0, 5).map((task) => (
              <button
                type="button"
                key={task.id}
                className={`task-choice ${timer.taskId === task.id ? "is-selected" : ""}`}
                onClick={() =>
                  setTimer((current) => ({ ...current, taskId: task.id }))
                }
              >
                <span className={`priority-dot ${task.priority}`} />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {task.completedPomodoros}/{task.estimatedPomodoros} 颗
                  </small>
                </span>
                <span className="choice-check" aria-hidden="true">
                  <CheckCircle2 size={17} />
                </span>
              </button>
            ))}
            {activeTasks.length === 0 && (
              <div className="empty-compact">
                <p>任务清单是空的。</p>
                <button type="button" className="text-button" onClick={() => setPage("tasks")}>
                  新建任务
                </button>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
