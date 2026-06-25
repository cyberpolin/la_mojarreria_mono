"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppCard, MetricCard } from "@/components/ui/card";
import {
  AlertEvaluationResult,
  AlertRuleRecord,
  AlertRulesPayload,
} from "@/types/alert-rule";
import { BotHandlerConfigRecord } from "@/types/bot-handler";

type AlertsPayload = AlertRulesPayload & {
  handlers: BotHandlerConfigRecord[];
  error?: string;
};

const emptyDraft = {
  name: "Low Mojarras",
  metric: "LOW_MOJARRAS",
  enabled: true,
  threshold: "10",
  recipient: "",
  botHandlerId: "",
  cooldownMinutes: "240",
  messageTemplate:
    "Alert: Mojarras inventory is at {remaining}. Threshold is {threshold}.",
};

const draftFromRule = (rule: AlertRuleRecord) => ({
  name: rule.name,
  metric: rule.metric,
  enabled: rule.enabled,
  threshold: String(rule.threshold),
  recipient: rule.recipient,
  botHandlerId: rule.botHandlerId,
  cooldownMinutes: String(rule.cooldownMinutes),
  messageTemplate: rule.messageTemplate,
});

const lastTriggeredLabel = (value: string | null) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
};

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRuleRecord[]>([]);
  const [handlers, setHandlers] = useState<BotHandlerConfigRecord[]>([]);
  const [inventory, setInventory] = useState({
    bought: 0,
    sold: 0,
    remaining: 0,
  });
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [results, setResults] = useState<AlertEvaluationResult[]>([]);

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.enabled).length,
    [rules],
  );
  const activeHandlers = useMemo(
    () => handlers.filter((handler) => handler.enabled).length,
    [handlers],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/alerts", { cache: "no-store" });
      const payload = (await response.json()) as AlertsPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to load (${response.status})`);
      }
      setRules(payload.rules ?? []);
      setHandlers(payload.handlers ?? []);
      setInventory(payload.inventory);
      setDraft((current) =>
        current.botHandlerId || !payload.handlers?.[0]
          ? current
          : { ...current, botHandlerId: payload.handlers[0].id },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetDraft = () => {
    setDraft({
      ...emptyDraft,
      botHandlerId: handlers[0]?.id ?? "",
    });
    setEditingId(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/alerts", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ...draft,
          threshold: Number(draft.threshold),
          cooldownMinutes: Number(draft.cooldownMinutes),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save alert");
      }

      setMessage(editingId ? "Alert updated." : "Alert created.");
      resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save alert");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/alerts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete alert");
      }
      setMessage("Alert deleted.");
      if (editingId === id) resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alert");
    } finally {
      setSaving(false);
    }
  };

  const checkNow = async (force = false) => {
    setChecking(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = (await response.json()) as {
        inventory?: AlertsPayload["inventory"];
        results?: AlertEvaluationResult[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Alert check failed");
      }
      if (payload.inventory) setInventory(payload.inventory);
      setResults(payload.results ?? []);
      const sent = (payload.results ?? []).filter(
        (result) => result.triggered,
      ).length;
      setMessage(sent > 0 ? `${sent} alert sent.` : "No alerts sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Alert check failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA AUTOMATION
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Alerts</h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Configure operational alerts and deliver messages through Bot
          Handlers.
        </p>
      </header>

      {error ? (
        <AppCard className="mb-4 border-slate-700 text-sm text-slate-200">
          {error}
        </AppCard>
      ) : null}

      {message ? (
        <AppCard className="mb-4 border-slate-700 text-sm text-slate-100">
          {message}
        </AppCard>
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-4">
        <MetricCard
          title="Remaining Mojarras"
          value={String(inventory.remaining)}
        />
        <MetricCard title="Bought" value={String(inventory.bought)} />
        <MetricCard title="Sold" value={String(inventory.sold)} />
        <MetricCard title="Active Alerts" value={String(activeRules)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                {editingId ? "Edit Alert" : "New Alert"}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Available active handlers: {activeHandlers}
              </p>
            </div>
            {editingId ? (
              <button
                type="button"
                onClick={resetDraft}
                className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <form onSubmit={submit} className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm text-slate-300">
              Name
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Rule
              <select
                value={draft.metric}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    metric: event.target.value,
                  }))
                }
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              >
                <option value="LOW_MOJARRAS">Low Mojarras</option>
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Threshold
                <input
                  type="number"
                  min="0"
                  value={draft.threshold}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      threshold: event.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Cooldown minutes
                <input
                  type="number"
                  min="0"
                  value={draft.cooldownMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      cooldownMinutes: event.target.value,
                    }))
                  }
                  required
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-300">
              Send to
              <input
                value={draft.recipient}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    recipient: event.target.value,
                  }))
                }
                required
                placeholder="521999999999 or handler destination"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Bot Handler
              <select
                value={draft.botHandlerId}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    botHandlerId: event.target.value,
                  }))
                }
                required
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              >
                <option value="">Select handler</option>
                {handlers.map((handler) => (
                  <option key={handler.id} value={handler.id}>
                    {handler.name}
                    {handler.enabled ? "" : " (disabled)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Message template
              <textarea
                value={draft.messageTemplate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    messageTemplate: event.target.value,
                  }))
                }
                rows={4}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
              />
              Enabled
            </label>

            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-lg border border-slate-600 bg-slate-100 px-4 text-sm font-semibold text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Alert"
                  : "Create Alert"}
            </button>
          </form>
        </AppCard>

        <AppCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Configured Alerts
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={checking}
                onClick={() => void checkNow(false)}
                className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking ? "Checking..." : "Check now"}
              </button>
              <button
                type="button"
                disabled={checking}
                onClick={() => void checkNow(true)}
                className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Force send
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {rules.map((rule) => (
              <article
                key={rule.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-100">
                        {rule.name}
                      </h3>
                      <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        Below {rule.threshold}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          rule.enabled
                            ? "border border-slate-600 bg-slate-100 text-slate-950"
                            : "border border-slate-800 text-slate-400"
                        }`}
                      >
                        {rule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-400">
                      To {rule.recipient}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Last sent: {lastTriggeredLabel(rule.lastTriggeredAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(rule.id);
                        setDraft(draftFromRule(rule));
                      }}
                      className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void remove(rule.id)}
                      className="h-9 rounded-lg border border-slate-800 px-3 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!loading && rules.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                No alerts configured yet.
              </div>
            ) : null}

            {results.length > 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="text-sm font-semibold text-slate-100">
                  Last check
                </h3>
                <div className="mt-3 grid gap-2">
                  {results.map((result) => (
                    <p key={result.ruleId} className="text-xs text-slate-400">
                      {result.ruleName}:{" "}
                      {result.triggered
                        ? `sent (${result.sentStatus})`
                        : result.skippedReason}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </AppCard>
      </section>
    </main>
  );
}
