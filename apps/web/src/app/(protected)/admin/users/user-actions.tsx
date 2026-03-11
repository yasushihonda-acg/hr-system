"use client";

import { MoreHorizontal, Pencil, Shield, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser } from "@/lib/types";
import {
  changeRoleAction,
  removeUserAction,
  toggleUserActiveAction,
  updateDisplayNameAction,
} from "./actions";

export function UserActions({ user }: { user: AdminUser }) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSaveDisplayName() {
    const newName = inputRef.current?.value.trim();
    if (!newName || newName === user.displayName) {
      setEditOpen(false);
      return;
    }
    setSaving(true);
    await updateDisplayNameAction(user.id, newName);
    setSaving(false);
    setEditOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            表示名を編集
          </DropdownMenuItem>
          {user.role === "viewer" ? (
            <DropdownMenuItem onClick={() => changeRoleAction(user.id, "admin")}>
              <Shield className="mr-2 h-4 w-4" />
              管理者に昇格
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => changeRoleAction(user.id, "viewer")}>
              <ShieldOff className="mr-2 h-4 w-4" />
              閲覧者に降格
            </DropdownMenuItem>
          )}
          {user.isActive ? (
            <DropdownMenuItem onClick={() => toggleUserActiveAction(user.id, false)}>
              <UserX className="mr-2 h-4 w-4" />
              無効化
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => toggleUserActiveAction(user.id, true)}>
              <UserCheck className="mr-2 h-4 w-4" />
              有効化
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => removeUserAction(user.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>表示名を編集</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveDisplayName();
            }}
          >
            <div className="space-y-2 py-2">
              <label htmlFor="displayName" className="text-sm font-medium">
                表示名
              </label>
              <input
                ref={inputRef}
                id="displayName"
                type="text"
                defaultValue={user.displayName}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
