"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredSession, type TakuSession } from "./session";

export default function HomePage() {
  const [session, setSession] = useState<TakuSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    setSession(getStoredSession()?.session ?? null);
    setSessionChecked(true);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-10 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          TAKU
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-50">
          WhatsApp business automation console
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
          Manage client businesses, WhatsApp phone connections, bots, schedules,
          and bot assignments through the TAKU backoffice.
        </p>

        {sessionChecked && session ? (
          <p className="mt-5 text-sm text-slate-500">
            Signed in as {session.name}.
          </p>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {sessionChecked && session ? (
            <>
              <Link
                href="/admin"
                className="rounded-lg border border-slate-700 bg-slate-100 p-5 text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                <span className="block text-base font-semibold">
                  Open Admin
                </span>
                <span className="mt-2 block text-sm text-slate-700">
                  Continue with your active backoffice session.
                </span>
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                <span className="block text-base font-semibold">Read Docs</span>
                <span className="mt-2 block text-sm text-slate-400">
                  Review how the current solution works.
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border border-slate-700 bg-slate-100 p-5 text-slate-950 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                <span className="block text-base font-semibold">Sign In</span>
                <span className="mt-2 block text-sm text-slate-700">
                  Start a TAKU user session.
                </span>
              </Link>
              <Link
                href="/onboarding"
                className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                <span className="block text-base font-semibold">
                  Start Onboarding
                </span>
                <span className="mt-2 block text-sm text-slate-400">
                  Set up a client phone, starter bot, and assignment.
                </span>
              </Link>
              <Link
                href="/docs"
                className="rounded-lg border border-slate-800 bg-slate-900 p-5 text-slate-100 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
              >
                <span className="block text-base font-semibold">Read Docs</span>
                <span className="mt-2 block text-sm text-slate-400">
                  Review what is hooked, what is mocked, and next steps.
                </span>
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
