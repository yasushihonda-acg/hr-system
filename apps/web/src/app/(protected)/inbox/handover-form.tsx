"use client";

import { Check, Loader2, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import type { WorkflowUpdateRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateWorkflowAction } from "./actions";

interface HandoverFormProps {
  chatMessageId: string;
  taskSummary: string | null;
  assignees: string | null;
  deadline: string | null;
  notes: string | null;
}

export function HandoverForm({
  chatMessageId,
  taskSummary,
  assignees,
  deadline,
  notes,
}: HandoverFormProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [localTask, setLocalTask] = useState(taskSummary ?? "");
  const [localAssignees, setLocalAssignees] = useState(assignees ?? "");
  const [localDeadline, setLocalDeadline] = useState(deadline ? deadline.slice(0, 10) : "");
  const [localNotes, setLocalNotes] = useState(notes ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasContent = !!(taskSummary || assignees || deadline || notes);

  async function handleSave() {
    setSaving(true);
    const body: WorkflowUpdateRequest = {
      taskSummary: localTask || null,
      assignees: localAssignees || null,
      deadline: localDeadline ? `${localDeadline}T00:00:00+09:00` : null,
      notes: localNotes || null,
    };
    await updateWorkflowAction(chatMessageId, body);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground">引き継ぎメモ</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
            {hasContent ? "編集" : "追加"}
          </button>
        </div>
        {hasContent ? (
          <div className="space-y-1.5 text-xs">
            {taskSummary && (
              <div>
                <span className="text-muted-foreground">タスク:</span>{" "}
                <span className="text-foreground">{taskSummary}</span>
              </div>
            )}
            {assignees && (
              <div>
                <span className="text-muted-foreground">担当者:</span>{" "}
                <span className="text-foreground">{assignees}</span>
              </div>
            )}
            {deadline && (
              <div>
                <span className="text-muted-foreground">期限:</span>{" "}
                <span className="text-foreground">{deadline.slice(0, 10)}</span>
              </div>
            )}
            {notes && (
              <div>
                <span className="text-muted-foreground">メモ:</span>{" "}
                <span className="text-foreground">{notes}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">メモなし</p>
        )}
        {saved && (
          <p className="flex items-center gap-1 text-xs text-[var(--status-ok)]">
            <Check className="h-3 w-3" />
            保存しました
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">引き継ぎメモ</p>
      <div className="space-y-1.5">
        <input
          type="text"
          placeholder="タスク概要"
          value={localTask}
          onChange={(e) => setLocalTask(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
        />
        <input
          type="text"
          placeholder="担当者"
          value={localAssignees}
          onChange={(e) => setLocalAssignees(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
        />
        <div>
          <input
            type="date"
            value={localDeadline}
            onChange={(e) => setLocalDeadline(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
          />
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">期限（任意）</p>
        </div>
        <textarea
          placeholder="引き継ぎメモ"
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)] resize-none"
        />
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className={cn(
            "flex items-center gap-1 rounded-md bg-[var(--gradient-from)] px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90",
            saving && "opacity-50 pointer-events-none",
          )}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          保存
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setLocalTask(taskSummary ?? "");
            setLocalAssignees(assignees ?? "");
            setLocalDeadline(deadline ? deadline.slice(0, 10) : "");
            setLocalNotes(notes ?? "");
          }}
          className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
