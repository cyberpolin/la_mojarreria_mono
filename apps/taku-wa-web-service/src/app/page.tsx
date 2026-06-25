const workflow = [
  {
    step: "01",
    title: "Create a connection",
    detail:
      "Provision a WhatsApp phone session with a developer-defined connectionId.",
  },
  {
    step: "02",
    title: "Pair with QR",
    detail:
      "Fetch a QR image and let your customer pair their phone inside your product.",
  },
  {
    step: "03",
    title: "Send and receive",
    detail:
      "Send messages through the API and receive inbound messages on webhooks.",
  },
];

const endpoints = [
  ["POST", "/v1/public/signup", "Create a free developer account."],
  ["GET", "/v1/account/me", "Read account limits and usage."],
  ["GET", "/v1/account/connections", "List your WhatsApp connections."],
  ["GET", "/v1/account/connections/:id/qr", "Read QR payload and image."],
  ["POST", "/v1/account/connections/:id/messages", "Send text messages."],
  ["POST", "/v1/account/webhooks/subscriptions", "Receive inbound events."],
];

const useCases = [
  "Customer support inboxes",
  "CRM notifications",
  "Booking confirmations",
  "Order status updates",
  "Automation platforms",
  "Internal business tools",
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Try the bridge with one WhatsApp connection.",
    features: ["1 connection", "100 messages/day", "Webhooks"],
    cta: "Start today",
    href: "/signup",
  },
  {
    name: "Basic",
    price: "$9/mo",
    description: "For testing and prototypes.",
    features: [
      "1 connection",
      "Send messages",
      "Receive messages",
      "Webhooks",
      "Community support",
    ],
    cta: "Pay $9",
    href: "mailto:sales@taku.lat?subject=Start%20TAKU%20WA%20Basic",
  },
  {
    name: "Developer",
    price: "$29/mo",
    description: "Build WhatsApp into your own application.",
    features: [
      "Up to 10 connections",
      "Connection lifecycle API",
      "Webhooks",
      "Conversation history",
      "Auto reconnect",
      "Email support",
    ],
    cta: "Pay $29",
    href: "mailto:sales@taku.lat?subject=Start%20TAKU%20WA%20Developer",
  },
  {
    name: "Platform",
    price: "$99/mo",
    description: "For SaaS teams that need tenant-aware WhatsApp transport.",
    features: [
      "Up to 50 connections",
      "Multi-tenant management",
      "Priority webhooks",
      "Operational support",
      "TAKU Control integration",
    ],
    cta: "Pay $99",
    href: "mailto:sales@taku.lat?subject=Start%20TAKU%20WA%20Platform",
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "Dedicated WhatsApp infrastructure for larger platforms.",
    features: [
      "Unlimited connections",
      "Dedicated infrastructure",
      "SLA",
      "White-label options",
    ],
    cta: "Contact sales",
    href: "mailto:sales@taku.lat?subject=TAKU%20WA%20Enterprise",
  },
];

function CodeBlock() {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-xl shadow-slate-950/10">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="text-xs text-slate-500">send-message.sh</span>
      </div>
      <pre className="overflow-x-auto p-5 text-xs leading-6 text-slate-200">
        <code>{`curl -X POST https://api.wa.taku.lat/v1/account/connections/wa_abc123/messages \\
  -H "content-type: application/json" \\
  -H "x-api-key: $TAKU_WA_API_KEY" \\
  -d '{
    "to": "5219931234567",
    "text": "Your order is ready."
  }'`}</code>
      </pre>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-emerald-950/10">
      <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              TAKU WA
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              client_001
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            connected
          </span>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Pairing QR</p>
            <div className="mt-4 grid aspect-square grid-cols-5 gap-1 rounded-lg bg-white p-2">
              {Array.from({ length: 25 }).map((_, index) => (
                <span
                  key={index}
                  className={`rounded-sm ${
                    [0, 1, 2, 5, 10, 12, 14, 18, 20, 22, 23, 24].includes(index)
                      ? "bg-slate-950"
                      : index % 3 === 0
                        ? "bg-emerald-600"
                        : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
              QR disappears after the phone is paired.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Webhook stream</p>
              <span className="text-xs font-medium text-emerald-700">live</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                [
                  "message.received",
                  "5219931234567",
                  "Hola, sigue disponible?",
                ],
                ["message.sent", "5219931234567", "Claro, te confirmo ahora."],
                ["status.changed", "client_001", "connection open"],
              ].map(([event, phone, text]) => (
                <div
                  key={`${event}-${text}`}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-slate-950">
                      {event}
                    </span>
                    <span className="text-xs text-slate-500">{phone}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a
          href="#"
          className="text-sm font-bold tracking-[0.2em] text-slate-950"
        >
          TAKU
        </a>
        <div className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <a href="#workflow" className="hover:text-slate-950">
            Workflow
          </a>
          <a href="#api" className="hover:text-slate-950">
            API
          </a>
          <a href="#pricing" className="hover:text-slate-950">
            Pricing
          </a>
          <a href="/login" className="hover:text-slate-950">
            Login
          </a>
        </div>
        <a
          href="/signup"
          className="rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Start today
        </a>
      </nav>

      <section className="mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-8 md:grid-cols-[0.95fr_1.05fr] md:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            WhatsApp API for developers
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 md:text-7xl">
            Ship WhatsApp without running WhatsApp sockets.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            TAKU WhatsApp Bridge gives your app phone pairing, message sending,
            conversation history, and inbound webhooks behind a clean developer
            API.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#api"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Explore the API
            </a>
            <a
              href="/status"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-800 hover:border-slate-950"
            >
              Check status
            </a>
          </div>
        </div>
        <ProductPreview />
      </section>

      <section
        id="workflow"
        className="border-y border-slate-200 bg-white py-20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Integration flow
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              One API for the full phone lifecycle.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {workflow.map((item) => (
              <article
                key={item.step}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <span className="text-sm font-bold text-emerald-700">
                  {item.step}
                </span>
                <h3 className="mt-6 text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="api" className="py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 md:grid-cols-[0.9fr_1.1fr] md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Developer surface
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Straightforward endpoints for pairing and messaging.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Use one connection per WhatsApp phone. Store the `connectionId` in
              your app, then send messages and receive events through webhooks.
            </p>
            <div className="mt-8 grid gap-3">
              {endpoints.map(([method, path, detail]) => (
                <div
                  key={path}
                  className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[80px_1fr]"
                >
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {method}
                  </span>
                  <div>
                    <p className="font-mono text-sm text-slate-950">{path}</p>
                    <p className="mt-1 text-sm text-slate-500">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="self-start md:sticky md:top-6">
            <CodeBlock />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Built for your product
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Add WhatsApp transport without changing your business model.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {useCases.map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Plans
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Start with one phone. Scale to a platform.
            </h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className="flex rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex w-full flex-col">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {plan.name}
                  </h3>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">
                    {plan.price}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {plan.description}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.href}
                    className={`mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold ${
                      plan.price === "Free"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border border-slate-300 text-slate-800 hover:border-slate-950"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 px-4 py-10 text-white md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[0.2em]">TAKU</p>
            <p className="mt-2 text-sm text-slate-400">
              WhatsApp Bridge for developer products.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-300">
            <a href="mailto:sales@taku.lat" className="hover:text-white">
              sales@taku.lat
            </a>
            <a href="#api" className="hover:text-white">
              API
            </a>
            <a href="#workflow" className="hover:text-white">
              Workflow
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
