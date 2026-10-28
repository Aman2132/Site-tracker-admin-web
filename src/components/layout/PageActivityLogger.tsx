"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { externalTarget, pageTitle } from "@/lib/auditLog";
import { flushViews, logView } from "@/lib/viewLog";

/**
 * Feeds the superadmin's page log: every page the admin opens, and every link
 * they follow that leaves the dashboard. Renders nothing. The writing itself
 * (filtering repeats, batching, the hourly cap) is in lib/viewLog.ts.
 */
export function PageActivityLogger() {
  const pathname = usePathname();

  useEffect(() => {
    logView(pathname, pageTitle(pathname));
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const target = anchor ? externalTarget(anchor.href, window.location.origin) : null;
      if (target) logView(target, `Left the dashboard: ${target}`, "external");
    };
    // The tab being hidden or closed is the last chance to send what is still waiting.
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushViews();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
