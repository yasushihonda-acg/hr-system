"use client";

import { AlertCircle, AlertTriangle, LinkIcon, Mail, MessageSquare, Unlink } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
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
import type { ChatCredentialsInfo, ChatSpaceConfig } from "@/lib/types";
import { disconnectChatAccountAction } from "./actions";
import { AddSpaceForm } from "./add-space-form";
import { SpaceActions } from "./space-actions";

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface ChatSpacesSectionProps {
  initialSpaces: ChatSpaceConfig[];
  initialCredentials: ChatCredentialsInfo | null;
}

export function ChatSpacesSection({ initialSpaces, initialCredentials }: ChatSpacesSectionProps) {
  const [credentials, setCredentials] = useState<ChatCredentialsInfo | null>(initialCredentials);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const handleChatConnect = useCallback(() => {
    if (
      window.confirm(
        "Google Chat スペースからメッセージを取得するために、Google アカウントを連携します。\n\n連携するアカウントは、同期したいスペースに参加しているメンバーのアカウントを選んでください。\n\n続行しますか？",
      )
    ) {
      window.location.href = "/api/auth/chat-connect";
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setActionError(null);
    startTransition(async () => {
      try {
        await disconnectChatAccountAction();
        setCredentials(null);
      } catch {
        setActionError("連携解除に失敗しました");
      }
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Action error banner */}
      {actionError && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{actionError}</p>
        </div>
      )}

      {/* 連携アカウントカード */}
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
            <MessageSquare className="h-4 w-4 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Chat 連携アカウント</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Google Chat スペースからメッセージを取得するために、スペースに参加している Google
              アカウントを連携します。
            </p>
          </div>
        </div>

        <div className="mt-4">
          {credentials ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{credentials.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {credentials.source === "adc" ? (
                      "自動検出されたアカウント（未連携）"
                    ) : (
                      <>
                        {formatShortDate(credentials.connectedAt)} に連携
                        {credentials.connectedBy && ` (${credentials.connectedBy})`}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleChatConnect}>
                  <LinkIcon className="mr-2 h-4 w-4" />
                  {credentials.source === "adc" ? "アカウントを連携" : "アカウントを変更"}
                </Button>
                {credentials.source !== "adc" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="mr-2 h-4 w-4" />
                    解除
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-muted-foreground">認証情報を取得できませんでした</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleChatConnect}>
                <LinkIcon className="mr-2 h-4 w-4" />
                アカウントを連携
              </Button>
            </div>
          )}
        </div>

        {/* 注意バナー（カード内に統合） */}
        <div className="mt-4 rounded-lg border border-amber-200/60 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            {credentials?.email ? (
              <>
                <span className="font-mono font-medium">{credentials.email}</span>{" "}
                が参加しているスペースを追加できます。
              </>
            ) : (
              <>
                ⚠
                アカウントが未連携です。スペースのメッセージを取得するには、上のボタンからアカウントを連携してください。
              </>
            )}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-900 select-none">
              詳しく見る ▸
            </summary>
            <div className="mt-3 space-y-3 text-xs text-amber-800">
              <div>
                <p className="font-semibold mb-1">■ なぜアカウント連携が必要なのか</p>
                <p className="leading-relaxed">
                  Google Chat
                  のメッセージを読み取るには、そのスペースに参加しているアカウントの権限が必要です。
                  組織の設定により外部アプリの直接インストールが制限されている場合があるため、
                  スペースに参加しているメンバーのアカウントを連携してデータを取得します。
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">■ 回避策（将来対応）</p>
                <p className="leading-relaxed">
                  以下の権限設定が実現すれば、開発者アカウントに依存しない構成が可能です：
                </p>
                <ul className="mt-1 ml-3 space-y-0.5 list-disc">
                  <li>
                    Google Chat App としてサービスアカウントをスペースにインストール（chat.bot
                    スコープ）
                  </li>
                  <li>Google Workspace ドメイン全体の委任設定（Domain-Wide Delegation）</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* スペース一覧 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">スペース一覧</h3>
          <p className="text-xs text-muted-foreground">チャット同期の対象スペースを管理します</p>
        </div>
        <AddSpaceForm />
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>スペースID</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>追加者</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialSpaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  スペースが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              initialSpaces.map((space) => (
                <TableRow key={space.id}>
                  <TableCell className="font-mono text-sm">{space.spaceId}</TableCell>
                  <TableCell>{space.displayName}</TableCell>
                  <TableCell>
                    <Badge variant={space.isActive ? "default" : "outline"}>
                      {space.isActive ? "有効" : "無効"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{space.addedBy}</TableCell>
                  <TableCell>
                    <SpaceActions space={space} />
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
