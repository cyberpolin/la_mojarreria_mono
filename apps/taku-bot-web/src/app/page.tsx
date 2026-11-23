"use client";

import { useEffect, useState } from "react";

const workflow = [
  {
    step: "01",
    title: "Create a bot",
    detail:
      "Define the role, tone, business rules, and fallback behavior for each assistant.",
  },
  {
    step: "02",
    title: "Test replies",
    detail:
      "Run provider smoke tests and prompt tests before attaching a bot to a live phone.",
  },
  {
    step: "03",
    title: "Connect any channel",
    detail:
      "Send inbound customer context from WhatsApp, web chat, SMS, CRM, or your own app.",
  },
];

type EndpointKey =
  | "health"
  | "createAccount"
  | "models"
  | "listAssistants"
  | "createAssistant"
  | "updateAssistant"
  | "chat";

const endpoints: Array<{
  key: EndpointKey;
  method: string;
  path: string;
  detail: string;
  filename: string;
  example: string;
}> = [
  {
    key: "health",
    method: "GET",
    path: "/v1/health",
    detail: "Check bot-service v1 availability.",
    filename: "health.sh",
    example: `curl https://api.bot.taku.lat/v1/health`,
  },
  {
    key: "createAccount",
    method: "POST",
    path: "/v1/public/accounts",
    detail:
      "Create a free account and receive the client token shown one time.",
    filename: "create-account.sh",
    example: `curl -X POST https://api.bot.taku.lat/v1/public/accounts \\
  -H "content-type: application/json" \\
  -d '{
    "client_id": "bot_account_abc123"
  }'

# Expected response:
# {
#   "ok": true,
#   "billing": {
#     "client_id": "bot_account_abc123",
#     "tier": "free",
#     "status": "active"
#   },
#   "clientToken": "taku_bot_...",
#   "tokenShownOnce": true
# }`,
  },
  {
    key: "models",
    method: "GET",
    path: "/v1/models",
    detail: "List available bot models.",
    filename: "models.sh",
    example: `curl https://api.bot.taku.lat/v1/models \\
  -H "authorization: Bearer $TAKU_CLIENT_TOKEN" \\
  -H "x-taku-client-id: $TAKU_CLIENT_ID"`,
  },
  {
    key: "listAssistants",
    method: "GET",
    path: "/v1/assistants",
    detail: "List reusable assistants available to your account.",
    filename: "list-assistants.sh",
    example: `curl https://api.bot.taku.lat/v1/assistants \\
  -H "authorization: Bearer $TAKU_CLIENT_TOKEN" \\
  -H "x-taku-client-id: $TAKU_CLIENT_ID"

# Expected response:
# {
#   "ok": true,
#   "object": "list",
#   "assistants": [
#     {
#       "id": "asst_...",
#       "name": "Customer assistant",
#       "instructions": "Reply clearly and ask one follow-up question.",
#       "createdAt": "2026-06-30T18:00:00.000Z",
#       "updatedAt": "2026-06-30T18:00:00.000Z"
#     }
#   ]
# }`,
  },
  {
    key: "createAssistant",
    method: "POST",
    path: "/v1/assistants",
    detail: "Create an assistant with a name and reusable instructions.",
    filename: "create-assistant.sh",
    example: `curl -X POST https://api.bot.taku.lat/v1/assistants \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $TAKU_CLIENT_TOKEN" \\
  -H "x-taku-client-id: $TAKU_CLIENT_ID" \\
  -d '{
    "name": "Customer assistant",
    "instructions": "Reply briefly, be helpful, and ask one useful follow-up question."
  }'

# Expected response:
# {
#   "ok": true,
#   "assistant": {
#     "id": "asst_...",
#     "name": "Customer assistant",
#     "instructions": "Reply briefly, be helpful, and ask one useful follow-up question.",
#     "createdAt": "2026-06-30T18:00:00.000Z",
#     "updatedAt": "2026-06-30T18:00:00.000Z"
#   }
# }`,
  },
  {
    key: "updateAssistant",
    method: "PATCH",
    path: "/v1/assistants/:assistant_id",
    detail: "Edit an assistant name or instructions.",
    filename: "update-assistant.sh",
    example: `curl -X PATCH https://api.bot.taku.lat/v1/assistants/asst_123 \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $TAKU_CLIENT_TOKEN" \\
  -H "x-taku-client-id: $TAKU_CLIENT_ID" \\
  -d '{
    "name": "Sales assistant",
    "instructions": "Answer sales questions briefly and collect the customer name."
  }'

# Expected response:
# {
#   "ok": true,
#   "assistant": {
#     "id": "asst_123",
#     "name": "Sales assistant",
#     "instructions": "Answer sales questions briefly and collect the customer name.",
#     "createdAt": "2026-06-30T18:00:00.000Z",
#     "updatedAt": "2026-06-30T18:10:00.000Z"
#   }
# }`,
  },
  {
    key: "chat",
    method: "POST",
    path: "/v1/chat/completions",
    detail:
      "Generate a reply with optional history and assistant instructions.",
    filename: "chat-completion.sh",
    example: `curl -X POST https://api.bot.taku.lat/v1/chat/completions \\
  -H "content-type: application/json" \\
  -H "authorization: Bearer $TAKU_CLIENT_TOKEN" \\
  -H "x-taku-client-id: $TAKU_CLIENT_ID" \\
  -d '{
    "model": "taku-cr",
    "assistant_id": "asst_123",
    "history": [
      { "role": "user", "content": "Hola" },
      { "role": "assistant", "content": "Hola, te puedo ayudar con precios o pedidos." }
    ],
    "messages": [
      { "role": "user", "content": "Hola, cuanto cuesta?" }
    ],
    "temperature": 0.2,
    "max_tokens": 120
  }'

# Expected response:
# {
#   "id": "chatcmpl_...",
#   "object": "chat.completion",
#   "model": "taku-cr",
#   "assistant_id": "asst_123",
#   "choices": [
#     {
#       "index": 0,
#       "message": {
#         "role": "assistant",
#         "content": "Te comparto precios. Que producto necesitas cotizar?"
#       },
#       "finish_reason": "stop"
#     }
#   ]
# }`,
  },
];

const plans = [
  {
    name: "Free",
    price: "$2 included",
    description:
      "Monthly included bot usage for early testing and small flows.",
    estimate: "Usually enough for 100 customers or 500 short conversations.",
    features: [
      "$2 USD usage credit every month",
      "Blocks replies when monthly credit is consumed",
      "Allowance resets on the 1st of each month",
    ],
    cta: "Start free",
    href: "/signup",
  },
  {
    name: "On demand",
    price: "$5 minimum",
    description: "Prepaid balance for production bots with standard usage.",
    estimate: "Usually enough for 250 customers or 1,250 short conversations.",
    features: [
      "$5 USD minimum prepaid top-up",
      "Prepaid credit is consumed by bot replies",
      "Replies stop when prepaid balance is exhausted",
    ],
    cta: "Add $5",
    href: "/payment?plan=on_demand",
  },
  {
    name: "High usage",
    price: "$20 minimum",
    description: "Larger prepaid balance for higher conversation volume.",
    estimate:
      "Usually enough for 1,100 customers or 5,500 short conversations.",
    features: [
      "$20 USD minimum prepaid top-up",
      "TAKU charge with a 10% discount",
      "Best fit for high conversation volume",
    ],
    cta: "Add $20",
    href: "/payment?plan=high_usage",
  },
];

function ProductPreview() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-2xl shadow-emerald-950/10">
      <div className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              TAKU BOT
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              Customer assistant
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            ready
          </span>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Instructions</p>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Reply briefly and clearly.</p>
              <p>Ask one useful follow-up question.</p>
              <p>Escalate when payment or refunds are mentioned.</p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Test conversation</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                Hola, cuanto cuesta?
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
                Te comparto precios. Que producto necesitas cotizar?
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ endpoint }: { endpoint: (typeof endpoints)[number] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 shadow-xl shadow-slate-950/10">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <span className="text-xs text-slate-500">{endpoint.filename}</span>
      </div>
      <pre className="overflow-x-auto p-5 text-xs leading-6 text-slate-200">
        <code>{endpoint.example}</code>
      </pre>
    </div>
  );
}

export default function HomePage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointKey>("chat");
  const [hasSession, setHasSession] = useState(false);
  const activeEndpoint =
    endpoints.find((endpoint) => endpoint.key === selectedEndpoint) ??
    endpoints[2];

  useEffect(() => {
    setHasSession(Boolean(window.localStorage.getItem("TAKU_BOT_SESSION")));
  }, []);

  function logout() {
    window.localStorage.removeItem("TAKU_BOT_SESSION");
    setHasSession(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
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
          {hasSession ? (
            <button
              type="button"
              onClick={logout}
              className="hover:text-slate-950"
            >
              Logout
            </button>
          ) : (
            <a href="/login" className="hover:text-slate-950">
              Login
            </a>
          )}
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
            Customer relations bot API
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] text-slate-950 md:text-7xl">
            Build customer-facing bots for any channel.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            TAKU Bot manages assistant instructions, provider checks, and reply
            generation for customer conversations from any product or channel.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Open console
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Workflow
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            A focused API for customer conversation automation.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
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
              Bot-service API
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Client-facing v1 endpoints for customer conversation automation.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              TAKU Bot currently exposes one public model: `taku-cr`. More
              customer relations models will be added later.
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Client requests use two values: `TAKU_CLIENT_ID` identifies the
              account, and `TAKU_CLIENT_TOKEN` authorizes access. Store the
              token when it is created because it is only shown once.
            </p>
            <div className="mt-8 grid gap-3">
              {endpoints.map((endpoint) => (
                <button
                  key={endpoint.key}
                  type="button"
                  onClick={() => setSelectedEndpoint(endpoint.key)}
                  className={`grid gap-2 rounded-xl border p-4 text-left transition sm:grid-cols-[80px_1fr] ${
                    endpoint.key === selectedEndpoint
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="font-mono text-xs font-bold text-emerald-700">
                    {endpoint.method}
                  </span>
                  <div>
                    <p className="font-mono text-sm text-slate-950">
                      {endpoint.path}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {endpoint.detail}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <CodeBlock endpoint={activeEndpoint} />
        </div>
      </section>

      <section
        id="pricing"
        className="border-t border-slate-200 bg-white py-20"
      >
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">
            Usage credit first, prepaid when you grow.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            TAKU Bot starts with monthly included credit. Production accounts
            use prepaid USD balance, and replies stop when available credit is
            consumed.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
              >
                <h3 className="text-xl font-semibold text-slate-950">
                  {plan.name}
                </h3>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {plan.price}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>
                <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800">
                  {plan.estimate}
                </p>
                <ul className="mt-5 grid gap-2 text-sm text-slate-700">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <a
                  href={plan.href}
                  className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {plan.cta}
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
