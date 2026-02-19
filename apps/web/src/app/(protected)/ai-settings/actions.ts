"use server";

import { revalidatePath } from "next/cache";
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
  await updateClassificationRule(category, data);
  revalidatePath("/ai-settings");
}
