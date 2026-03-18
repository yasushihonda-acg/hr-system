"use client";

import { useEffect, useRef, useState } from "react";

interface NotesFieldProps {
  value: string | null;
  onSave: (notes: string | null) => Promise<void>;
}

function resizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function NotesField({ value, onSave }: NotesFieldProps) {
  const [localNotes, setLocalNotes] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const savedValue = useRef(value ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // sync when prop changes externally
  useEffect(() => {
    const v = value ?? "";
    setLocalNotes(v);
    savedValue.current = v;
    requestAnimationFrame(() => resizeTextarea(textareaRef.current));
  }, [value]);

  async function handleBlur() {
    if (saving) return;
    const trimmed = localNotes.trim();
    const next = trimmed || null;
    const prev = savedValue.current || null;
    if (next === prev) return;

    setSaving(true);
    try {
      await onSave(next);
      savedValue.current = trimmed;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-muted-foreground">
        メモ
        {saving && <span className="ml-1 text-muted-foreground/60">保存中...</span>}
      </p>
      <textarea
        ref={textareaRef}
        value={localNotes}
        onChange={(e) => {
          setLocalNotes(e.target.value);
          resizeTextarea(e.target);
        }}
        onBlur={handleBlur}
        placeholder="メモを入力..."
        rows={2}
        className="w-full resize-none overflow-hidden rounded border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
      />
    </div>
  );
}
