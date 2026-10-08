"use client";

import { useRouter } from "next/navigation";

export function NumberBreadcrumb({
  accountId,
  accountName,
  current,
}: {
  accountId?: string;
  accountName?: string;
  current?: string;
}) {
  const router = useRouter();

  return (
    <nav aria-label="Miga de pan">
      <ol className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <li>
          <button
            type="button"
            onClick={() => router.push("/owner")}
            className="min-h-11 font-semibold hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Informacion general
          </button>
        </li>
        <li aria-hidden="true">/</li>
        <li className="font-semibold text-slate-950">Numeros conectados</li>
        {accountName ? (
          <>
            <li aria-hidden="true">/</li>
            {current && accountId ? (
              <li>
                <button
                  type="button"
                  onClick={() => router.push(`/owner/numbers/${accountId}`)}
                  className="min-h-11 font-semibold hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
                >
                  {accountName}
                </button>
              </li>
            ) : (
              <li className="text-slate-700">{accountName}</li>
            )}
          </>
        ) : null}
        {current ? (
          <>
            <li aria-hidden="true">/</li>
            <li className="font-semibold text-slate-950">{current}</li>
          </>
        ) : null}
      </ol>
    </nav>
  );
}
