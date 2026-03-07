"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/access-control";
import { updateClassificationRule } from "@/lib/api";

export async function updateRuleAction(
  category: string,
  data: {
    keywords: string[];
    excludeKeywords: string[];
    patterns: string[];
    description: string;
    isActive: boolean;
  },
) {
  await requireAdmin();
  await updateClassificationRule(category, data);
  revalidatePath("/admin/ai-settings");
}
