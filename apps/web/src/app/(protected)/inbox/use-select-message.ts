"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useSelectMessage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  return useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (id) {
        sp.set("id", id);
      } else {
        sp.delete("id");
      }
      router.replace(`/inbox?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );
}
