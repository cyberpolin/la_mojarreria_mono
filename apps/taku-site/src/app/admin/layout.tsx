"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAdminSession,
  getAdminSession,
  restoreOwnerModeAdminSession,
} from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const session = getAdminSession();
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    restoreOwnerModeAdminSession();
    if (session.requiresPasswordChange) {
      router.replace("/update-password");
      return;
    }
    setIsChecking(false);
  }, [pathname, router]);

  if (isChecking) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-slate-950">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
          Validando sesion admin...
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-3 text-slate-950 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <a href="/admin" className="text-sm font-bold tracking-[0.18em]">
            TAKU ADMIN
          </a>
          <button
            type="button"
            onClick={() => {
              clearAdminSession();
              router.replace("/login");
            }}
            className="text-sm font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Logout
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
