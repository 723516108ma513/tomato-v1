import { BarChart3, Clock3, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  periodChart,
  summarizePeriod,
  type StatsPeriod
} from "../lib/stats";
import { useAppStore } from "../store/useAppStore";

const labels: Record<StatsPeriod, string> = {
  day: "今日",
  week: "本周",
  month: "本月"
};

export function InsightsPage() {
  const sessions = useAppStore((state) => state.snapshot.sessions);
  const tasks = useAppStore((state) => state.snapshot.tasks);
  const [period, setPeriod] = useState<StatsPeriod>("week");
  const chart = useMemo(() => periodChart(sessions, period), [sessions, period]);
  const summary = useMemo(
    () => summarizePeriod(sessions, period),
    [sessions, period]
  );
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const maxCount = Math.max(1, ...chart.map((item) => item.count));
  const divisor = period === "day" ? 1 : period === "week" ? 7 : 30;
  const average = summary.count / divisor;

  return (
    <div className="stack-page">
      <div className="insight-period-switch period-switch" aria-label="洞察统计周期">
        {(Object.keys(labels) as StatsPeriod[]).map((item) => (
          <button
            key={item}
            type="button"
            className={period === item ? "is-active" : ""}
            onClick={() => setPeriod(item)}
          >
            {labels[item]}
          </button>
        ))}
      </div>

      <section className="summary-grid four">
        <article className="metric-card">
          <BarChart3 size={19} />
          <span>{labels[period]}番茄</span>
          <strong>{summary.count}</strong>
          <small>颗</small>
        </article>
        <article className="metric-card">
          <Clock3 size={19} />
          <span>{labels[period]}专注</span>
          <strong>{Math.round((summary.minutes / 60) * 10) / 10}</strong>
          <small>小时</small>
        </article>
        <article className="metric-card">
          <Target size={19} />
          <span>累计完成任务</span>
          <strong>{completedTasks}</strong>
          <small>项</small>
        </article>
        <article className="metric-card">
          <TrendingUp size={19} />
          <span>{labels[period]}日均</span>
          <strong>{average.toFixed(1)}</strong>
          <small>颗/天</small>
        </article>
      </section>

      <section className="insights-grid">
        <article className="panel chart-panel">
          <div className="panel-heading simple">
            <div>
              <h2>{labels[period]}完成分布</h2>
              <p>按完成时间统计真实的专注番茄。</p>
            </div>
          </div>
          <div
            className={`bar-chart period-${period}`}
            aria-label={`${labels[period]}番茄数量柱状图`}
          >
            {chart.map((item, index) => (
              <div className="bar-column" key={`${item.label}-${index}`}>
                <span className="bar-value">{item.count}</span>
                <div className="bar-track">
                  <i
                    style={{
                      height: `${Math.max(4, (item.count / maxCount) * 100)}%`
                    }}
                  />
                </div>
                <strong>{item.label}</strong>
                <small>{item.minutes} 分</small>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel reflection-card">
          <p className="eyebrow">FOCUS REFLECTION</p>
          <h2>让数据服务于下一步</h2>
          {summary.count ? (
            <>
              <p>
                {labels[period]}记录了 <strong>{summary.count}</strong> 颗番茄、
                {summary.minutes} 分钟专注。先观察哪些时段容易开始，再决定是否增加目标。
              </p>
              <ul>
                <li>保留最容易开始的固定时段</li>
                <li>把超过 4 颗番茄的任务继续拆小</li>
                <li>复盘估算偏差，而不是责备自己</li>
              </ul>
            </>
          ) : (
            <p>完成几颗番茄后，这里会出现基于真实记录的温和建议。</p>
          )}
        </aside>
      </section>
    </div>
  );
}
