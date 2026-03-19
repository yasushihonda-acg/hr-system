import { RESPONSE_STATUSES, TASK_PRIORITIES } from "@hr-system/shared";
import type { TaskItem } from "./task-list";

export type SortKey =
  | "createdAt"
  | "taskPriority"
  | "taskSummary"
  | "source"
  | "categories"
  | "assignees"
  | "responseStatus"
  | "deadline";
export type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = Object.fromEntries(
  TASK_PRIORITIES.map((v, i) => [v, i]),
);
const STATUS_ORDER: Record<string, number> = Object.fromEntries(
  RESPONSE_STATUSES.map((v, i) => [v, i]),
);

export function compareNullable<T>(
  a: T | null | undefined,
  b: T | null | undefined,
  cmp: (a: T, b: T) => number,
  dir: SortDir,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // null は常に末尾
  if (b == null) return -1;
  return dir === "asc" ? cmp(a, b) : cmp(b, a);
}

export function sortTasks(tasks: TaskItem[], key: SortKey | null, dir: SortDir): TaskItem[] {
  if (!key) return tasks;
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    switch (key) {
      case "createdAt":
        return dir === "asc"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt);
      case "taskPriority":
        return dir === "asc"
          ? (PRIORITY_ORDER[a.taskPriority] ?? 99) - (PRIORITY_ORDER[b.taskPriority] ?? 99)
          : (PRIORITY_ORDER[b.taskPriority] ?? 99) - (PRIORITY_ORDER[a.taskPriority] ?? 99);
      case "taskSummary":
        return compareNullable(
          a.taskSummary,
          b.taskSummary,
          (x, y) => x.localeCompare(y, "ja"),
          dir,
        );
      case "source":
        return dir === "asc" ? a.source.localeCompare(b.source) : b.source.localeCompare(a.source);
      case "categories": {
        const ca = a.categories[0] ?? null;
        const cb = b.categories[0] ?? null;
        return compareNullable(ca, cb, (x, y) => x.localeCompare(y, "ja"), dir);
      }
      case "assignees":
        return compareNullable(a.assignees, b.assignees, (x, y) => x.localeCompare(y, "ja"), dir);
      case "responseStatus":
        return dir === "asc"
          ? (STATUS_ORDER[a.responseStatus] ?? 99) - (STATUS_ORDER[b.responseStatus] ?? 99)
          : (STATUS_ORDER[b.responseStatus] ?? 99) - (STATUS_ORDER[a.responseStatus] ?? 99);
      case "deadline":
        return compareNullable(a.deadline, b.deadline, (x, y) => x.localeCompare(y), dir);
      default:
        return 0;
    }
  });
  return sorted;
}
