"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSession } from "@/lib/taku-api";
import { fetchConversations } from "./api";
import { accountStatusLabel, cx, mobileListPath } from "./helpers";
import { MobileAuthGate, MobilePhoneFrame } from "./mobile-shell";
import type { InboxWhatsAppAccount } from "./types";

export function MobileAccountPicker({
  accounts,
}: {
  accounts: InboxWhatsAppAccount[];
}) {
  const router = useRouter();
  const [needsAuth, setNeedsAuth] = useState(false);
  const [unreadByAccount, setUnreadByAccount] = useState<
    Record<string, number>
  >({});

  const loadUnread = useCallback(async () => {
    if (!getWorkspaceSession()) {
      setNeedsAuth(true);
      return;
    }
    setNeedsAuth(false);
    try {
      const rows = await fetchConversations({
        filter: "all",
        search: "",
        accountId: "all",
      });
      const next: Record<string, number> = {};
      for (const row of rows) {
        const accountId = row.whatsappAccount?.id;
        if (!accountId || row.unreadCount <= 0) continue;
        next[accountId] = (next[accountId] ?? 0) + row.unreadCount;
      }
      setUnreadByAccount(next);
    } catch {
      setUnreadByAccount({});
    }
  }, []);

  useEffect(() => {
    void loadUnread();
  }, [loadUnread]);

  if (needsAuth) return <MobileAuthGate next="/conversation-mobile" />;

  return (
    <MobilePhoneFrame>
      <header className="bg-slate-900 px-4 pb-3 pt-4 text-white">
        <h1 className="text-xl font-semibold">WhatsApp</h1>
        <p className="mt-1 text-[13px] text-slate-300">
          Elige el telefono para ver sus chats.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto bg-white">
        {accounts.map((account) => {
          const unread = unreadByAccount[account.id] ?? 0;
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => router.push(mobileListPath(account))}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-300 text-base font-semibold text-slate-700">
                {account.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className={cx(
                      "truncate text-sm",
                      unread > 0
                        ? "font-semibold text-slate-950"
                        : "font-medium text-slate-900",
                    )}
                  >
                    {account.displayName}
                  </p>
                  {unread > 0 ? (
                    <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-semibold text-white">
                      {unread}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-[13px] text-slate-500">
                  {account.phoneNumber ?? "Sin numero"}
                  {` · ${accountStatusLabel(account.status)}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </MobilePhoneFrame>
  );
}
