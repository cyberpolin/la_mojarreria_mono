const plans = [
  {
    name: "Free",
    price: "$0",
    href: "/signup",
    featured: false,
    details: [
      "1 sucursal",
      "Cierre de caja",
      "Lista de gastos",
      "Inbox de WhatsApp basico",
    ],
  },
  {
    name: "Starter",
    price: "$29/mes",
    href: "/signup?plan=starter",
    featured: false,
    details: [
      "2 sucursales",
      "Pedidos y repartidores",
      "Gastos y cierre",
      "App movil kiosko",
    ],
  },
  {
    name: "Business",
    price: "$79/mes",
    href: "/signup?plan=business",
    featured: true,
    details: [
      "Sucursales ilimitadas",
      "Reportes semanales",
      "Checador",
      "Soporte prioritario",
    ],
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="flex items-center gap-3">
          <img
            src="/taku.png"
            alt="TAKU"
            className="h-10 w-10 rounded-xl border border-slate-200 bg-white"
          />
          <span className="text-sm font-bold tracking-[0.18em]">
            TAKU RESTAURANT
          </span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href="https://taku.lat"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            TAKU
          </a>
          <a
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Login
          </a>
          <a
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Crear cuenta
          </a>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:pt-12">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Producto TAKU para restaurantes
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Opera el restaurante: caja, gastos, pedidos y WhatsApp.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            TAKU Restaurant es el backoffice y la app de piso. TAKU WA y Bot
            siguen siendo la suite de comunicacion. Aqui vive el cierre del dia,
            los gastos y los pedidos a repartidores.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Probar gratis
            </a>
            <a
              href="#planes"
              className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold hover:border-slate-950"
            >
              Ver planes
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Operacion del dia
          </p>
          <div className="mt-4 grid gap-3">
            {[
              ["Cierre de caja", "Conteo de efectivo y banco"],
              ["Gastos", "Concepto y cantidad, sync al API"],
              ["Pedidos WhatsApp", "Aviso al grupo de repartidores"],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="planes"
        className="border-t border-slate-200 bg-white py-16"
      >
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <h2 className="text-2xl font-semibold">Planes</h2>
          <p className="mt-2 text-sm text-slate-600">
            Empieza gratis. Sube de plan cuando abras sucursal o uses la app
            todo el turno.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.featured
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                  {plan.name}
                </p>
                <p className="mt-3 text-3xl font-semibold">{plan.price}</p>
                <ul className="mt-5 grid gap-2 text-sm">
                  {plan.details.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold ${
                    plan.featured
                      ? "bg-white text-slate-950"
                      : "bg-slate-950 text-white"
                  }`}
                >
                  Elegir {plan.name}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
