import Link from "next/link";
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
import { getEmployees } from "@/lib/api";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_SIZE = 20;

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: "正社員",
  part_time: "パート",
  visiting_nurse: "登録訪問看護師",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP");
}

export default async function EmployeesPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { employees, total } = await getEmployees({ limit: PAGE_SIZE, offset });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">従業員一覧</h1>
        <p className="text-sm text-muted-foreground">全{total}件</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>社員番号</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>雇用形態</TableHead>
              <TableHead>部署</TableHead>
              <TableHead>役職</TableHead>
              <TableHead>入社日</TableHead>
              <TableHead>状態</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  従業員がいません
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono">{e.employeeNumber}</TableCell>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>{e.email}</TableCell>
                  <TableCell>{EMPLOYMENT_LABELS[e.employmentType] ?? e.employmentType}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.position}</TableCell>
                  <TableCell>{formatDate(e.hireDate)}</TableCell>
                  <TableCell>
                    <Badge variant={e.isActive ? "default" : "secondary"}>
                      {e.isActive ? "在籍" : "退職"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild disabled={page <= 1}>
            <Link href={`/employees?page=${page - 1}`}>前へ</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
            <Link href={`/employees?page=${page + 1}`}>次へ</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
