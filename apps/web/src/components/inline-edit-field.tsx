"use client";

import type { LucideIcon } from "lucide-react";
import { Calendar, Check, Loader2, Pencil, Users, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useAssigneeSuggestions } from "@/hooks/use-assignee-suggestions";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  icon: LucideIcon;
  label: string;
  value: string | null;
  placeholder: string;
  type: "text" | "date";
  onSave: (value: string | null) => Promise<void>;
  /** テキスト入力時にフィルタリング表示される候補リスト */
  suggestions?: string[];
}

/**
 * インライン編集フィールド。
 * 通常時はラベル+値を表示し、クリックで編集モードに切り替わる。
 * 担当者・期限の編集に使用する共通コンポーネント。
 */
export function InlineEditField({
  icon: Icon,
  label,
  value,
  placeholder,
  type,
  onSave,
  suggestions,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 外側クリックで編集をキャンセル
  useEffect(() => {
    if (!editing) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setLocalValue(type === "date" && value ? value.slice(0, 10) : (value ?? ""));
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [editing, value, type]);

  const displayValue = type === "date" && value ? value.slice(0, 10) : value;

  function handleSave() {
    setEditing(false);
    const newValue = localValue.trim() || null;
    const saveValue = type === "date" && newValue ? `${newValue}T00:00:00+09:00` : newValue;

    startTransition(async () => {
      await onSave(saveValue);
      setShowSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowSaved(false), 1500);
    });
  }

  function handleCancel() {
    setEditing(false);
    setLocalValue(type === "date" && value ? value.slice(0, 10) : (value ?? ""));
  }

  if (editing) {
    return (
      <div ref={containerRef} className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="w-14 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
        <form
          className="flex flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="relative min-w-0 flex-1">
            <input
              type={type}
              value={localValue}
              onChange={(e) => {
                setLocalValue(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={placeholder}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
              autoComplete="off"
            />
            {suggestions &&
              showSuggestions &&
              (() => {
                const filtered = suggestions.filter(
                  (s) => s.toLowerCase().includes(localValue.toLowerCase()) && s !== localValue,
                );
                if (filtered.length === 0) return null;
                return (
                  <ul className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded border border-border bg-background shadow-md">
                    {filtered.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="w-full px-2 py-1 text-left text-xs hover:bg-accent"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setLocalValue(s);
                            setShowSuggestions(false);
                          }}
                        >
                          {s}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
          </div>
          <button
            type="submit"
            className="rounded px-1.5 py-0.5 text-xs font-medium text-[var(--gradient-from)] hover:bg-accent"
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="w-14 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => {
          setLocalValue(type === "date" && value ? value.slice(0, 10) : (value ?? ""));
          setEditing(true);
        }}
        className={cn(
          "group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors hover:bg-accent",
          isPending && "pointer-events-none opacity-50",
        )}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : displayValue ? (
          <span className="truncate font-medium">{displayValue}</span>
        ) : (
          <span className="truncate text-muted-foreground/50 italic">{placeholder}</span>
        )}
        <Pencil className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      </button>
      {showSaved && (
        <span className="flex items-center gap-0.5 text-xs text-emerald-600">
          <Check className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

/** 担当者フィールド（候補リストを自動取得） */
export function AssigneesField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  const suggestions = useAssigneeSuggestions();
  return (
    <InlineEditField
      icon={Users}
      label="担当者"
      value={value}
      placeholder="未設定"
      type="text"
      onSave={onSave}
      suggestions={suggestions}
    />
  );
}

/** 期限フィールド */
export function DeadlineField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  return (
    <InlineEditField
      icon={Calendar}
      label="期限"
      value={value}
      placeholder="未設定"
      type="date"
      onSave={onSave}
    />
  );
}
