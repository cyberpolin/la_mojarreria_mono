import Link from "next/link";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_API_BASE_URL ?? "http://localhost:3010";

const sections = [
  {
    title: "Current Shape",
    body: [
      "TAKU Web is a Next.js console for managing businesses, WhatsApp phone records, bots, schedules, and bot assignments.",
      "TAKU API Service is a separate Express + TypeScript API. It owns the current TAKU data model and stores records in a local JSON file while we design the production model.",
      "WA Service remains the WhatsApp runtime. It manages WhatsApp sessions, QR pairing, message transport, and bot reply dispatch.",
    ],
  },
  {
    title: "What Is Hooked",
    body: [
      "TAKU Web loads businesses, WhatsApp connections, bots, and bot assignments from TAKU API.",
      "The client-user onboarding wizard at `/onboarding` creates records from the values the user submits. Its fourth step is QR pairing: it creates a phone record, creates an active starter bot, assigns that bot to the phone, requests a WA Service QR, and opens Admin after the phone connects.",
      "Creating a phone in the console persists a WA connection record in TAKU API.",
      "Creating a bot persists a bot record in TAKU API.",
      "Pairing actions in onboarding and admin call TAKU API, and TAKU API calls WA Service for connection creation, start, status, and QR.",
      "Admin can unlink a phone by asking TAKU API to reset the WA Service session and clear the local phone pairing state.",
      "Stopping a phone marks the automation inactive in WA Service. The WhatsApp socket can remain connected, but TAKU bot replies are skipped while active is false.",
      "For incoming messages on TAKU-managed WA connections, WA Service resolves the active bot assignment from TAKU API and sends that bot's instructions to Bot Service.",
      "WA Service enforces the phone active schedule before calling Bot Service. No schedule means always active.",
      "Changing bot status, changing phone state, editing schedules, and assigning bots to phones are persisted through TAKU API.",
      "TAKU API returns account entitlements with businesses. Trial accounts last 30 days, can create one bot, and cannot use schedules. Paid accounts can use all current features.",
      "Suspended client accounts see a blocking payment prompt in Admin. Superowners can still inspect suspended accounts.",
      "Superowners see a Users & Payments panel in Admin with client users, business account status, and the latest stored payment record.",
      "The payment screen at `/payment` renders Mercado Pago Card Payment Brick in TAKU Web, sends only the tokenized card payload to TAKU API, and marks the business as paid when Mercado Pago approves the charge. A local dev mock button remains available in development.",
      "Mercado Pago can also call `POST /v1/billing/mercadopago/webhook`; TAKU API verifies the webhook signature when configured, fetches the payment from Mercado Pago, stores it, and activates the linked business when approved.",
      "Approved Mercado Pago and mock payments are persisted in TAKU API and linked to the business account before the account is activated.",
    ],
  },
  {
    title: "What Is Not Hooked Yet",
    body: [
      "QR and Start are now routed through WA Service, but they require WA Service to be running and configured with matching service credentials.",
      "Bot runtime depends on Bot Service and the configured AI provider being available.",
      "TAKU Web now signs in through TAKU API and sends a bearer session token. Passwords are still development-level shared credentials until real user password storage exists.",
      "Existing local JSON data can contain older test records. A clean TAKU API data file now starts empty instead of seeding demo businesses, phones, bots, or members.",
    ],
  },
];

const endpoints = [
  "GET /v1/businesses",
  "GET /v1/wa-connections",
  "POST /v1/wa-connections",
  "PATCH /v1/wa-connections/:id",
  "POST /v1/wa-connections/:id/pairing/start",
  "GET /v1/wa-connections/:id/pairing/status",
  "GET /v1/wa-connections/:id/pairing/qr",
  "POST /v1/wa-connections/:id/pairing/unlink",
  "GET /v1/wa-connections/by-connection/:connectionId/bot",
  "POST /v1/billing/mercadopago/preference",
  "POST /v1/billing/mercadopago/card-payment",
  "POST /v1/billing/mercadopago/confirm",
  "POST /v1/billing/mercadopago/webhook",
  "POST /v1/billing/mock-payment",
  "GET /v1/payments",
  "GET /v1/members",
  "GET /v1/bots",
  "POST /v1/bots",
  "PATCH /v1/bots/:id",
  "GET /v1/bot-assignments",
  "POST /v1/bot-assignments",
];

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-4">
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-200">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              TAKU Docs
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">
              Current Solution
            </h1>
          </div>
          <Link
            href="/admin"
            className="flex min-h-10 items-center justify-center rounded-lg border border-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
          >
            Console
          </Link>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6 md:px-6">
        <Panel title="Architecture">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-50">TAKU Web</h3>
              <p className="mt-2 text-sm text-slate-400">
                Browser console at `apps/taku-web`. It calls TAKU API directly
                using environment configuration.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-50">TAKU API</h3>
              <p className="mt-2 text-sm text-slate-400">
                Express service at `apps/taku-api-service`. It validates input,
                scopes records, and stores current data.
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h3 className="text-sm font-semibold text-slate-50">
                WA Service
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                WhatsApp runtime at `apps/wa-service`. It will own real session
                lifecycle, QR pairing, and message transport.
              </p>
            </div>
          </div>
        </Panel>

        {sections.map((section) => (
          <Panel key={section.title} title={section.title}>
            <div className="space-y-3">
              {section.body.map((item) => (
                <p key={item} className="text-sm leading-6 text-slate-300">
                  {item}
                </p>
              ))}
            </div>
          </Panel>
        ))}

        <Panel title="Environment">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-300">
              TAKU Web reads the API location and shared dev token from
              `apps/taku-web/.env`. The current API target is `{apiBaseUrl}`.
            </p>
            <CodeBlock>{`NEXT_PUBLIC_TAKU_API_BASE_URL=http://localhost:3010
NEXT_PUBLIC_TAKU_API_KEY=taku-local-dev-token
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=your-mercado-pago-public-key`}</CodeBlock>
            <CodeBlock>{`TAKU_WEB_BASE_URL=http://localhost:3003
MERCADOPAGO_ACCESS_TOKEN=your-mercado-pago-access-token
MERCADOPAGO_USE_SANDBOX=true`}</CodeBlock>
            <p className="text-sm leading-6 text-slate-400">
              Because these values are `NEXT_PUBLIC_`, the browser can see the
              API allow-token. User scope is carried by a signed TAKU session
              token after login.
            </p>
          </div>
        </Panel>

        <Panel title="API Contract In Use">
          <div className="grid gap-2 md:grid-cols-2">
            {endpoints.map((endpoint) => (
              <div
                key={endpoint}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              >
                {endpoint}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Manual API Check">
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-300">
              Requests to `/v1/*` must include the configured `x-api-key`.
            </p>
            <CodeBlock>{`curl -s \\
  -H 'x-api-key: taku-local-dev-token' \\
  http://localhost:3010/v1/businesses`}</CodeBlock>
          </div>
        </Panel>

        <Panel title="Next Backend Steps">
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <p>
              Replace shared demo passwords with per-user password hashes and
              session revocation.
            </p>
            <p>
              Replace JSON storage with a durable database once the model is
              stable enough.
            </p>
            <p>
              Connect TAKU API phone actions to WA Service connection endpoints
              for real QR pairing, start, stop, and status sync.
            </p>
            <p>
              Add webhook ingestion from WA Service so incoming WhatsApp events
              can reach the selected bot.
            </p>
          </div>
        </Panel>
      </div>
    </main>
  );
}
