import { Button, Card } from "@/components/ui";

export default function UiSystemPage() {
  return (
    <main className="mx-auto grid max-w-4xl gap-6 p-6">
      <section>
        <h1 className="text-2xl font-semibold">Typography</h1>
        <p className="mt-2 text-lg font-semibold">Section title</p>
        <p className="mt-2 text-sm text-slate-700">Body</p>
        <p className="mt-1 text-xs text-slate-500">Caption</p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Colors</h2>
        <div className="mt-3 flex gap-2">
          {["bg-slate-950", "bg-slate-700", "bg-slate-300", "bg-slate-50"].map(
            (tone) => (
              <div
                key={tone}
                className={`h-11 w-11 rounded-lg border border-slate-200 ${tone}`}
              />
            ),
          )}
        </div>
      </section>
      <section className="grid gap-2">
        <h2 className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Inputs</h2>
        <label className="mt-3 grid max-w-sm gap-2 text-sm font-medium">
          Concepto
          <input
            className="min-h-11 rounded-lg border border-slate-300 px-3"
            defaultValue="Hielo"
          />
        </label>
        <label className="mt-3 grid max-w-sm gap-2 text-sm font-medium">
          Error
          <input
            aria-invalid
            className="min-h-11 rounded-lg border border-slate-950 px-3"
            defaultValue=""
          />
          <span className="text-xs text-slate-700">Campo requerido</span>
        </label>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Cards</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Card>
            <p className="font-semibold">Default</p>
            <p className="mt-2 text-sm text-slate-600">Body</p>
          </Card>
          <Card>
            <p className="font-semibold">Empty</p>
            <p className="mt-2 text-sm text-slate-500">Aun no hay gastos.</p>
          </Card>
        </div>
      </section>
    </main>
  );
}
