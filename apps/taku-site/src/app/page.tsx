const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Para probar la plataforma y operar una linea pequena.",
    cta: "Crear cuenta gratis",
    href: "/signup",
    featured: false,
    details: [
      "1 numero de WhatsApp",
      "2 agentes",
      "Inbox compartido",
      "Horarios y mensaje fuera de horario",
      "Hasta 3 reglas automaticas",
      "Dashboard basico",
    ],
  },
  {
    name: "Starter",
    price: "$19/mes",
    description: "Ideal para restaurantes, consultorios, talleres y tiendas.",
    cta: "Empezar Starter",
    href: "/signup",
    featured: false,
    details: [
      "2 numeros de WhatsApp",
      "5 agentes",
      "Dashboard completo",
      "20 reglas automaticas",
      "Etiquetas y respuestas rapidas",
      "Soporte por email",
    ],
  },
  {
    name: "Business",
    price: "$59/mes",
    description: "El plan recomendado para equipos que ya atienden volumen.",
    cta: "Elegir Business",
    href: "/signup",
    featured: true,
    details: [
      "5 numeros de WhatsApp",
      "20 agentes",
      "IA integrada",
      "API publica",
      "Reportes avanzados",
      "Automatizaciones ilimitadas",
    ],
  },
  {
    name: "Enterprise",
    price: "$149/mes",
    description: "Para empresas con operacion amplia e integraciones.",
    cta: "Hablar con ventas",
    href: "/signup",
    featured: false,
    details: [
      "Numeros practicamente ilimitados",
      "Agentes ilimitados",
      "API completa",
      "SLA",
      "Soporte de prioridad alta",
      "Integraciones personalizadas",
    ],
  },
];

const comparison = [
  ["Precio", "$0", "$19/mes", "$59/mes", "$149/mes"],
  ["Workspaces", "1", "1", "1", "1"],
  ["Numeros de WhatsApp", "1", "2", "5", "Ilimitados*"],
  ["Agentes", "2", "5", "20", "Ilimitados*"],
  ["Conversaciones", "Si", "Si", "Si", "Si"],
  ["Inbox compartido", "Si", "Si", "Si", "Si"],
  ["Respuestas manuales", "Si", "Si", "Si", "Si"],
  ["Horarios", "Si", "Si", "Si", "Si"],
  ["Mensaje fuera de horario", "Si", "Si", "Si", "Si"],
  ["Reglas por palabras clave", "3", "20", "Ilimitadas", "Ilimitadas"],
  ["Bot IA", "-", "Opcional", "Si", "Si"],
  ["Dashboard", "Basico", "Completo", "Completo", "Completo"],
  ["Reportes", "-", "Basicos", "Avanzados", "Avanzados"],
  ["Soporte", "Comunidad", "Email", "Prioritario", "Prioridad alta"],
  ["API publica", "-", "-", "Si", "Si"],
];

const useCases = [
  "Restaurantes",
  "Clinicas",
  "Dentistas",
  "Constructoras",
  "Talleres",
  "Ferreterias",
  "Tiendas",
  "Despachos",
];

const addOns = [
  "Numero adicional: $10/mes por numero.",
  "Agente adicional: $5/mes en Starter y Business.",
  "Bot IA avanzado: desde $20/mes + costo del modelo.",
  "Implementacion y capacitacion como servicio unico.",
  "Desarrollo de integraciones bajo cotizacion.",
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

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
          <span className="text-sm font-bold tracking-[0.24em]">TAKU</span>
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/login"
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Login
          </a>
          <a
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Crear cuenta
          </a>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.05fr_0.95fr] md:px-6 md:pb-20 md:pt-12">
        <div className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            SaaS para WhatsApp Business
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            Centraliza y automatiza la atencion de WhatsApp de tu negocio.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            TAKU permite atender uno o varios numeros de WhatsApp Business desde
            una sola plataforma web, con inbox compartido, horarios,
            automatizaciones simples y control para equipos.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              Probar gratis
              <ArrowIcon />
            </a>
            <a
              href="#planes"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              Ver planes
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-950/10">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Operacion diaria
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  Inbox compartido
                </p>
              </div>
              <img
                src="/taku.png"
                alt=""
                className="h-12 w-12 rounded-xl border border-slate-200 bg-white"
              />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Ventas", "+52 993 120 4488", "Conectado"],
                ["Soporte", "+52 993 204 7711", "Fuera de horario"],
                ["Sucursal Centro", "+52 993 775 0091", "Bot activo"],
              ].map(([name, phone, status]) => (
                <div
                  key={phone}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{phone}</p>
                    </div>
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                      {status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 md:grid-cols-4 md:px-6">
          {[
            [
              "No pierdas conversaciones",
              "Historial centralizado para todo el equipo.",
            ],
            [
              "Responde desde navegador",
              "Tu equipo atiende desde cualquier computadora.",
            ],
            [
              "Cubre fuera de horario",
              "Mensajes automaticos cuando nadie esta disponible.",
            ],
            [
              "Crece por modulos",
              "IA, API e integraciones cuando el negocio lo necesite.",
            ],
          ].map(([title, text]) => (
            <article
              key={title}
              className="rounded-lg border border-slate-200 bg-slate-50 p-5"
            >
              <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white">
                <CheckIcon />
              </div>
              <h2 className="font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Para negocios reales
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            Pensado para empresas pequenas y medianas que atienden por WhatsApp.
          </h2>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {useCases.map((useCase) => (
            <span
              key={useCase}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            >
              {useCase}
            </span>
          ))}
        </div>
      </section>

      <section id="planes" className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Planes
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Empieza gratis y actualiza cuando tu operacion crezca.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-600">
              Precios mensuales. Los limites ilimitados estan sujetos a
              politicas de uso razonable.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={
                  plan.featured
                    ? "rounded-lg border-2 border-slate-950 bg-slate-950 p-6 text-white"
                    : "rounded-lg border border-slate-200 bg-slate-50 p-6"
                }
              >
                <p
                  className={
                    plan.featured
                      ? "text-sm font-semibold text-slate-300"
                      : "text-sm font-semibold text-slate-500"
                  }
                >
                  {plan.name}
                </p>
                <p className="mt-3 text-3xl font-semibold">{plan.price}</p>
                <p
                  className={
                    plan.featured
                      ? "mt-3 text-sm leading-6 text-slate-300"
                      : "mt-3 text-sm leading-6 text-slate-600"
                  }
                >
                  {plan.description}
                </p>
                <a
                  href={plan.href}
                  className={
                    plan.featured
                      ? "mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                      : "mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  }
                >
                  {plan.cta}
                </a>
                <ul className="mt-6 grid gap-3 text-sm">
                  {plan.details.map((detail) => (
                    <li key={detail} className="flex gap-2">
                      <span className="mt-0.5">
                        <CheckIcon />
                      </span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-950 text-white">
              <tr>
                <th className="px-4 py-4 font-semibold">Caracteristica</th>
                <th className="px-4 py-4 font-semibold">Free</th>
                <th className="px-4 py-4 font-semibold">Starter</th>
                <th className="px-4 py-4 font-semibold">Business</th>
                <th className="px-4 py-4 font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {comparison.map(
                ([feature, free, starter, business, enterprise]) => (
                  <tr key={feature}>
                    <th className="bg-slate-50 px-4 py-3 font-semibold text-slate-950">
                      {feature}
                    </th>
                    <td className="px-4 py-3 text-slate-700">{free}</td>
                    <td className="px-4 py-3 text-slate-700">{starter}</td>
                    <td className="px-4 py-3 text-slate-700">{business}</td>
                    <td className="px-4 py-3 text-slate-700">{enterprise}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          * Sujeto a politicas de uso razonable.
        </p>
      </section>

      <section className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 md:grid-cols-[0.9fr_1.1fr] md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Servicios adicionales
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Complementos para adaptar TAKU a tu operacion.
            </h2>
          </div>
          <div className="grid gap-3">
            {addOns.map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white">
                  <CheckIcon />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <div className="rounded-2xl bg-slate-950 px-6 py-10 text-white md:px-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                Empieza hoy
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold">
                Crea una cuenta gratis y conecta tu primer WhatsApp.
              </h2>
            </div>
            <a
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-200"
            >
              Crear cuenta gratis
              <ArrowIcon />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
