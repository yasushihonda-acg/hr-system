"use client";

import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import { Calendar as CalendarIcon, Check, Loader2, Pencil, Users, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAssigneeSuggestions } from "@/hooks/use-assignee-suggestions";
import { cn } from "@/lib/utils";

interface InlineEditFieldProps {
  icon: LucideIcon;
  label: string;
  value: string | null;
  placeholder: string;
  onSave: (value: string | null) => Promise<void>;
  /** テキスト入力時にフィルタリング表示される候補リスト */
  suggestions?: string[];
}

/**
 * インライン編集フィールド（テキスト用）。
 * 通常時はラベル+値を表示し、クリックで編集モードに切り替わる。
 * キーボードナビゲーション対応（↑↓: 候補移動、Enter: 選択/保存、Escape: キャンセル）。
 */
export function InlineEditField({
  icon: Icon,
  label,
  value,
  placeholder,
  onSave,
  suggestions,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // IME候補選択後のonChange上書きを防止するフラグ
  const justSelectedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // 編集開始時にフォーカス
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  // 外側クリックで編集をキャンセル
  useEffect(() => {
    if (!editing) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setLocalValue(value ?? "");
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [editing, value]);

  // フィルタリングされた候補リスト
  const filtered = suggestions
    ? suggestions.filter(
        (s) => s.toLowerCase().includes(localValue.toLowerCase()) && s !== localValue,
      )
    : [];

  // ハイライトされた候補をスクロールに追従
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  function handleSave(overrideValue?: string) {
    setEditing(false);
    setShowSuggestions(false);
    const newValue = (overrideValue ?? localValue).trim() || null;

    startTransition(async () => {
      await onSave(newValue);
      setShowSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowSaved(false), 1500);
    });
  }

  function handleCancel() {
    setEditing(false);
    setShowSuggestions(false);
    setLocalValue(value ?? "");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || filtered.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
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
          justSelectedRef.current = true;
          handleSave(selected);
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
              ref={inputRef}
              type="text"
              value={localValue}
              onChange={(e) => {
                // 候補選択直後のIME compositionend由来のonChangeをスキップ
                if (justSelectedRef.current) {
                  justSelectedRef.current = false;
                  return;
                }
                setLocalValue(e.target.value);
                setHighlightedIndex(-1);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--gradient-from)]"
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions && filtered.length > 0}
              aria-activedescendant={
                highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined
              }
            />
            {showSuggestions && filtered.length > 0 && (
              <div
                ref={listRef}
                className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded border border-border bg-background shadow-md"
              >
                {filtered.map((s, i) => (
                  <button
                    key={s}
                    id={`suggestion-${i}`}
                    type="button"
                    className={cn(
                      "w-full px-2 py-1 text-left text-xs hover:bg-accent",
                      i === highlightedIndex && "bg-accent",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      justSelectedRef.current = true;
                      handleSave(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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
          setLocalValue(value ?? "");
          setEditing(true);
        }}
        className={cn(
          "group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors hover:bg-accent",
          isPending && "pointer-events-none opacity-50",
        )}
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : value ? (
          <span className="truncate font-medium">{value}</span>
        ) : (
          <span className="truncate text-muted-foreground/50 italic">{placeholder}</span>
        )}
        <Pencil className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      </button>
      {value && !isPending && (
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await onSave(null);
              setShowSaved(true);
              if (timerRef.current) clearTimeout(timerRef.current);
              timerRef.current = setTimeout(() => setShowSaved(false), 1500);
            });
          }}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-muted-foreground"
          title="クリア"
        >
          <X className="h-3 w-3" />
        </button>
      )}
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
      onSave={onSave}
      suggestions={suggestions}
    />
  );
}

/** 期限フィールド（カレンダーピッカー） */
export function DeadlineField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dateValue = value ? parseISO(value) : undefined;
  const displayValue = value ? value.slice(0, 10) : null;

  function handleSelect(date: Date | undefined) {
    setOpen(false);
    const saveValue = date ? `${format(date, "yyyy-MM-dd")}T00:00:00+09:00` : null;

    startTransition(async () => {
      await onSave(saveValue);
      setShowSaved(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowSaved(false), 1500);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span className="w-14 flex-shrink-0 text-xs text-muted-foreground">期限</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
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
              <span className="truncate text-muted-foreground/50 italic">未設定</span>
            )}
            <Pencil className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            locale={ja}
            defaultMonth={dateValue}
          />
          {dateValue && (
            <div className="border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => handleSelect(undefined)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                期限をクリア
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {showSaved && (
        <span className="flex items-center gap-0.5 text-xs text-emerald-600">
          <Check className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
