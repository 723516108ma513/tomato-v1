import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { projectProgress } from "./projects";

const task = (
  id: string,
  projectId: string | null,
  status: Task["status"],
  completed: number,
  estimated: number
): Task => ({
  id,
  projectId,
  title: id,
  status,
  priority: "medium",
  estimatedPomodoros: estimated,
  completedPomodoros: completed,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z"
});

describe("project progress", () => {
  it("only aggregates tasks belonging to the selected project", () => {
    const tasks = [
      task("one", "project-a", "done", 2, 2),
      task("two", "project-a", "todo", 1, 3),
      task("other", "project-b", "done", 4, 4),
      task("inbox", null, "todo", 0, 1)
    ];
    expect(projectProgress(tasks, "project-a")).toEqual({
      taskCount: 2,
      completedTaskCount: 1,
      estimatedPomodoros: 5,
      completedPomodoros: 3
    });
  });

  it("returns zero progress for an empty project", () => {
    expect(projectProgress([], "project-a")).toEqual({
      taskCount: 0,
      completedTaskCount: 0,
      estimatedPomodoros: 0,
      completedPomodoros: 0
    });
  });
});
