"use client";

import { useState } from "react";
import { updateResponseStatusAction } from "./actions";

type ResponseStatus = "unresponded" | "in_progress" | "responded" | "not_required";

const STATUS_LABELS: Record<ResponseStatus, string> = {
  unresponded: "未対応",
  in_progress: "対応中",
  responded: "対応済",
  not_required: "対応不要",
};

const STATUS_COLORS: Record<ResponseStatus, string> = {
  unresponded: "bg-red-100 text-red-800 border-red-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  responded: "bg-green-100 text-green-800 border-green-200",
  not_required: "bg-gray-100 text-gray-600 border-gray-200",
};

const ALL_STATUSES: ResponseStatus[] = ["unresponded", "in_progress", "responded", "not_required"];

interface Props {
  chatMessageId: string;
  current: ResponseStatus;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export function ResponseStatusControl({ chatMessageId, current, updatedBy, updatedAt }: Props) {
  const [status, setStatus] = useState<ResponseStatus>(current);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: ResponseStatus) {
    if (next === status) return;
    setSaving(true);
    try {
      await updateResponseStatusAction(chatMessageId, next);
      setStatus(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={saving}
            onClick={() => handleChange(s)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-opacity ${
              STATUS_COLORS[s]
            } ${s === status ? "ring-2 ring-offset-1 ring-current opacity-100" : "opacity-60 hover:opacity-90"}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {saving && <p className="text-xs text-muted-foreground">更新中...</p>}
      {updatedBy && !saving && (
        <p className="text-xs text-muted-foreground">
          最終更新: {updatedBy}
          {updatedAt && (
            <span>
              {" "}
              (
              {new Date(updatedAt).toLocaleString("ja-JP", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              )
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function ResponseStatusBadge({ status }: { status: ResponseStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
