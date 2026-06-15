const connectionEndpoints = [
  ["GET", "/v1/connections", "List WhatsApp runtime connections."],
  ["POST", "/v1/connections", "Register a connection config."],
  ["GET", "/v1/connections/:connectionId/status", "Read connection state."],
  ["POST", "/v1/connections/:connectionId/start", "Start a connection."],
  ["POST", "/v1/connections/:connectionId/stop", "Stop a connection."],
  [
    "POST",
    "/v1/connections/:connectionId/reset-session",
    "Clear local auth and request a new QR pairing.",
  ],
  ["GET", "/v1/connections/:connectionId/qr", "Read the current QR payload."],
  ["POST", "/v1/connections/:connectionId/messages", "Send a message."],
];

const legacyEndpoints = [
  ["GET", "/service/status"],
  ["POST", "/service/activate"],
  ["POST", "/service/deactivate"],
  ["POST", "/service/reset-session"],
  ["GET", "/v1/whatsapp/qr"],
  ["POST", "/v1/messages/send"],
  ["GET", "/v1/conversations"],
  ["GET", "/v1/conversations/:phone/messages"],
  ["POST", "/v1/conversations/:phone/messages"],
];

const events = [
  "wa.connection.status_changed",
  "wa.session.qr_updated",
  "wa.session.logged_out",
  "wa.message.received",
  "wa.message.sent",
  "wa.message.failed",
];

const errors = [
  ["401", "Invalid or missing service credential."],
  ["403", "Client domain is not allowed."],
  ["404", "Connection or message target was not found."],
  ["409", "Connection is already starting, stopping, or locked elsewhere."],
  ["422", "Request body is valid JSON but failed domain validation."],
  ["429", "Connection or business rate limit was reached."],
  ["502", "WhatsApp provider/session operation failed."],
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
      <code>{children}</code>
    </pre>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-800 py-8">
      <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-6 text-slate-300">
        {children}
      </div>
    </section>
  );
}

export default function WaServiceDocsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          DEVELOPER DOCS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">
          wa-service Integration
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          `wa-service` manages WhatsApp runtime connections. It should be used
          by trusted backend services, not directly from public browser clients.
          Business accounts, user permissions, billing, bot decisions, and
          long-term customer data belong in `apps/api`.
        </p>
      </header>

      <Section title="Service Boundary">
        <p>
          The recommended integration path is client app to `apps/api` to
          `wa-service`. The API owns authorization and business rules.
          `wa-service` owns WhatsApp sockets, QR pairing, session files, inbound
          transport, outbound transport, and runtime status.
        </p>
        <CodeBlock>{`Client app
  -> apps/api
    -> wa-service
      -> WhatsApp`}</CodeBlock>
      </Section>

      <Section title="Authentication">
        <p>
          Current compatible requests use `x-api-key` and `x-client-domain`.
          These headers should be sent by `apps/api` or another trusted backend.
          Never expose the service API key in public frontend code.
        </p>
        <CodeBlock>{`x-api-key: <service-api-key>
x-client-domain: lamojarreria.com
content-type: application/json`}</CodeBlock>
        <p>
          Future connection-scoped calls should still be authorized by
          `apps/api`. A business token can identify the business at the API
          layer, while `wa-service` receives only trusted service calls.
        </p>
      </Section>

      <Section title="Compatibility Mode">
        <p>
          Existing single-connection clients continue to use the legacy
          endpoints. Internally these endpoints should map to the default
          connection with `connectionId` set to `default`.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {legacyEndpoints.map(([method, endpoint]) => (
                <tr key={`${method}-${endpoint}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {method}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {endpoint}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Connection Lifecycle">
        <p>
          A connection represents one WhatsApp phone/session. Multi-connection
          support should isolate auth files, status, QR, reconnect timers,
          locks, and message cache per connection.
        </p>
        <CodeBlock>{`1. Create or load a connection config.
2. Start the connection.
3. Fetch QR until the phone scans it.
4. Poll or receive status updates.
5. Send outbound messages through the connection.
6. Receive inbound events through the API webhook.`}</CodeBlock>
      </Section>

      <Section title="Connection Endpoints">
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Endpoint</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {connectionEndpoints.map(([method, endpoint, purpose]) => (
                <tr key={`${method}-${endpoint}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {method}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {endpoint}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Create Connection">
        <CodeBlock>{`POST /v1/connections

{
  "connectionId": "wa_acc_123",
  "businessId": "bus_456",
  "label": "Main store phone",
  "webhookUrl": "https://api.example.com/internal/wa/events",
  "autoStart": false
}`}</CodeBlock>
        <CodeBlock>{`{
  "ok": true,
  "connection": {
    "connectionId": "wa_acc_123",
    "businessId": "bus_456",
    "state": "inactive",
    "connected": false,
    "hasQr": false
  }
}`}</CodeBlock>
      </Section>

      <Section title="Read QR">
        <CodeBlock>{`GET /v1/connections/wa_acc_123/qr`}</CodeBlock>
        <CodeBlock>{`{
  "ok": true,
  "connectionId": "wa_acc_123",
  "qr": "2@...",
  "qrImage": "data:image/png;base64,...",
  "connected": false,
  "state": "qr_pending"
}`}</CodeBlock>
      </Section>

      <Section title="Send Message">
        <CodeBlock>{`POST /v1/connections/wa_acc_123/messages

{
  "to": "5219931234567",
  "text": "Hola, gracias por escribirnos."
}`}</CodeBlock>
        <CodeBlock>{`{
  "ok": true,
  "connectionId": "wa_acc_123",
  "messageId": "ABC123"
}`}</CodeBlock>
      </Section>

      <Section title="Webhook Events">
        <p>
          `wa-service` should emit events to `apps/api`. Every event should
          include `eventId`, `event`, `connectionId`, `businessId`, and
          `occurredAt` so the API can store and deduplicate it.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {events.map((event) => (
            <div
              key={event}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200"
            >
              {event}
            </div>
          ))}
        </div>
        <CodeBlock>{`{
  "eventId": "evt_123",
  "event": "wa.message.received",
  "connectionId": "wa_acc_123",
  "businessId": "bus_456",
  "occurredAt": "2026-06-15T18:00:00.000Z",
  "message": {
    "id": "wamid.example",
    "from": "5219931234567",
    "text": "Hola",
    "timestamp": "2026-06-15T18:00:00.000Z",
    "type": "text"
  }
}`}</CodeBlock>
      </Section>

      <Section title="Error Handling">
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {errors.map(([status, meaning]) => (
                <tr key={status}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {status}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Security Notes">
        <ul className="space-y-2">
          <li>Do not expose `wa-service` API keys in browser clients.</li>
          <li>Route browser and mobile requests through `apps/api`.</li>
          <li>Store WhatsApp auth files per connection.</li>
          <li>Use one process lock per connection, not one global lock.</li>
          <li>Verify webhook secrets and deduplicate events by `eventId`.</li>
          <li>
            Keep bot and business authorization decisions outside `wa-service`.
          </li>
        </ul>
      </Section>
    </main>
  );
}
