"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import Image from "next/image";
import { Collapsible } from "radix-ui";
import { useState } from "react";

export function LineGroupHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-start gap-1">
      <p>・新しいグループを追加するには、LINE アプリでグループに Bot を招待してください</p>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
            aria-label="Bot の招待方法を表示"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <div className="mt-2 rounded-md border border-blue-200 bg-white/60 p-3 text-xs space-y-2">
            <p className="font-medium text-blue-900">Bot の招待方法</p>
            <ol className="list-none space-y-1.5 text-blue-800">
              <li>① LINE アプリでグループのトーク画面を開く</li>
              <li>② 右上の ≡ メニュー →「招待」をタップ</li>
              <li>③「HR AI Agent」を検索して招待</li>
            </ol>
            <Image
              src="/screenshots/help/line-bot-invite-guide.png"
              alt="LINE Bot の招待手順"
              width={480}
              height={360}
              className="mt-2 rounded border"
            />
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
