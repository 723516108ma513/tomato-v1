import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { CompanionPage } from "./pages/CompanionPage";
import { FocusPage } from "./pages/FocusPage";
import { InsightsPage } from "./pages/InsightsPage";
import { JarPage } from "./pages/JarPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TasksPage } from "./pages/TasksPage";
import { useAppStore } from "./store/useAppStore";

const pageTitles = {
  focus: ["专注空间", "把注意力放回眼前这一小步。"],
  tasks: ["任务清单", "把模糊目标变成可以开始的动作。"],
  jar: ["番茄罐", "每一颗都代表你真正投入过的时间。"],
  companion: ["学习伙伴", "一起梳理目标、拆解路径，也记住你的节奏。"],
  insights: ["专注洞察", "用事实回顾，不用连续打卡惩罚自己。"],
  settings: ["设置", "管理计时偏好、模型连接与本地数据。"]
} as const;

function CurrentPage() {
  const page = useAppStore((state) => state.page);
  switch (page) {
    case "tasks":
      return <TasksPage />;
    case "jar":
      return <JarPage />;
    case "companion":
      return <CompanionPage />;
    case "insights":
      return <InsightsPage />;
    case "settings":
      return <SettingsPage />;
    default:
      return <FocusPage />;
  }
}

export default function App() {
  const page = useAppStore((state) => state.page);
  const setPage = useAppStore((state) => state.setPage);
  const load = useAppStore((state) => state.load);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const clearError = useAppStore((state) => state.clearError);

  useEffect(() => {
    void load();
  }, [load]);

  const [title, subtitle] = pageTitles[page];

  return (
    <div className="app-shell">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">TOMATO COMPANION</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="today-chip" aria-label="今天的状态">
            <span>今天</span>
            <strong>
              {new Intl.DateTimeFormat("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "short"
              }).format(new Date())}
            </strong>
          </div>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
            <button type="button" onClick={clearError} aria-label="关闭错误提示">
              <X size={17} />
            </button>
          </div>
        )}

        <section className="page-stage" aria-busy={loading}>
          {loading ? (
            <div className="loading-state">
              <span className="loading-ring" aria-hidden="true" />
              <p>正在准备你的专注空间…</p>
            </div>
          ) : (
            <CurrentPage />
          )}
        </section>
      </main>
    </div>
  );
}
