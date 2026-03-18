"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUser } from "@/lib/types";
import { reorderUsersAction } from "./actions";
import { UserActions } from "./user-actions";

export function UserTable({ users }: { users: AdminUser[] }) {
  const [isPending, startTransition] = useTransition();

  function handleMove(index: number, direction: "up" | "down") {
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= users.length) return;

    const reordered = [...users];
    const a = reordered[index];
    const b = reordered[swapIndex];
    if (!a || !b) return;
    reordered[index] = b;
    reordered[swapIndex] = a;
    const orderedIds = reordered.map((u) => u.id);

    startTransition(() => {
      reorderUsersAction(orderedIds);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[70px]">順序</TableHead>
            <TableHead>メールアドレス</TableHead>
            <TableHead>表示名</TableHead>
            <TableHead>ロール</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>追加者</TableHead>
            <TableHead>作成日</TableHead>
            <TableHead className="w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                許可ユーザーがいません
              </TableCell>
            </TableRow>
          ) : (
            users.map((user, index) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === 0 || isPending}
                      onClick={() => handleMove(index, "up")}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={index === users.length - 1 || isPending}
                      onClick={() => handleMove(index, "down")}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.displayName}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role === "admin" ? "管理者" : "閲覧者"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "outline"}>
                    {user.isActive ? "有効" : "無効"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{user.addedBy}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("ja-JP")}
                </TableCell>
                <TableCell>
                  <UserActions user={user} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
