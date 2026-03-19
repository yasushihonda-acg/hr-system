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
import { getChatCredentials, getChatSpaces, getLineGroups } from "@/lib/api";
import { ChatSpacesSection } from "./chat-spaces-section";
import { LineGroupActions } from "./line-group-actions";
import { LineGroupHelp } from "./line-group-help";
import { SpacesTabNav } from "./spaces-tab-nav";

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSpacesPage({ searchParams }: Props) {
  await requireAdmin();
  const { tab = "chat" } = await searchParams;

  return (
    <div className="space-y-6">
      <SpacesTabNav activeTab={tab} />

      {tab === "chat" && <ChatSpacesContent />}
      {tab === "line" && <LineGroupsTab />}
    </div>
  );
}

async function ChatSpacesContent() {
  const [{ data: spaces }, credentials] = await Promise.all([
    getChatSpaces(true),
    getChatCredentials()
      .then((r) => r.data)
      .catch((err) => {
        console.error("[admin/spaces] getChatCredentials failed:", err);
        return null;
      }),
  ]);

  return <ChatSpacesSection initialSpaces={spaces} initialCredentials={credentials} />;
}

async function LineGroupsTab() {
  const { data: lineGroups } = await getLineGroups(true);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200/60 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          ℹ LINE Bot がグループに招待されると、メッセージ受信時に自動で登録されます。
          ここでは取得の有効/無効を管理できます。
        </p>
        <div className="mt-2 text-xs text-blue-700 space-y-1">
          <p>
            ・<strong>有効</strong>: グループのメッセージを受信・保存します
          </p>
          <p>
            ・<strong>無効</strong>: メッセージの受信を停止します（Bot
            はグループに残るため、再度有効にできます）
          </p>
          <LineGroupHelp />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">グループ一覧</h3>
        <p className="text-xs text-muted-foreground">
          LINE メッセージ取得の対象グループを管理します
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>グループID</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>登録方法</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  LINE グループが登録されていません。Bot
                  をグループに招待するとメッセージ受信時に自動登録されます。
                </TableCell>
              </TableRow>
            ) : (
              lineGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono text-sm max-w-[200px] truncate">
                    {group.groupId}
                  </TableCell>
                  <TableCell>{group.displayName}</TableCell>
                  <TableCell>
                    <Badge variant={group.isActive ? "default" : "outline"}>
                      {group.isActive ? "有効" : "無効"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {group.addedBy === "webhook" ? "自動登録" : group.addedBy}
                  </TableCell>
                  <TableCell>
                    <LineGroupActions group={group} />
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
