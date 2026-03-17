"use client";

import { useEffect, useRef, useState } from "react";

interface NotesFieldProps {
  value: string | null;
  onSave: (notes: string | null) => Promise<void>;
}

export function NotesField({ value, onSave }: NotesFieldProps) {
  const [localNotes, setLocalNotes] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const savedValue = useRef(value ?? "");

  // sync when prop changes externally
  useEffect(() => {
    const v = value ?? "";
    setLocalNotes(v);
    savedValue.current = v;
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
      <p className="text-xs font-semibold text-muted-foreground">
        メモ
        {saving && <span className="ml-1 text-muted-foreground/60">保存中...</span>}
      </p>
      <textarea
        value={localNotes}
        onChange={(e) => setLocalNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="メモ"
        rows={2}
        className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-foreground/80 placeholder:text-muted-foreground/40 focus:border-border focus:bg-card focus:outline-none"
      />
    </div>
  );
}
