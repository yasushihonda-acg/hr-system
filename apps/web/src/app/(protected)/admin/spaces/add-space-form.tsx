"use client";

import { ChevronDown, HelpCircle, PlusCircle } from "lucide-react";
import Image from "next/image";
import { Collapsible } from "radix-ui";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addSpaceAction } from "./actions";

export function AddSpaceForm() {
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          スペース追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>スペースを追加</DialogTitle>
          <DialogDescription>
            チャット同期の対象スペースを追加します。対象アカウントがスペースに参加していることを確認してください。
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            await addSpaceAction(formData);
            setOpen(false);
            formRef.current?.reset();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="spaceId">スペースID</Label>
            <Input
              id="spaceId"
              name="spaceId"
              required
              placeholder="AAAA-xxxxxxxx"
              className="font-mono"
            />
            <Collapsible.Root open={helpOpen} onOpenChange={setHelpOpen}>
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">
                  Google Chat スペースの ID（例: AAAA-qf5jX0）
                </p>
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="スペースIDの確認方法を表示"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${helpOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </Collapsible.Trigger>
              </div>
              <Collapsible.Content className="overflow-hidden transition-all data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                <div className="mt-2 rounded-md border bg-muted/50 p-3 text-xs space-y-2">
                  <p className="font-medium text-foreground">スペースIDの確認方法</p>
                  <ol className="list-none space-y-1.5 text-muted-foreground">
                    <li>① Google Chat でスペースを開く</li>
                    <li>
                      ② ブラウザのアドレスバーで URL を確認
                      <span className="mt-0.5 block rounded bg-background px-2 py-1 font-mono text-[11px] break-all">
                        https://mail.google.com/chat/u/0/#chat/space/
                        <span className="font-bold text-orange-600">AAAA-qf5jX0</span>
                      </span>
                    </li>
                    <li>
                      ③ 末尾の
                      <span className="font-mono font-bold text-orange-600">AAAA-qf5jX0</span>
                      の部分がスペースID
                    </li>
                  </ol>
                  <Image
                    src="/screenshots/help/space-id-guide.png"
                    alt="スペースIDの確認手順"
                    width={480}
                    height={360}
                    className="mt-2 rounded border"
                  />
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">表示名</Label>
            <Input id="displayName" name="displayName" required placeholder="人事関連スペース" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit">追加</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
