import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionRole } from "@/lib/access-control";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/chat.messages.readonly",
  "https://www.googleapis.com/auth/chat.memberships.readonly",
  "https://www.googleapis.com/auth/directory.readonly",
].join(" ");

/**
 * GET /api/auth/chat-connect
 * Google OAuth 認可 URL を生成してリダイレクト
 */
export async function GET() {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3005";
  const redirectUri = `${baseUrl}/api/auth/chat-connect/callback`;

  // CSRF トークン
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("chat_connect_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10分
    path: "/api/auth/chat-connect/callback",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
