"use client";

import { PlusCircle } from "lucide-react";
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
            <p className="text-xs text-muted-foreground">
              Google Chat スペースの ID（例: AAAA-qf5jX0）
            </p>
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
