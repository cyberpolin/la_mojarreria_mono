"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAdminSession,
  getAppSession,
  saveOwnerModeSession,
  type WorkspaceSession,
} from "@/lib/auth";
import { takuAdminApi, takuAdminList } from "@/lib/taku-api";

type AdminWorkspace = {
  id: string;
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      const session = getAppSession();
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      if (session.sessionType !== "client") {
        try {
          const workspaces = await takuAdminList<AdminWorkspace>(
            "/admin/workspaces?pageSize=1",
          );
          const workspace = workspaces[0];
          if (!workspace) {
            router.replace("/admin");
            return;
          }
          const ownerSession = await takuAdminApi<WorkspaceSession>(
            `/admin/workspaces/${workspace.id}/owner-session`,
            { method: "POST" },
          );
          saveOwnerModeSession(ownerSession);
          if (!cancelled) setIsChecking(false);
          return;
        } catch {
          router.replace("/admin");
          return;
        }
      }

      if (!cancelled) setIsChecking(false);
    }

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (isChecking) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 px-4 text-slate-950">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700">
          Preparando vista owner...
        </div>
      </main>
    );
  }

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-3 text-slate-950 md:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-end">
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
