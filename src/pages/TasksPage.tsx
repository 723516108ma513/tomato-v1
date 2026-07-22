import { FormEvent, useMemo, useState } from "react";
import {
  Check,
  Circle,
  FolderKanban,
  Inbox,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { projectProgress } from "../lib/projects";
import { useAppStore } from "../store/useAppStore";
import type { TaskPriority } from "../types";

export function TasksPage() {
  const snapshot = useAppStore((state) => state.snapshot);
  const addTask = useAppStore((state) => state.addTask);
  const createProject = useAppStore((state) => state.createProject);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const removeTask = useAppStore((state) => state.removeTask);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [estimate, setEstimate] = useState(1);
  const [projectId, setProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { tasks, projects } = snapshot;
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
      const matchesProject =
        projectFilter === "all" ||
        (projectFilter === "none"
          ? !task.projectId
          : task.projectId === projectFilter);
      return (
        matchesProject &&
        (!normalized || task.title.toLocaleLowerCase().includes(normalized))
      );
    });
  }, [projectFilter, search, tasks]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await addTask({
      projectId: projectId || null,
      title: title.trim(),
      priority,
      estimatedPomodoros: estimate
    });
    setTitle("");
    setEstimate(1);
  };

  const handleProjectSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!newProjectName.trim()) return;
    await createProject(newProjectName.trim());
    setNewProjectName("");
  };

  const openCount = tasks.filter((task) => task.status === "todo").length;
  const doneCount = tasks.length - openCount;

  return (
    <div className="stack-page">
      <section className="project-overview panel">
        <div className="project-overview-heading">
          <div>
            <p className="eyebrow">PROJECT GROUPS</p>
            <h2>按学习项目组织番茄任务</h2>
            <p>一个项目是一条完整学习路径，里面可以放多项可执行任务。</p>
          </div>
          <form className="quick-project-form" onSubmit={handleProjectSubmit}>
            <label className="sr-only" htmlFor="new-project-name">
              新项目名称
            </label>
            <input
              id="new-project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="新建项目，例如：Python 数据分析"
              maxLength={80}
            />
            <button
              type="submit"
              className="button button-secondary"
              disabled={!newProjectName.trim()}
            >
              <Plus size={17} />
              新建项目
            </button>
          </form>
        </div>

        <div className="project-card-row" role="list" aria-label="项目筛选">
          <button
            type="button"
            className={projectFilter === "all" ? "is-active" : ""}
            onClick={() => setProjectFilter("all")}
          >
            <Inbox size={19} />
            <span>
              <strong>全部任务</strong>
              <small>{tasks.length} 项</small>
            </span>
          </button>
          {projects.map((project) => {
            const progress = projectProgress(tasks, project.id);
            return (
              <button
                key={project.id}
                type="button"
                className={projectFilter === project.id ? "is-active" : ""}
                onClick={() => setProjectFilter(project.id)}
              >
                <FolderKanban size={19} />
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {progress.completedTaskCount}/{progress.taskCount} 项 ·{" "}
                    {progress.completedPomodoros} 颗番茄
                  </small>
                </span>
              </button>
            );
          })}
          {tasks.some((task) => !task.projectId) && (
            <button
              type="button"
              className={projectFilter === "none" ? "is-active" : ""}
              onClick={() => setProjectFilter("none")}
            >
              <Inbox size={19} />
              <span>
                <strong>未归项目</strong>
                <small>{tasks.filter((task) => !task.projectId).length} 项</small>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="task-compose panel">
        <div>
          <p className="eyebrow">QUICK CAPTURE</p>
          <h2>写下一个可以开始的动作</h2>
          <p>可以归入项目，也可以先作为独立任务保存。</p>
        </div>
        <form onSubmit={handleSubmit} className="task-form task-form-with-project">
          <label className="field field-grow">
            <span>任务名称</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="下一步要完成什么？"
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>所属项目</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">不归入项目</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>优先级</span>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label className="field field-small">
            <span>预计番茄</span>
            <input
              type="number"
              value={estimate}
              onChange={(event) =>
                setEstimate(Math.min(20, Math.max(1, Number(event.target.value))))
              }
              min={1}
              max={20}
            />
          </label>
          <button type="submit" className="button button-primary">
            <Plus size={18} />
            添加
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="list-toolbar">
          <div>
            <h2>
              {projectFilter === "all"
                ? "全部任务"
                : projectFilter === "none"
                  ? "未归项目"
                  : projects.find((project) => project.id === projectFilter)
                      ?.name ?? "项目任务"}
            </h2>
            <p>
              {openCount} 项待完成，{doneCount} 项已完成
            </p>
          </div>
          <label className="search-box">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">搜索任务</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索任务"
            />
          </label>
        </div>

        <div className="task-table" role="list">
          {filtered.map((task) => {
            const project = projects.find(
              (item) => item.id === task.projectId
            );
            return (
              <article
                key={task.id}
                className={`task-row ${task.status === "done" ? "is-done" : ""}`}
                role="listitem"
              >
                <button
                  type="button"
                  className="task-toggle"
                  onClick={() => void toggleTask(task.id)}
                  aria-label={task.status === "done" ? "恢复任务" : "完成任务"}
                >
                  {task.status === "done" ? (
                    <Check size={17} />
                  ) : (
                    <Circle size={19} />
                  )}
                </button>
                <div className="task-row-copy">
                  <strong>{task.title}</strong>
                  <span>
                    <i className={`priority-dot ${task.priority}`} />
                    {project?.name ?? "未归项目"} ·{" "}
                    {task.priority === "high"
                      ? "高优先级"
                      : task.priority === "medium"
                        ? "中优先级"
                        : "低优先级"}
                  </span>
                </div>
                <div className="pomodoro-progress">
                  <span>
                    {task.completedPomodoros}/{task.estimatedPomodoros}
                  </span>
                  <div>
                    <i
                      style={{
                        width: `${Math.min(
                          100,
                          (task.completedPomodoros / task.estimatedPomodoros) *
                            100
                        )}%`
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-button subtle"
                  onClick={() => void removeTask(task.id)}
                  aria-label={`删除任务：${task.title}`}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <div className="empty-state">
              <Search size={28} />
              <h3>没有找到任务</h3>
              <p>换一个关键词，或者在上方新建一项。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
