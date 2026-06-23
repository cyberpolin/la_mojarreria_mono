"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

export function HomeStandaloneRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as NavigatorWithStandalone).standalone);

    if (isStandalone && pathname === "/") {
      router.replace("/expenses");
    }
  }, [pathname, router]);

  return null;
}
