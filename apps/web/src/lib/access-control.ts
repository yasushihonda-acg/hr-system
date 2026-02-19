import "server-only";

import { collections } from "@hr-system/db";
import type { UserRole } from "@hr-system/shared";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export interface AccessInfo {
  email: string;
  name: string;
  role: UserRole;
}

/**
 * 現在のセッションユーザーのホワイトリストチェック。
 * 未認証→/login、非許可→/unauthorized へリダイレクト。
 * Server Component / Server Action 専用。
 */
export async function requireAccess(): Promise<AccessInfo> {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }

  const snapshot = await collections.allowedUsers
    .where("email", "==", session.user.email)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    redirect("/unauthorized");
  }

  const doc = snapshot.docs[0];
  if (!doc) {
    redirect("/unauthorized");
  }

  return {
    email: session.user.email,
    name: session.user.name ?? "",
    role: doc.data().role,
  };
}

/**
 * admin ロール必須のアクセスチェック。
 */
export async function requireAdmin(): Promise<AccessInfo> {
  const access = await requireAccess();
  if (access.role !== "admin") {
    redirect("/unauthorized");
  }
  return access;
}
