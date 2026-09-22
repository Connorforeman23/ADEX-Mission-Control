"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Segmented from "@/components/Segmented";

/**
 * Mine / Everyone, for the Dashboard.
 *
 * The Dashboard is a server page, so the choice lives in the URL (?scope=mine)
 * and the page re-renders with the right data. The last choice is remembered
 * per person and restored on arrival, so an account manager lands on their own
 * view and Steve lands on the whole business.
 */
export default function ScopeToggle({ scope }: { scope: "mine" | "all" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Restore the remembered choice when arriving with nothing asked for.
  useEffect(() => {
    if (params.get("scope")) return;
    try {
      const stored = localStorage.getItem("adex-dashboard-scope");
      if (stored === "mine" || stored === "all") {
        if (stored !== scope) router.replace(`${pathname}?scope=${stored}`);
      }
    } catch {
      /* private windows and blocked storage are fine — keep the default */
    }
  }, [params, pathname, router, scope]);

  function choose(next: "mine" | "all") {
    try {
      localStorage.setItem("adex-dashboard-scope", next);
    } catch {
      /* not remembering is not worth failing over */
    }
    router.push(`${pathname}?scope=${next}`);
  }

  return (
    <Segmented<"mine" | "all">
      label="Whose work"
      value={scope}
      onChange={choose}
      options={[
        { value: "mine", label: "Mine" },
        { value: "all", label: "Everyone" },
      ]}
    />
  );
}
