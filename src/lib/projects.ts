import type { Task } from "../types";

export interface ProjectProgress {
  taskCount: number;
  completedTaskCount: number;
  estimatedPomodoros: number;
  completedPomodoros: number;
}

export function projectProgress(
  tasks: Task[],
  projectId: string
): ProjectProgress {
  const matching = tasks.filter((task) => task.projectId === projectId);
  return {
    taskCount: matching.length,
    completedTaskCount: matching.filter((task) => task.status === "done").length,
    estimatedPomodoros: matching.reduce(
      (sum, task) => sum + task.estimatedPomodoros,
      0
    ),
    completedPomodoros: matching.reduce(
      (sum, task) => sum + task.completedPomodoros,
      0
    )
  };
}
