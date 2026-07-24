import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Bot,
  CheckSquare2,
  Clock3,
  Settings,
  Sprout,
  UsersRound,
  Radio
} from "lucide-react";
import type { PageId } from "../types";

interface SidebarProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
}

const navItems: Array<{
  id: PageId;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { id: "focus", label: "专注", hint: "开始一颗番茄", icon: Clock3 },
  { id: "tasks", label: "任务", hint: "整理下一步", icon: CheckSquare2 },
  { id: "jar", label: "番茄罐", hint: "收藏完成时刻", icon: Archive },
  { id: "companion", label: "伙伴", hint: "一起拆解目标", icon: Bot },
  { id: "insights", label: "洞察", hint: "回顾你的节奏", icon: BarChart3 },
  { id: "teams", label: "组队", hint: "和伙伴一起专注", icon: UsersRound },
  { id: "rooms", label: "房间", hint: "同步番茄钟", icon: Radio },
  { id: "settings", label: "设置", hint: "模型与偏好", icon: Settings }
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="主导航">
      <button
        className="brand"
        type="button"
        onClick={() => onNavigate("focus")}
        aria-label="返回专注首页"
      >
        <span className="brand-mark" aria-hidden="true">
          <Sprout size={21} strokeWidth={2.2} />
        </span>
        <span>
          <strong>Tomato</strong>
          <small>Companion</small>
        </span>
      </button>

      <nav className="nav-list">
        {navItems.map(({ id, label, hint, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={`nav-item ${activePage === id ? "is-active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-current={activePage === id ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={2} aria-hidden="true" />
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-note">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>本地优先</strong>
          <p>任务与专注记录保存在你的设备上。</p>
        </div>
      </div>
    </aside>
  );
}
