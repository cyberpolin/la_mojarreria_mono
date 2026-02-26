import Link from "next/link";

export default function NewDailyClosePlaceholderPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">
          Create Daily Close
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Daily close creation is currently handled in mobile. This web flow is
          pending implementation.
        </p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex h-10 items-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700"
        >
          Back dashboard
        </Link>
      </section>
    </main>
  );
}
