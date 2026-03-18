"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import { createAdminUser, deleteAdminUser, reorderAdminUsers, updateAdminUser } from "@/lib/api";

export async function addUserAction(formData: FormData) {
  await requireAdmin();
  const email = formData.get("email") as string;
  const displayName = formData.get("displayName") as string;
  const role = formData.get("role") as string;

  await createAdminUser({ email, displayName, role });
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await updateAdminUser(id, { isActive });
  revalidatePath("/admin/users");
}

export async function changeRoleAction(id: string, role: string) {
  await requireAdmin();
  await updateAdminUser(id, { role });
  revalidatePath("/admin/users");
}

export async function updateDisplayNameAction(id: string, displayName: string) {
  await requireAdmin();
  await updateAdminUser(id, { displayName });
  revalidatePath("/admin/users");
}

export async function removeUserAction(id: string) {
  await requireAdmin();
  await deleteAdminUser(id);
  revalidatePath("/admin/users");
}

export async function reorderUsersAction(orderedIds: string[]) {
  await requireAdmin();
  await reorderAdminUsers(orderedIds);
  revalidatePath("/admin/users");
}
