"use server";

import { revalidatePath } from "next/cache";
import { createAdminUser, deleteAdminUser, updateAdminUser } from "@/lib/api";

export async function addUserAction(formData: FormData) {
  const email = formData.get("email") as string;
  const displayName = formData.get("displayName") as string;
  const role = formData.get("role") as string;

  await createAdminUser({ email, displayName, role });
  revalidatePath("/admin/users");
}

export async function toggleUserActiveAction(id: string, isActive: boolean) {
  await updateAdminUser(id, { isActive });
  revalidatePath("/admin/users");
}

export async function changeRoleAction(id: string, role: string) {
  await updateAdminUser(id, { role });
  revalidatePath("/admin/users");
}

export async function removeUserAction(id: string) {
  await deleteAdminUser(id);
  revalidatePath("/admin/users");
}
