"use server";

import { testClassification } from "@/lib/api";
import type { TestClassificationResult } from "@/lib/types";

export async function testClassifyAction(message: string): Promise<TestClassificationResult> {
  return testClassification(message);
}
