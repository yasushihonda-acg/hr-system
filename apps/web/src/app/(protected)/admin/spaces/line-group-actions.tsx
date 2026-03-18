"use client";

import { MoreHorizontal, PowerIcon, PowerOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LineGroupConfig } from "@/lib/types";
import { deleteLineGroupAction, toggleLineGroupActiveAction } from "./actions";

export function LineGroupActions({ group }: { group: LineGroupConfig }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {group.isActive ? (
          <DropdownMenuItem onClick={() => toggleLineGroupActiveAction(group.id, false)}>
            <PowerOff className="mr-2 h-4 w-4" />
            無効化
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => toggleLineGroupActiveAction(group.id, true)}>
            <PowerIcon className="mr-2 h-4 w-4" />
            有効化
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onClick={() => deleteLineGroupAction(group.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
