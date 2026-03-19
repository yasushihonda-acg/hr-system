import { collections, db } from "@hr-system/db";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionRole } from "@/lib/access-control";
import { getBaseUrl } from "@/lib/server-url";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * GET /api/auth/chat-connect/callback
 * Google OAuth コールバック: 認可コード → トークン交換 → Firestore 保存
 */
export async function GET(request: Request) {
  const role = await getSessionRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = await getBaseUrl();
  const syncPageUrl = `${baseUrl}/admin/sync`;

  // ユーザーが同意をキャンセルした場合
  if (error) {
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=cancelled`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=error&reason=missing_params`);
  }

  // CSRF 検証
  const cookieStore = await cookies();
  const savedState = cookieStore.get("chat_connect_state")?.value;
  cookieStore.delete("chat_connect_state");

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=error&reason=invalid_state`);
  }

  // 認可コードをトークンに交換
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = `${baseUrl}/api/auth/chat-connect/callback`;

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error("Token exchange failed:", tokenData.error ?? "no refresh_token");
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=error&reason=token_exchange`);
  }

  // Google userinfo API でメールアドレスを検証取得（access_token は Google token endpoint から直接取得したもの）
  let email = "";
  try {
    const userinfoRes = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!userinfoRes.ok) throw new Error(`userinfo failed: ${userinfoRes.status}`);
    const userinfo = await userinfoRes.json();
    email = userinfo.email ?? "";
  } catch (err) {
    console.error("Userinfo fetch failed:", err);
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=error&reason=invalid_id_token`);
  }

  if (!email) {
    return NextResponse.redirect(`${syncPageUrl}?chat_connect=error&reason=no_email`);
  }

  // 操作した管理者のメールを取得
  const session = await auth();
  const connectedBy = session?.user?.email ?? "unknown";

  // Firestore に保存
  const batch = db.batch();

  const credRef = db.doc("app_config/chat_credentials");
  batch.set(credRef, {
    email,
    refreshToken: tokenData.refresh_token,
    connectedBy,
    connectedAt: FieldValue.serverTimestamp(),
  });

  const auditRef = collections.auditLogs.doc();
  batch.set(auditRef, {
    eventType: "chat_credentials_connected",
    entityType: "app_config",
    entityId: "chat_credentials",
    actorEmail: connectedBy,
    actorRole: null,
    details: { connectedEmail: email },
    createdAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();

  return NextResponse.redirect(`${syncPageUrl}?chat_connect=success`);
}
