"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

const links = [
  { href: "/", label: "Console" },
  { href: "/map", label: "Map" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/close-reports", label: "Close Reports" },
  { href: "/expenses", label: "Expenses" },
  { href: "/attendance", label: "Attendance" },
  { href: "/restaurant-business-hour", label: "Business Hours" },
  { href: "/cost-control", label: "Cost Control" },
  { href: "/team-control", label: "Team Control" },
  { href: "/products", label: "Products" },
  { href: "/active-promos", label: "Active Promos" },
  { href: "/wa-chat", label: "WA Chat" },
  { href: "/wa-received-messages", label: "WA Received" },
  { href: "/autoresponse", label: "Auto-response" },
  { href: "/service-logs", label: "Service Logs" },
  { href: "/docs/wa-service", label: "WA Docs" },
  { href: "/sync-logs", label: "Sync Logs" },
  { href: "/admin/error-logs", label: "Error Logs" },
  { href: "/weekly", label: "Weekly" },
  { href: "/ui-system", label: "UI System" },
];

const productionLinks = new Set([
  "/cost-control",
  "/close-reports",
  "/expenses",
  "/attendance",
  "/wa-chat",
  "/wa-received-messages",
  "/autoresponse",
  "/restaurant-business-hour",
  "/service-logs",
  "/docs/wa-service",
  "/weekly",
]);

const isLocalEnv =
  process.env.NEXT_PUBLIC_ENV === "local" ||
  (!process.env.NEXT_PUBLIC_ENV && process.env.NODE_ENV === "development");

const EXPENSES_MENU_ORDER_KEY = "MOJARRERIA_EXPENSES_MENU_ORDER_V1";
const LONG_PRESS_MS = 450;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const reorderHref = (
  order: string[],
  draggedHref: string,
  targetHref: string,
) => {
  const fromIndex = order.indexOf(draggedHref);
  const toIndex = order.indexOf(targetHref);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;

  const nextOrder = [...order];
  nextOrder.splice(fromIndex, 1);
  nextOrder.splice(toIndex, 0, draggedHref);
  return nextOrder;
};

export function HeaderNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [expensesMenuOpen, setExpensesMenuOpen] = useState(false);
  const [expensesMenuOrder, setExpensesMenuOrder] = useState<string[]>([]);
  const [expensesMenuArranging, setExpensesMenuArranging] = useState(false);
  const [draggedHref, setDraggedHref] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [suppressClickHref, setSuppressClickHref] = useState<string | null>(
    null,
  );
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrangingRef = useRef(false);
  const draggedHrefRef = useRef<string | null>(null);
  const suppressClickHrefRef = useRef<string | null>(null);
  const visibleLinks = isLocalEnv
    ? links
    : links.filter((link) => productionLinks.has(link.href));
  const visibleHrefs = useMemo(
    () => visibleLinks.map((link) => link.href),
    [visibleLinks],
  );
  const orderedExpensesLinks = useMemo(() => {
    const orderedHrefs = [
      ...expensesMenuOrder.filter((href) => visibleHrefs.includes(href)),
      ...visibleHrefs.filter((href) => !expensesMenuOrder.includes(href)),
    ];

    return orderedHrefs
      .map((href) => visibleLinks.find((link) => link.href === href))
      .filter((link): link is (typeof visibleLinks)[number] => Boolean(link));
  }, [expensesMenuOrder, visibleHrefs, visibleLinks]);
  const isExpensesPage = pathname === "/expenses";

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(EXPENSES_MENU_ORDER_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as unknown;
      if (Array.isArray(parsed)) {
        setExpensesMenuOrder(
          parsed.filter((href): href is string => typeof href === "string"),
        );
      }
    } catch {
      // Ignore invalid local menu order.
    }
  }, []);

  useEffect(() => {
    if (expensesMenuOrder.length === 0) return;
    window.localStorage.setItem(
      EXPENSES_MENU_ORDER_KEY,
      JSON.stringify(expensesMenuOrder),
    );
  }, [expensesMenuOrder]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && Boolean(navigator.standalone));
    setAppInstalled(isStandalone);

    const media = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      setAppInstalled(media.matches);
    };
    media.addEventListener("change", handleDisplayModeChange);
    return () => media.removeEventListener("change", handleDisplayModeChange);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        setAppInstalled(true);
      }
      setInstallPrompt(null);
      return;
    }

    window.alert("Use your browser menu, then choose Add to Home Screen.");
  };

  const clearLongPressTimer = () => {
    if (!longPressTimer.current) return;
    clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  const startLongPress = (
    event: PointerEvent<HTMLButtonElement>,
    href: string,
  ) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      arrangingRef.current = true;
      draggedHrefRef.current = href;
      suppressClickHrefRef.current = href;
      setExpensesMenuOpen(true);
      setExpensesMenuArranging(true);
      setDraggedHref(href);
      setSuppressClickHref(href);
    }, LONG_PRESS_MS);
  };

  const moveDraggedItem = (event: PointerEvent<HTMLButtonElement>) => {
    const currentDraggedHref = draggedHrefRef.current;
    if (!arrangingRef.current || !currentDraggedHref) return;
    event.preventDefault();

    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-expenses-nav-href]");
    const targetHref = target?.dataset.expensesNavHref;
    if (!targetHref || targetHref === currentDraggedHref) return;

    setExpensesMenuOrder((current) => {
      const baseOrder =
        current.length > 0
          ? [
              ...current.filter((href) => visibleHrefs.includes(href)),
              ...visibleHrefs.filter((href) => !current.includes(href)),
            ]
          : visibleHrefs;
      return reorderHref(baseOrder, currentDraggedHref, targetHref);
    });
  };

  const stopDraggingItem = (href?: string) => {
    const shouldNavigate =
      Boolean(href) &&
      !arrangingRef.current &&
      suppressClickHrefRef.current !== href;
    clearLongPressTimer();
    draggedHrefRef.current = null;
    setDraggedHref(null);
    if (shouldNavigate && href) {
      setExpensesMenuOpen(false);
      router.push(href);
    }
  };

  const navLinks = visibleLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      onClick={() => setExpensesMenuOpen(false)}
      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 hover:text-slate-50"
    >
      {link.label}
    </Link>
  ));
  const expensesMobileNavLinks = orderedExpensesLinks.map((link) => (
    <button
      key={link.href}
      type="button"
      data-expenses-nav-href={link.href}
      aria-pressed={draggedHref === link.href}
      onPointerDown={(event) => startLongPress(event, link.href)}
      onPointerMove={moveDraggedItem}
      onPointerUp={() => stopDraggingItem(link.href)}
      onPointerCancel={() => stopDraggingItem()}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (
          arrangingRef.current ||
          expensesMenuArranging ||
          suppressClickHrefRef.current === link.href ||
          suppressClickHref === link.href
        ) {
          suppressClickHrefRef.current = null;
          setSuppressClickHref(null);
          return;
        }
      }}
      className={`flex aspect-square touch-none select-none items-center justify-center rounded-lg border p-1.5 text-center text-sm font-medium leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 ${
        draggedHref === link.href
          ? "scale-[0.98] border-slate-400 bg-slate-800 text-slate-50"
          : expensesMenuArranging
            ? "border-slate-600 bg-slate-900 text-slate-100"
            : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-slate-50"
      }`}
    >
      {link.label}
    </button>
  ));
  const installAppTile = appInstalled ? null : (
    <button
      type="button"
      onClick={promptInstall}
      className="flex aspect-square touch-none select-none items-center justify-center rounded-lg border border-slate-600 bg-slate-100 p-1.5 text-center text-sm font-semibold leading-tight text-slate-950 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400"
    >
      Save as Web App
    </button>
  );
  const costsButton = (
    <button
      type="button"
      aria-label="Open costs context menu"
      onClick={() => {
        setExpensesMenuOpen(false);
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
  );

  if (isExpensesPage) {
    return (
      <nav className="mx-auto w-full max-w-7xl px-4 py-3 md:flex md:flex-wrap md:items-center md:gap-2 md:px-6">
        <button
          type="button"
          aria-expanded={expensesMenuOpen}
          aria-controls="expenses-mobile-nav"
          onClick={() => {
            if (expensesMenuArranging) {
              arrangingRef.current = false;
              draggedHrefRef.current = null;
              suppressClickHrefRef.current = null;
              setExpensesMenuArranging(false);
              setDraggedHref(null);
              setSuppressClickHref(null);
              return;
            }
            setExpensesMenuOpen((open) => !open);
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-left transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:hidden"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {expensesMenuArranging ? "Arrange Menu" : "Menu"}
          </span>
          <span className="text-sm font-medium text-slate-100">
            {expensesMenuArranging
              ? "Done"
              : expensesMenuOpen
                ? "Hide"
                : "Show"}
          </span>
        </button>

        <div
          id="expenses-mobile-nav"
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out md:hidden ${
            expensesMenuOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0">
            <div className="grid grid-cols-2 gap-4 py-5">
              {installAppTile}
              {expensesMobileNavLinks}
            </div>
          </div>
        </div>

        <div className="hidden w-full flex-wrap items-center gap-2 md:flex">
          {navLinks}
          {costsButton}
        </div>
      </nav>
    );
  }

  return (
    <nav className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 py-3 md:px-6">
      {navLinks}
      {costsButton}
    </nav>
  );
}
