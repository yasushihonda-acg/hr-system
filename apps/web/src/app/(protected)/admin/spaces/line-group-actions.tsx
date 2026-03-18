"use client";

import { MoreHorizontal, PowerIcon, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LineGroupConfig } from "@/lib/types";
import { toggleLineGroupActiveAction } from "./actions";

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
            取得停止
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => toggleLineGroupActiveAction(group.id, true)}>
            <PowerIcon className="mr-2 h-4 w-4" />
            取得再開
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
