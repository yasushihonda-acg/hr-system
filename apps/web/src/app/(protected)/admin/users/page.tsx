import { requireAdmin } from "@/lib/access-control";
import { getAdminUsers } from "@/lib/api";
import { AddUserForm } from "./add-user-form";
import { UserTable } from "./user-table";

export default async function AdminUsersPage() {
  await requireAdmin();
  const { data: users } = await getAdminUsers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">ユーザー一覧</h2>
          <p className="text-xs text-muted-foreground">
            ダッシュボードへのアクセスを許可するユーザーを管理します。表示順はタスクの「担当者」候補リストに反映されます。
          </p>
        </div>
        <AddUserForm />
      </div>

      <UserTable users={users} />
    </div>
  );
}
