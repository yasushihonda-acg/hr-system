"use client";

import { UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addUserAction } from "./actions";

export function AddUserForm() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          ユーザー追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ユーザーを追加</DialogTitle>
          <DialogDescription>ダッシュボードにアクセスできるユーザーを追加します</DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={async (formData) => {
            await addUserAction(formData);
            setOpen(false);
            formRef.current?.reset();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" name="email" type="email" required placeholder="user@aozora-cg.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">表示名</Label>
            <Input id="displayName" name="displayName" required placeholder="山田 太郎" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">ロール</Label>
            <Select name="role" defaultValue="viewer">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">閲覧者</SelectItem>
                <SelectItem value="admin">管理者</SelectItem>
              </SelectContent>
            </Select>
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
