"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-render the server page (fresh price) on an interval and when the tab regains focus. */
export function useAutoRefresh(intervalMs: number) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);
}
