"use client";

import { MoreHorizontal, Shield, ShieldOff, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser } from "@/lib/types";
import { changeRoleAction, removeUserAction, toggleUserActiveAction } from "./actions";

export function UserActions({ user }: { user: AdminUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
  );
}
