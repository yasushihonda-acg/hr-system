"use client";

import type { TaskPriority } from "@hr-system/shared";
import { Plus, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import { createManualTaskAction } from "./actions";

export function ManualTaskCreateButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = (formData.get("title") as string).trim();
    if (!title) return;

    startTransition(async () => {
      const deadlineVal = (formData.get("deadline") as string) || null;
      await createManualTaskAction({
        title,
        content: (formData.get("content") as string) || "",
        taskPriority: priority,
        assignees: (formData.get("assignees") as string) || null,
        deadline: deadlineVal ? `${deadlineVal}T00:00:00+09:00` : null,
      });
      setIsOpen(false);
      setPriority("medium");
      formRef.current?.reset();
    });
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
      >
        <Plus size={14} />
        タスク追加
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">新規タスク</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            name="title"
            type="text"
            placeholder="タスク名（必須）"
            required
            maxLength={200}
            className="w-full rounded-md border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div>
          <textarea
            name="content"
            placeholder="詳細メモ（任意）"
            rows={2}
            maxLength={2000}
            className="w-full rounded-md border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div>
          <input
            name="assignees"
            type="text"
            placeholder="担当者（任意）"
            maxLength={200}
            className="w-full rounded-md border border-border/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div>
          <input
            name="deadline"
            type="date"
            className="w-full rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          <p className="mt-1 text-xs text-muted-foreground">期限（任意）</p>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">優先度</p>
          <TaskPrioritySelector value={priority} onChange={(p) => setPriority(p ?? "medium")} />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-slate-100"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "作成中..." : "作成"}
          </button>
        </div>
      </form>
    </div>
  );
}
