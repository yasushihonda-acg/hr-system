"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PriorityClearDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PriorityClearDialog({ open, onConfirm, onCancel }: PriorityClearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            タスク解除の確認
          </DialogTitle>
          <DialogDescription>
            タスクを解除すると、タスク一覧から除外されます。解除しますか？
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            解除する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
