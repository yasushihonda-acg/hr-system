import { auth } from "@/auth";
import { getSessionRole } from "@/lib/access-control";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

export async function POST() {
  const session = await auth();
  if (!session?.idToken) {
    return Response.json({ error: "認証されていません" }, { status: 401 });
  }

  const role = await getSessionRole();
  if (role !== "admin") {
    return Response.json({ error: "管理者のみ実行可能です" }, { status: 403 });
  }

  const res = await fetch(`${API_BASE_URL}/api/chat-messages/sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      "Content-Type": "application/json",
    },
  });

  const body = await res.json();
  return Response.json(body, { status: res.status });
}
