"use client";

import { useUrlSelection } from "@/hooks/use-url-selection";

export function useSelectMessage() {
  return useUrlSelection("/inbox");
}
