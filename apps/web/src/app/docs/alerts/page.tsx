const setupSteps = [
  [
    "Create a Bot Handler",
    "Open Bot Handlers, add a handler with an enabled webhook URL, and save it.",
  ],
  [
    "Create an alert",
    "Open Alerts, choose Low Mojarras, set the threshold, recipient, handler, and cooldown.",
  ],
  [
    "Check delivery",
    "Use Check now for normal cooldown-aware evaluation or Force send for a manual delivery test.",
  ],
  [
    "Keep evaluation running",
    "Alerts evaluate when Expenses syncs every minute. Add a server cron for alerts when no browser is open.",
  ],
];

const templateTokens = [
  ["{remaining}", "Current remaining Mojarras."],
  ["{threshold}", "Configured alert threshold."],
  ["{bought}", "Total bought Mojarras from expenses."],
  ["{sold}", "Total sold Mojarras from close reports."],
  ["{rule}", "Alert rule name."],
];

const skippedReasons = [
  ["disabled", "The alert rule is turned off."],
  ["threshold_not_met", "Remaining Mojarras are not below the threshold."],
  ["cooldown", "The rule already sent recently and is inside cooldown."],
  [
    "handler_unavailable",
    "The selected Bot Handler is disabled or has no webhook URL.",
  ],
  ["delivery_failed", "The webhook returned a non-2xx response."],
  [
    "unsupported_metric",
    "The rule metric is not supported by the current evaluator.",
  ],
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

export default function AlertsDocsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          OPERATIONAL DOCS
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Alerts</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Alerts watch operational signals and send messages through Bot
          Handlers. The first supported rule is Low Mojarras, which warns when
          inventory goes below a configured quantity.
        </p>
      </header>

      <Section title="What Alerts Do">
        <p>
          Alert rules compare live business data against a threshold. When a
          rule triggers, the web app sends a webhook payload through the
          selected Bot Handler. The handler is responsible for delivering the
          final message to WhatsApp, another bot service, or any custom
          destination.
        </p>
        <CodeBlock>{`Daily expenses + close reports
  -> alert evaluator
    -> selected Bot Handler webhook
      -> recipient`}</CodeBlock>
      </Section>

      <Section title="Low Mojarras Rule">
        <p>
          Remaining Mojarras are calculated with the same logic used by the
          Expenses screen.
        </p>
        <CodeBlock>{`remaining = bought Mojarras - sold Mojarras

bought = expenses where concept is "Mojarras"
         using "Mojarras quantity: <number>" from notes

sold = close report items whose name includes "mojarra"`}</CodeBlock>
        <p>
          The alert triggers only when remaining Mojarras are less than the
          configured threshold. Example: with threshold 10, the rule triggers at
          9 or lower.
        </p>
      </Section>

      <Section title="Setup">
        <div className="grid gap-3">
          {setupSteps.map(([title, description], index) => (
            <article
              key={title}
              className="rounded-lg border border-slate-800 bg-slate-900 p-4"
            >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-slate-100">
                {title}
              </h3>
              <p className="mt-1 text-sm text-slate-300">{description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Rule Fields">
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Field</th>
                <th className="px-4 py-3 font-medium">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  Threshold
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Sends when remaining Mojarras are below this number.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  Send to
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Phone number, chat id, or destination expected by the handler.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  Bot Handler
                </td>
                <td className="px-4 py-3 text-slate-300">
                  The integration webhook used to deliver the message.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  Cooldown minutes
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Minimum time before the same rule can send another message.
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  Message template
                </td>
                <td className="px-4 py-3 text-slate-300">
                  Message text with optional replacement tokens.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Template Tokens">
        <div className="grid gap-2 sm:grid-cols-2">
          {templateTokens.map(([token, description]) => (
            <div
              key={token}
              className="rounded-lg border border-slate-800 bg-slate-900 p-3"
            >
              <p className="font-mono text-xs text-slate-100">{token}</p>
              <p className="mt-1 text-sm text-slate-400">{description}</p>
            </div>
          ))}
        </div>
        <CodeBlock>{`Alert: Mojarras inventory is at {remaining}.
Threshold is {threshold}. Bought: {bought}. Sold: {sold}.`}</CodeBlock>
      </Section>

      <Section title="Webhook Payload">
        <p>
          Alert delivery sends a POST request to the selected Bot Handler
          webhook URL. If the handler has an API key or secret configured, it is
          sent as a bearer token in the Authorization header.
        </p>
        <CodeBlock>{`POST <bot-handler-webhook-url>
content-type: application/json
authorization: Bearer <api-key-secret>

{
  "event": "alert.triggered",
  "recipient": "521999999999",
  "message": "Alert: Mojarras inventory is at 8. Threshold is 10.",
  "alert": {
    "id": "alert-rule-id",
    "name": "Low Mojarras",
    "metric": "LOW_MOJARRAS",
    "threshold": 10
  },
  "inventory": {
    "bought": 40,
    "sold": 32,
    "remaining": 8
  },
  "sentAt": "2026-06-23T18:00:00.000Z"
}`}</CodeBlock>
      </Section>

      <Section title="Evaluation And Cooldown">
        <p>
          Alerts are evaluated automatically from the Expenses page every minute
          through the existing sync loop, and immediately after saving an
          expense. A rule only updates `lastTriggeredAt` after the webhook
          returns a successful 2xx response.
        </p>
        <p>
          Manual Check now respects cooldown. Force send bypasses cooldown for
          delivery testing, but still requires the threshold condition to be
          true.
        </p>
      </Section>

      <Section title="Skipped Results">
        <div className="overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {skippedReasons.map(([reason, meaning]) => (
                <tr key={reason}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-200">
                    {reason}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Production Notes">
        <p>
          Alert configuration uses Keystone models, so deployments need database
          migrations for `BotHandlerConfig` and `AlertRule` before the feature
          is used in production.
        </p>
        <p>
          Browser evaluation only runs while a user has the app open. For
          always-on alerts, configure a server cron or scheduled Railway job to
          call `POST /api/alerts/evaluate` on a fixed interval.
        </p>
      </Section>
    </main>
  );
}
