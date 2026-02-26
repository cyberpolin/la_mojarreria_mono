export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Web Console</h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Monorepo bootstrap complete. Start building UI from the system page.
        </p>
      </header>
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-2">
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/dashboard"
          >
            Open Operational Dashboard
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/ui-system"
          >
            Open UI System
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/admin/error-logs"
          >
            Open Admin Error Logs
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/sync-logs"
          >
            Open Sync Logs
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/products"
          >
            Open Products
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/cost-control"
          >
            Open Cost Control
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/team-control"
          >
            Open Team Control
          </a>
          <a
            className="text-sm text-slate-200 underline underline-offset-4 hover:text-slate-50"
            href="/weekly"
          >
            Open Weekly Summary
          </a>
        </div>
      </section>
    </main>
  );
}
