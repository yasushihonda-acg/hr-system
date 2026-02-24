import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/access-control";
import { getChatSpaces } from "@/lib/api";
import { AddSpaceForm } from "./add-space-form";
import { SpaceActions } from "./space-actions";

export default async function AdminSpacesPage() {
  await requireAdmin();
  const { data: spaces } = await getChatSpaces(true);

  const syncAccountEmail = process.env.CHAT_SYNC_ACCOUNT_EMAIL ?? "yasushi.honda@aozora-cg.com";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-800">
          ⚠ 追加するスペースには <span className="font-mono font-medium">{syncAccountEmail}</span>{" "}
          が参加している必要があります。
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-900 select-none">
            詳しく見る ▸
          </summary>
          <div className="mt-3 space-y-3 text-xs text-amber-800">
            <div>
              <p className="font-semibold mb-1">■ なぜこの制約があるのか</p>
              <p className="leading-relaxed">
                Google Chat スペースが「外部ユーザーの招待を禁止」に設定されている場合、
                システムのサービスアカウントを Chat App としてスペースにインストールできません。
                そのため、スペースに参加済みの開発者アカウントの認証情報でデータを取得しています。
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
              <p className="mt-1 leading-relaxed">
                現時点ではスペースのポリシー制限により上記が適用できないため、
                開発者アカウントによる認証方式を採用しています。
              </p>
            </div>
          </div>
        </details>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">スペース一覧</h2>
          <p className="text-sm text-muted-foreground mt-1">
            チャット同期の対象スペースを管理します
          </p>
        </div>
        <AddSpaceForm />
      </div>

      <div className="rounded-md border">
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
            {spaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  スペースが登録されていません
                </TableCell>
              </TableRow>
            ) : (
              spaces.map((space) => (
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
