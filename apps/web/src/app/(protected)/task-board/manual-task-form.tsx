"use client";

import type { ChatCategory, TaskPriority } from "@hr-system/shared";
import { CHAT_CATEGORIES } from "@hr-system/shared";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar as CalendarIcon, Plus, Users } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { TaskPrioritySelector } from "@/components/task-priority-selector";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAssigneeSuggestions } from "@/hooks/use-assignee-suggestions";
import { CATEGORY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createManualTaskAction } from "./actions";
import { useSelectTask } from "./task-board-content";

export function ManualTaskCreateButton() {
  const selectTask = useSelectTask();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [category, setCategory] = useState<ChatCategory | null>(null);
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [assigneeValue, setAssigneeValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const assigneeInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);
  const suggestions = useAssigneeSuggestions();

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(assigneeValue.toLowerCase()) && s !== assigneeValue,
  );

  function resetForm() {
    setPriority("medium");
    setCategory(null);
    setDeadline(undefined);
    setAssigneeValue("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    formRef.current?.reset();
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  function selectSuggestion(value: string) {
    justSelectedRef.current = true;
    setAssigneeValue(value);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }

  function handleAssigneeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || filtered.length === 0) {
      if (e.key === "Escape") {
        setShowSuggestions(false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case "Enter": {
        const selected = filtered[highlightedIndex];
        if (selected) {
          e.preventDefault();
          selectSuggestion(selected);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = (formData.get("title") as string).trim();
    if (!title) return;

    startTransition(async () => {
      const result = await createManualTaskAction({
        title,
        content: (formData.get("content") as string) || "",
        taskPriority: priority,
        categories: category ? [category] : [],
        assignees: assigneeValue.trim() || null,
        deadline: deadline ? `${format(deadline, "yyyy-MM-dd")}T00:00:00+09:00` : null,
      });
      handleClose();
      selectTask(`manual-${result.id}`);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
      >
        <Plus size={14} />
        タスク追加
      </button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>新規タスク</DialogTitle>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            {/* タスク名 */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">
                タスク名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="task-title"
                name="title"
                placeholder="例: 社会保険の手続き"
                required
                maxLength={200}
                autoFocus
              />
            </div>

            {/* 詳細メモ */}
            <div className="space-y-1.5">
              <Label htmlFor="task-content">詳細メモ</Label>
              <textarea
                id="task-content"
                name="content"
                placeholder="補足情報があれば入力"
                rows={2}
                maxLength={2000}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px]"
              />
            </div>

            {/* 担当者 + 期限（2カラム） */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 担当者 */}
              <div className="space-y-1.5">
                <Label htmlFor="task-assignees">
                  <Users className="h-3.5 w-3.5" />
                  担当者
                </Label>
                <div className="relative">
                  <Input
                    ref={assigneeInputRef}
                    id="task-assignees"
                    value={assigneeValue}
                    onChange={(e) => {
                      if (justSelectedRef.current) {
                        justSelectedRef.current = false;
                        return;
                      }
                      setAssigneeValue(e.target.value);
                      setHighlightedIndex(-1);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      // 候補クリック時のblurを遅延処理
                      setTimeout(() => setShowSuggestions(false), 150);
                    }}
                    onKeyDown={handleAssigneeKeyDown}
                    placeholder="名前を入力"
                    maxLength={200}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showSuggestions && filtered.length > 0}
                    aria-activedescendant={
                      highlightedIndex >= 0 ? `create-suggestion-${highlightedIndex}` : undefined
                    }
                  />
                  {showSuggestions && filtered.length > 0 && (
                    <div
                      ref={listRef}
                      className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-md border border-border bg-background shadow-md"
                      role="listbox"
                    >
                      {filtered.map((s, i) => (
                        <button
                          key={s}
                          id={`create-suggestion-${i}`}
                          type="button"
                          role="option"
                          aria-selected={i === highlightedIndex}
                          className={cn(
                            "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
                            i === highlightedIndex && "bg-accent",
                          )}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(s);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 期限 */}
              <div className="space-y-1.5">
                <Label>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  期限
                </Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-left text-sm shadow-xs transition-[color,box-shadow]",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
                        !deadline && "text-muted-foreground",
                      )}
                    >
                      {deadline ? format(deadline, "yyyy/MM/dd", { locale: ja }) : "日付を選択"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={deadline}
                      onSelect={(date) => {
                        setDeadline(date);
                        setCalendarOpen(false);
                      }}
                      locale={ja}
                      defaultMonth={deadline}
                    />
                    {deadline && (
                      <div className="border-t border-border px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDeadline(undefined);
                            setCalendarOpen(false);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          期限をクリア
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* カテゴリ + 優先度（2カラム） */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="task-category">カテゴリ</Label>
                <select
                  id="task-category"
                  value={category ?? ""}
                  onChange={(e) => setCategory((e.target.value || null) as ChatCategory | null)}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]"
                >
                  <option value="">未分類</option>
                  {CHAT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>優先度</Label>
                <TaskPrioritySelector
                  value={priority}
                  onChange={(p) => setPriority(p ?? "medium")}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                キャンセル
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "作成中..." : "作成"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
