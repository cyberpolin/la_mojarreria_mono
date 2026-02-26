const slateShades = [
  { label: "slate-50", className: "bg-slate-50" },
  { label: "slate-100", className: "bg-slate-100" },
  { label: "slate-200", className: "bg-slate-200" },
  { label: "slate-300", className: "bg-slate-300" },
  { label: "slate-400", className: "bg-slate-400" },
  { label: "slate-500", className: "bg-slate-500" },
  { label: "slate-600", className: "bg-slate-600" },
  { label: "slate-700", className: "bg-slate-700" },
  { label: "slate-800", className: "bg-slate-800" },
  { label: "slate-900", className: "bg-slate-900" },
  { label: "slate-950", className: "bg-slate-950" },
];

export default function UiSystemPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">UI System</h1>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Typography</h2>
        <div className="mt-4 space-y-3">
          <p className="text-2xl font-semibold text-slate-50">
            Page Title text-2xl
          </p>
          <p className="text-lg font-semibold text-slate-100">
            Section Title text-lg
          </p>
          <p className="text-base text-slate-200">
            Body text-base for standard content.
          </p>
          <p className="text-sm text-slate-300">
            Secondary text-sm for support labels.
          </p>
          <p className="text-xs text-slate-400">
            Caption text-xs for metadata.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Colors</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          {slateShades.map((shade) => (
            <div key={shade.label} className="space-y-2">
              <div
                className={`h-16 rounded border border-slate-700 ${shade.className}`}
              />
              <p className="text-xs text-slate-300">{shade.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Buttons</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="h-11 rounded-lg border border-slate-700 bg-slate-100 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
            Primary
          </button>
          <button className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-4 text-sm font-medium text-slate-100 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
            Secondary
          </button>
          <button className="h-11 rounded-lg border border-transparent bg-transparent px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
            Ghost
          </button>
          <button
            disabled
            className="h-11 rounded-lg border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-slate-500"
          >
            Disabled
          </button>
          <button className="h-11 rounded-lg border border-slate-600 bg-slate-700 px-4 text-sm font-medium text-slate-200">
            Loading...
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Inputs</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Text
            <input
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="Type here"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Number
            <input
              type="number"
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Password
            <input
              type="password"
              className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="••••••"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-200">
            Error State
            <input
              className="h-11 rounded-lg border border-slate-500 bg-slate-950 px-3 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              placeholder="Invalid value"
            />
            <span className="text-xs text-slate-400">
              Please provide a valid value.
            </span>
          </label>
          <label className="md:col-span-2 flex flex-col gap-2 text-sm text-slate-200">
            Textarea
            <textarea
              className="min-h-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              placeholder="Write details"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Cards</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Default Card
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Simple informational card body.
            </p>
          </article>
          <button className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-left hover:border-slate-500">
            <h3 className="text-sm font-semibold text-slate-100">
              Clickable Card
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Used for navigable entities.
            </p>
          </button>
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-100">
              Card With Footer
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              Header, body and action row.
            </p>
            <div className="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">
              Updated 2m ago
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Lists / Rows</h2>
        <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-200">
              Tenant: Local Branch Centro
            </span>
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-200">
              Landlord: Main Operator
            </span>
            <span className="text-xs text-slate-400">Owner</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Empty + Loading</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
            <p className="text-sm font-medium text-slate-200">No items yet</p>
            <p className="mt-2 text-xs text-slate-400">
              Create your first record to get started.
            </p>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-800" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">
          Dashboard Primitives
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              KPI Card
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              $2,340.00
            </p>
          </article>
          <article className="rounded-lg border border-slate-600 bg-slate-800 p-4">
            <p className="text-sm font-semibold text-slate-100">Alert (warn)</p>
            <p className="mt-2 text-sm text-slate-300">
              Expenses are above configured threshold.
            </p>
          </article>
          <article className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900"
              />
              <span className="text-sm text-slate-200">
                Actionable checklist item
              </span>
            </label>
          </article>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold text-slate-50">Image Drop</h2>
        <div className="mt-4 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900 p-4">
          <p className="text-sm text-slate-200">ImageDrop</p>
          <p className="mt-1 text-xs text-slate-400">
            Drag/drop images here or select files. 1 to 5 required.
          </p>
          <button className="mt-3 h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 hover:bg-slate-800">
            Select images
          </button>
        </div>
      </section>
    </main>
  );
}
