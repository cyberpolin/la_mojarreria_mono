"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Console" },
  { href: "/map", label: "Map" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/close-reports", label: "Close Reports" },
  { href: "/expenses", label: "Expenses" },
  { href: "/cost-control", label: "Cost Control" },
  { href: "/team-control", label: "Team Control" },
  { href: "/products", label: "Products" },
  { href: "/active-promos", label: "Active Promos" },
  { href: "/sync-logs", label: "Sync Logs" },
  { href: "/admin/error-logs", label: "Error Logs" },
  { href: "/weekly", label: "Weekly" },
  { href: "/ui-system", label: "UI System" },
];

const productionLinks = new Set([
  "/cost-control",
  "/close-reports",
  "/expenses",
  "/weekly",
]);

const isLocalEnv =
  process.env.NEXT_PUBLIC_ENV === "local" ||
  (!process.env.NEXT_PUBLIC_ENV && process.env.NODE_ENV === "development");

export function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();
  const visibleLinks = isLocalEnv
    ? links
    : links.filter((link) => productionLinks.has(link.href));

  return (
    <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
      {visibleLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-slate-50"
        >
          {link.label}
        </Link>
      ))}

      <button
        type="button"
        aria-label="Open costs context menu"
        onClick={() => {
          if (pathname === "/cost-control") {
            window.dispatchEvent(new CustomEvent("mojarreria:open-costs-menu"));
            return;
          }
          router.push("/cost-control?openMenu=1");
        }}
        className="ml-auto h-8 w-8 rounded-lg border border-slate-700 bg-slate-900 text-sm text-slate-100 hover:bg-slate-800"
      >
        ⋮
      </button>
    </nav>
  );
}
