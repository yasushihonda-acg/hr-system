import { auth } from "@/auth";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3001";

export async function GET() {
  const session = await auth();
  if (!session?.idToken) {
    return Response.json({ error: "認証されていません" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE_URL}/api/chat-messages/sync/config`, {
    headers: { Authorization: `Bearer ${session.idToken}` },
  });

  const body = await res.json();
  return Response.json(body, { status: res.status });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.idToken) {
    return Response.json({ error: "認証されていません" }, { status: 401 });
  }

  const body = await request.json();
  const res = await fetch(`${API_BASE_URL}/api/chat-messages/sync/config`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${session.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseBody = await res.json();
  return Response.json(responseBody, { status: res.status });
}
