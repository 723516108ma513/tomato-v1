import { useEffect, useMemo, useState } from "react";
import {
  Check,
  FolderInput,
  FolderPlus,
  Inbox,
  Loader2,
  X
} from "lucide-react";
import type {
  ImportLearningPlanInput,
  LearningPlanDraft,
  Project,
  TaskPriority
} from "../types";

interface PlanImportDialogProps {
  draft: LearningPlanDraft;
  projects: Project[];
  onClose: () => void;
  onImport: (input: ImportLearningPlanInput) => Promise<void>;
}

type Destination = "new" | "existing" | "none";

export function PlanImportDialog({
  draft,
  projects,
  onClose,
  onImport
}: PlanImportDialogProps) {
  const [destination, setDestination] = useState<Destination>("new");
  const [projectName, setProjectName] = useState(draft.projectName);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [tasks, setTasks] = useState(
    draft.tasks.map((task) => ({ ...task, selected: true }))
  );
  const [importing, setImporting] = useState(false);
  const selectedCount = tasks.filter((task) => task.selected).length;
  const totalTomatoes = useMemo(
    () =>
      tasks
        .filter((task) => task.selected)
        .reduce((sum, task) => sum + task.estimatedPomodoros, 0),
    [tasks]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing) onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [importing, onClose]);

  const updateTask = (
    index: number,
    patch: Partial<(typeof tasks)[number]>
  ) => {
    setTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index ? { ...task, ...patch } : task
      )
    );
  };

  const submit = async () => {
    const selected = tasks.filter(
      (task) => task.selected && task.title.trim()
    );
    if (!selected.length) return;
    setImporting(true);
    try {
      await onImport({
        projectId: destination === "existing" ? projectId : null,
        newProjectName: destination === "new" ? projectName.trim() : null,
        projectDescription: destination === "new" ? draft.summary : null,
        tasks: selected.map((task) => ({
          title: task.title.trim(),
          estimatedPomodoros: task.estimatedPomodoros,
          priority: task.priority
        }))
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay plan-import-overlay" role="presentation">
      <section
        className="plan-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-import-title"
      >
        <header className="plan-import-header">
          <div>
            <p className="eyebrow">AI PLAN READY</p>
            <h2 id="plan-import-title">确认并导入番茄任务</h2>
            <p>{draft.summary}</p>
          </div>
          <button
            type="button"
            className="icon-button subtle"
            onClick={onClose}
            disabled={importing}
            aria-label="关闭导入面板"
          >
            <X size={20} />
          </button>
        </header>

        <div className="plan-import-body">
          <section className="destination-section">
            <h3>这些任务放在哪里？</h3>
            <div className="destination-options">
              <label className={destination === "new" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="destination"
                  checked={destination === "new"}
                  onChange={() => setDestination("new")}
                />
                <FolderPlus size={19} />
                <span>
                  <strong>创建新项目</strong>
                  <small>把整套学习计划作为一个项目管理</small>
                </span>
              </label>
              <label
                className={destination === "existing" ? "is-selected" : ""}
                aria-disabled={!projects.length}
              >
                <input
                  type="radio"
                  name="destination"
                  checked={destination === "existing"}
                  disabled={!projects.length}
                  onChange={() => setDestination("existing")}
                />
                <FolderInput size={19} />
                <span>
                  <strong>合并到已有项目</strong>
                  <small>
                    {projects.length ? "继续补充已有学习路径" : "目前还没有项目"}
                  </small>
                </span>
              </label>
              <label className={destination === "none" ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="destination"
                  checked={destination === "none"}
                  onChange={() => setDestination("none")}
                />
                <Inbox size={19} />
                <span>
                  <strong>直接放入任务列表</strong>
                  <small>不创建项目，作为独立任务导入</small>
                </span>
              </label>
            </div>
            {destination === "new" && (
              <label className="field">
                <span>新项目名称</span>
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </label>
            )}
            {destination === "existing" && (
              <label className="field">
                <span>选择项目</span>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section className="draft-task-section">
            <div className="draft-task-heading">
              <div>
                <h3>选择要导入的任务</h3>
                <p>任务名称和预计番茄数可在导入前修改。</p>
              </div>
              <span>
                {selectedCount} 项 · {totalTomatoes} 颗番茄
              </span>
            </div>
            <div className="draft-task-list">
              {tasks.map((task, index) => (
                <article
                  key={`${index}-${task.title}`}
                  className={task.selected ? "is-selected" : ""}
                >
                  <button
                    type="button"
                    className="draft-task-check"
                    onClick={() =>
                      updateTask(index, { selected: !task.selected })
                    }
                    aria-label={task.selected ? "取消导入任务" : "选择导入任务"}
                    aria-pressed={task.selected}
                  >
                    {task.selected && <Check size={15} />}
                  </button>
                  <div className="draft-task-copy">
                    <input
                      value={task.title}
                      disabled={!task.selected}
                      maxLength={120}
                      aria-label={`任务 ${index + 1} 名称`}
                      onChange={(event) =>
                        updateTask(index, { title: event.target.value })
                      }
                    />
                    <p>{task.detail}</p>
                  </div>
                  <label>
                    <span>番茄</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      disabled={!task.selected}
                      value={task.estimatedPomodoros}
                      onChange={(event) =>
                        updateTask(index, {
                          estimatedPomodoros: Math.min(
                            20,
                            Math.max(1, Number(event.target.value))
                          )
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>优先级</span>
                    <select
                      value={task.priority}
                      disabled={!task.selected}
                      onChange={(event) =>
                        updateTask(index, {
                          priority: event.target.value as TaskPriority
                        })
                      }
                    >
                      <option value="high">高</option>
                      <option value="medium">中</option>
                      <option value="low">低</option>
                    </select>
                  </label>
                </article>
              ))}
            </div>
          </section>
        </div>

        <footer className="plan-import-footer">
          <p>导入后仍可在任务列表中继续编辑和完成。</p>
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
              disabled={importing}
            >
              暂不导入
            </button>
            <button
              type="button"
              className="button button-primary"
              onClick={() => void submit()}
              disabled={
                importing ||
                !selectedCount ||
                (destination === "new" && !projectName.trim()) ||
                (destination === "existing" && !projectId)
              }
            >
              {importing ? (
                <Loader2 size={18} className="spin-icon" />
              ) : (
                <Check size={18} />
              )}
              导入 {selectedCount} 个任务
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
