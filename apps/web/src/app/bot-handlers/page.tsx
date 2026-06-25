"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppCard, MetricCard } from "@/components/ui/card";
import {
  BotHandlerConfigRecord,
  BotHandlerProvider,
  BotHandlersPayload,
} from "@/types/bot-handler";

const providers: Array<{ value: BotHandlerProvider; label: string }> = [
  { value: "CUSTOM_WEBHOOK", label: "Custom Webhook" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "OPENAI", label: "OpenAI" },
];

const emptyDraft = {
  name: "",
  provider: "CUSTOM_WEBHOOK" as BotHandlerProvider,
  enabled: true,
  baseUrl: "",
  webhookUrl: "",
  apiKeySecret: "",
  settings: "{}",
};

const draftFromHandler = (handler: BotHandlerConfigRecord) => ({
  name: handler.name,
  provider: handler.provider,
  enabled: handler.enabled,
  baseUrl: handler.baseUrl ?? "",
  webhookUrl: handler.webhookUrl ?? "",
  apiKeySecret: "",
  settings: JSON.stringify(handler.settings ?? {}, null, 2),
});

export default function BotHandlersPage() {
  const [handlers, setHandlers] = useState<BotHandlerConfigRecord[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const enabledCount = useMemo(
    () => handlers.filter((handler) => handler.enabled).length,
    [handlers],
  );
  const webhookCount = useMemo(
    () => handlers.filter((handler) => handler.webhookUrl?.trim()).length,
    [handlers],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/bot-handlers", { cache: "no-store" });
      const payload = (await response.json()) as BotHandlersPayload & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to load (${response.status})`);
      }
      setHandlers(payload.handlers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load handlers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/bot-handlers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ...draft,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save handler");
      }

      setMessage(editingId ? "Handler updated." : "Handler created.");
      resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save handler");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/bot-handlers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete handler");
      }
      setMessage("Handler deleted.");
      if (editingId === id) resetDraft();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete handler");
    } finally {
      setSaving(false);
    }
  };

  const testWebhook = async (handler: BotHandlerConfigRecord) => {
    setTestingId(handler.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/bot-handlers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          webhookUrl: handler.webhookUrl,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        ok?: boolean;
        status?: number;
        statusText?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Webhook test failed");
      }
      setMessage(
        `Webhook test ${payload.ok ? "passed" : "responded"} (${payload.status} ${payload.statusText ?? ""}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhook test failed");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA AUTOMATION
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Bot Handlers</h1>
        <p className="max-w-2xl text-sm text-slate-300">
          Configure third-party bot providers and webhook handlers used by the
          restaurant workflow.
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

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <MetricCard title="Handlers" value={String(handlers.length)} />
        <MetricCard title="Enabled" value={String(enabledCount)} />
        <MetricCard title="Webhooks" value={String(webhookCount)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              {editingId ? "Edit Handler" : "New Handler"}
            </h2>
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
                placeholder="Order assistant"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Provider
              <select
                value={draft.provider}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    provider: event.target.value as BotHandlerProvider,
                  }))
                }
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              >
                {providers.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Base URL
              <input
                value={draft.baseUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    baseUrl: event.target.value,
                  }))
                }
                placeholder="https://provider.example.com"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Webhook URL
              <input
                value={draft.webhookUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    webhookUrl: event.target.value,
                  }))
                }
                placeholder="https://provider.example.com/webhook"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              API key / secret
              <input
                type="password"
                value={draft.apiKeySecret}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    apiKeySecret: event.target.value,
                  }))
                }
                placeholder={
                  editingId ? "Leave blank to keep existing secret" : "Optional"
                }
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-base text-slate-100 placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-300">
              Settings JSON
              <textarea
                value={draft.settings}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    settings: event.target.value,
                  }))
                }
                rows={5}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-base text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400 md:text-sm"
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
                  ? "Update Handler"
                  : "Create Handler"}
            </button>
          </form>
        </AppCard>

        <AppCard>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-100">
              Configured Handlers
            </h2>
            {loading ? (
              <span className="text-xs text-slate-400">Loading...</span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3">
            {handlers.map((handler) => (
              <article
                key={handler.id}
                className="rounded-lg border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-100">
                        {handler.name}
                      </h3>
                      <span className="rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        {handler.provider}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          handler.enabled
                            ? "border border-slate-600 bg-slate-100 text-slate-950"
                            : "border border-slate-800 text-slate-400"
                        }`}
                      >
                        {handler.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-400">
                      {handler.webhookUrl || handler.baseUrl || "No URL set"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Secret: {handler.hasApiKeySecret ? "configured" : "none"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(handler.id);
                        setDraft(draftFromHandler(handler));
                      }}
                      className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={!handler.webhookUrl || testingId === handler.id}
                      onClick={() => void testWebhook(handler)}
                      className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {testingId === handler.id ? "Testing..." : "Test"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void remove(handler.id)}
                      className="h-9 rounded-lg border border-slate-800 px-3 text-xs font-medium text-slate-400 hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!loading && handlers.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                No bot handlers configured yet.
              </div>
            ) : null}
          </div>
        </AppCard>
      </section>
    </main>
  );
}
