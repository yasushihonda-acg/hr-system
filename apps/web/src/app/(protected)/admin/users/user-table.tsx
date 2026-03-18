"use client";

import { ArrowDownUp, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
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
    <div className="space-y-3">
      {/* 説明バナー */}
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-2.5">
        <ArrowDownUp className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
        <p className="text-xs leading-relaxed text-foreground/70">
          この並び順がタスクの
          <span className="font-semibold text-foreground">「担当者」選択リスト</span>
          に反映されます。よく使う担当者を上位に配置すると、割り振り時の操作が快適になります。
        </p>
      </div>

      {/* テーブル */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">並び順</TableHead>
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
                <TableRow key={user.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      <span className="min-w-[1.25rem] text-center text-sm tabular-nums font-medium text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex flex-col opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          disabled={index === 0 || isPending}
                          onClick={() => handleMove(index, "up")}
                          title="上に移動"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          disabled={index === users.length - 1 || isPending}
                          onClick={() => handleMove(index, "down")}
                          title="下に移動"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
    </div>
  );
}
