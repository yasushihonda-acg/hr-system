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
          追加するスペースには <span className="font-mono font-medium">{syncAccountEmail}</span>{" "}
          が参加している必要があります。
        </p>
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
