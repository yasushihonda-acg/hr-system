"use client";

import { ExternalLink } from "lucide-react";

export function ChatOpenButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={() => window.open(url, "_blank", "noopener,noreferrer,width=1400,height=900")}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
    >
      <ExternalLink className="h-4 w-4" />
      Google Chat で開く
    </button>
  );
}
