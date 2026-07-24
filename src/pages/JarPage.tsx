import { Archive, CalendarDays, Clock3, Layers3 } from "lucide-react";
import { useMemo, useState } from "react";
import { AnimatedJar } from "../components/AnimatedJar";
import { sessionsInPeriod, summarizePeriod, type StatsPeriod } from "../lib/stats";
import { useAppStore } from "../store/useAppStore";

const periodLabels: Record<StatsPeriod, string> = {
  day: "今天",
  week: "本周",
  month: "本月"
};

export function JarPage() {
  const sessions = useAppStore((state) => state.snapshot.sessions);
  const tasks = useAppStore((state) => state.snapshot.tasks);
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const periodSessions = useMemo(
    () => sessionsInPeriod(sessions, period),
    [sessions, period]
  );
  const summary = useMemo(
    () => summarizePeriod(sessions, period),
    [sessions, period]
  );

  return (
    <div className="stack-page">
      <section className="jar-hero jar-hero-animated">
        <div className="jar-hero-copy">
          <p className="eyebrow">YOUR FOCUS ARCHIVE</p>
          <h2>你已经收集了 {sessions.length} 颗番茄</h2>
          <p>
            每完成一次专注，一颗新番茄就会落进罐子。它只记录真实投入过的时间，
            不用连续打卡评价你。
          </p>
          <div className="period-switch" aria-label="番茄统计周期">
            {(Object.keys(periodLabels) as StatsPeriod[]).map((item) => (
              <button
                key={item}
                type="button"
                className={period === item ? "is-active" : ""}
                onClick={() => setPeriod(item)}
              >
                {periodLabels[item]}
              </button>
            ))}
          </div>
        </div>
        <AnimatedJar sessions={sessions} />
      </section>

      <section className="summary-grid four">
        <article className="metric-card">
          <Archive size={19} />
          <span>{periodLabels[period]}完成</span>
          <strong>{summary.count}</strong>
          <small>颗番茄</small>
        </article>
        <article className="metric-card">
          <Clock3 size={19} />
          <span>{periodLabels[period]}专注</span>
          <strong>{summary.minutes}</strong>
          <small>分钟</small>
        </article>
        <article className="metric-card">
          <CalendarDays size={19} />
          <span>{periodLabels[period]}记录</span>
          <strong>{summary.activeDays}</strong>
          <small>天</small>
        </article>
        <article className="metric-card">
          <Layers3 size={19} />
          <span>关联任务</span>
          <strong>
            {
              new Set(
                periodSessions.map((session) => session.taskId).filter(Boolean)
              ).size
            }
          </strong>
          <small>项</small>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading simple">
          <div>
            <h2>{periodLabels[period]}的番茄</h2>
            <p>新的专注记录会出现在最前面。</p>
          </div>
        </div>
        {periodSessions.length > 0 ? (
          <div className="tomato-grid">
            {periodSessions.map((session, index) => {
              const task = tasks.find((item) => item.id === session.taskId);
              return (
                <article className="tomato-card" key={session.id}>
                  <div className={`tomato-token tone-${index % 4}`} aria-hidden="true">
                    <span />
                  </div>
                  <div>
                    <strong>
                      {task?.title ?? (session.source === "remote" ? "组队学习" : "自由专注")}
                      {session.source === "remote" && <span className="remote-session-badge">同步</span>}
                    </strong>
                    <p>
                      {Math.max(1, Math.round(session.actualSeconds / 60))} 分钟 ·{" "}
                      {new Intl.DateTimeFormat("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      }).format(new Date(session.endedAt))}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state spacious">
            <Archive size={34} />
            <h3>{periodLabels[period]}还没有番茄</h3>
            <p>完成一次专注，它就会落进上面的罐子。</p>
          </div>
        )}
      </section>
    </div>
  );
}
