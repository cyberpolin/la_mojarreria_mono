"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";
import { Button } from "@/components/ui";

const links = [
  { href: "/app", label: "Inicio" },
  { href: "/app/gastos", label: "Gastos" },
  { href: "/app/cierre", label: "Cierre" },
];

export default function BackofficeLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("Restaurante");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(session.restaurant.name);
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">
        Cargando...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Backoffice
            </p>
            <h1 className="mt-2 text-lg font-semibold">{name}</h1>
          </div>
          <nav className="grid gap-1 p-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${
                  pathname === link.href
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </aside>
        <section>
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 md:px-6">
            <p className="text-sm font-semibold">TAKU Restaurant</p>
            <Button
              variant="ghost"
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
            >
              Salir
            </Button>
          </header>
          <div className="p-4 md:p-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
