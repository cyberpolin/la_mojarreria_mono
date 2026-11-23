"use client";

import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Assistant = {
  id: string;
  name: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
};

type AssistantResponse =
  | {
      ok: true;
      assistant: Assistant;
    }
  | {
      ok: false;
      error: string;
    };

type CompletionResponse = {
  id?: string;
  object?: string;
  model?: string;
  assistant_id?: string | null;
  choices?: Array<{
    index: number;
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
  billing?: {
    tier?: string;
    status?: string;
    remaining_usd?: number;
    included_remaining_usd?: number;
    prepaid_remaining_usd?: number;
    monthly_period?: string;
    low_balance?: boolean;
  };
};

function readSessionClientId() {
  try {
    const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
    if (!rawSession) return null;
    const session = JSON.parse(rawSession) as {
      account?: { id?: unknown };
    };
    return typeof session.account?.id === "string" ? session.account.id : null;
  } catch {
    return null;
  }
}

function readSessionClientToken() {
  try {
    const rawSession = window.localStorage.getItem("TAKU_BOT_SESSION");
    if (!rawSession) return null;
    const session = JSON.parse(rawSession) as {
      account?: { clientToken?: unknown };
    };
    return typeof session.account?.clientToken === "string"
      ? session.account.clientToken
      : null;
  } catch {
    return null;
  }
}

function clientHeaders(clientId: string | null, clientToken: string | null) {
  return {
    ...(clientId ? { "x-taku-client-id": clientId } : {}),
    ...(clientToken ? { "x-taku-client-token": clientToken } : {}),
  };
}

function maskedToken(token: string | null) {
  return token ? `${token.slice(0, 12)}...${token.slice(-6)}` : null;
}

function defaultCompletionPayload(
  assistantId: string,
  clientId = "demo-client",
) {
  return JSON.stringify(
    {
      model: "taku-cr",
      assistant_id: assistantId,
      client_id: clientId,
      history: [
        {
          role: "user",
          content: "Hola",
        },
        {
          role: "assistant",
          content: "Hola, te puedo ayudar con precios o pedidos.",
        },
      ],
      messages: [
        {
          role: "user",
          content: "Cuanto cuesta?",
        },
      ],
      temperature: 0.2,
      max_tokens: 120,
    },
    null,
    2,
  );
}

function formatBillingCompletionError(
  payload: CompletionResponse | null,
  status: number,
) {
  if (payload?.error?.type !== "billing_error") {
    return payload?.error?.message ?? `Completion failed with HTTP ${status}`;
  }

  const remaining =
    typeof payload.billing?.remaining_usd === "number"
      ? `$${payload.billing.remaining_usd.toFixed(4)}`
      : "$0.0000";
  const tier = payload.billing?.tier
    ? payload.billing.tier.replace("_", " ")
    : "account";
  const reset =
    payload.billing?.monthly_period && payload.billing?.tier === "free"
      ? ` Free usage resets after ${payload.billing.monthly_period}.`
      : "";

  return `${payload.error.message ?? "Credit is exhausted"}. Remaining credit: ${remaining}. Tier: ${tier}.${reset}`;
}

function CodeLineEditor(params: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  const lines = params.value.split("\n");
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setLines(nextLines: string[]) {
    params.onChange(nextLines.join("\n"));
  }

  function updateLine(index: number, value: string) {
    const nextLines = [...lines];
    nextLines[index] = value;
    setLines(nextLines);
  }

  function focusLine(index: number) {
    window.requestAnimationFrame(() => {
      const input = inputRefs.current[index];
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function insertLine(index: number) {
    const nextLines = [...lines];
    nextLines.splice(index + 1, 0, "");
    setLines(nextLines);
    focusLine(index + 1);
  }

  function removeLine(index: number) {
    if (lines.length === 1) {
      setLines([""]);
      return;
    }

    const nextLines = [...lines];
    nextLines.splice(index, 1);
    setLines(nextLines);
    focusLine(Math.max(0, index - 1));
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      insertLine(index);
      return;
    }

    if (
      event.key === "Backspace" &&
      event.currentTarget.selectionStart === 0 &&
      event.currentTarget.selectionEnd === 0 &&
      lines[index] === ""
    ) {
      event.preventDefault();
      removeLine(index);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusLine(Math.max(0, index - 1));
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusLine(Math.min(lines.length - 1, index + 1));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>, index: number) {
    const text = event.clipboardData.getData("text");
    if (!text.includes("\n")) {
      return;
    }

    event.preventDefault();
    const pastedLines = text.replace(/\r\n/g, "\n").split("\n");
    const nextLines = [...lines];
    nextLines.splice(index, 1, ...pastedLines);
    setLines(nextLines);
    focusLine(index + pastedLines.length - 1);
  }

  return (
    <div className="mt-5 min-h-96 overflow-auto rounded-2xl border border-slate-700 bg-slate-950 py-3 font-mono text-sm leading-6 text-slate-50">
      {lines.map((line, index) => (
        <div
          key={index}
          className="group grid grid-cols-[3rem_1fr_2rem] items-center px-2 transition hover:bg-slate-800/80 focus-within:bg-slate-800/80"
        >
          <span className="select-none pr-3 text-right text-xs text-slate-500 group-hover:text-slate-300">
            {index + 1}
          </span>
          <input
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            value={line}
            onChange={(event) => updateLine(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onPaste={(event) => handlePaste(event, index)}
            spellCheck={false}
            className="min-h-8 w-full border-0 bg-transparent px-2 font-mono text-sm text-slate-50 outline-none selection:bg-slate-600"
          />
          <span
            aria-hidden="true"
            className="flex justify-center text-slate-500 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AssistantPage({
  params,
}: {
  params: { assistantId: string };
}) {
  const assistantId = decodeURIComponent(params.assistantId);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [completionPayload, setCompletionPayload] = useState(() =>
    defaultCompletionPayload(assistantId),
  );
  const [status, setStatus] = useState<string | null>("Loading assistant");
  const [completionStatus, setCompletionStatus] = useState<string | null>(null);
  const [completionResult, setCompletionResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const reply = useMemo(() => {
    if (!completionResult) return null;
    try {
      const parsed = JSON.parse(completionResult) as CompletionResponse;
      return parsed.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }, [completionResult]);

  async function loadAssistant(
    sessionClientId = clientId,
    sessionClientToken = clientToken,
  ) {
    setStatus("Loading assistant");

    try {
      const response = await fetch(
        `/api/bot/assistants/${encodeURIComponent(assistantId)}`,
        {
          cache: "no-store",
          headers: clientHeaders(sessionClientId, sessionClientToken),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AssistantResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus(
          payload && "error" in payload
            ? payload.error
            : `Load failed with HTTP ${response.status}`,
        );
        return;
      }

      setAssistant(payload.assistant);
      setName(payload.assistant.name);
      setInstructions(payload.assistant.instructions);
      setCompletionPayload((current) =>
        current.includes(assistantId)
          ? current
          : defaultCompletionPayload(
              payload.assistant.id,
              sessionClientId ?? undefined,
            ),
      );
      setStatus("Assistant loaded");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to load assistant",
      );
    }
  }

  async function saveAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const response = await fetch(
        `/api/bot/assistants/${encodeURIComponent(assistantId)}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            ...clientHeaders(clientId, clientToken),
          },
          body: JSON.stringify({ name, instructions }),
        },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as AssistantResponse | null;

      if (!response.ok || !payload?.ok) {
        setStatus(
          payload && "error" in payload
            ? payload.error
            : `Save failed with HTTP ${response.status}`,
        );
        return;
      }

      setAssistant(payload.assistant);
      setStatus("Assistant saved");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to save assistant",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyText(label: string, value: string | null) {
    if (!value) {
      setCopyStatus(`${label} is not available.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus(`Could not copy ${label}.`);
    }
  }

  async function runCompletion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTesting(true);
    setCompletionStatus(null);
    setCompletionResult(null);

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(completionPayload) as unknown;
    } catch (error) {
      setCompletionStatus(
        error instanceof Error ? error.message : "Completion JSON is invalid",
      );
      setTesting(false);
      return;
    }

    try {
      const response = await fetch("/api/bot/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...clientHeaders(clientId, clientToken),
        },
        body: JSON.stringify(parsedPayload),
      });
      const payload = (await response.json().catch(() => null)) as unknown;
      setCompletionResult(JSON.stringify(payload, null, 2));

      if (!response.ok) {
        const errorPayload = payload as CompletionResponse | null;
        setCompletionStatus(
          formatBillingCompletionError(errorPayload, response.status),
        );
        return;
      }

      setCompletionStatus("Completion returned");
    } catch (error) {
      setCompletionStatus(
        error instanceof Error ? error.message : "Unable to run completion",
      );
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    const sessionClientId = readSessionClientId();
    const sessionClientToken = readSessionClientToken();
    setClientId(sessionClientId);
    setClientToken(sessionClientToken);
    setCompletionPayload(
      defaultCompletionPayload(assistantId, sessionClientId ?? undefined),
    );
    void loadAssistant(sessionClientId, sessionClientToken);
  }, [assistantId]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 md:px-6">
        <a href="/admin" className="text-sm font-bold tracking-[0.2em]">
          TAKU BOT
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Assistants
          </a>
          <a
            href="/status"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Status
          </a>
          <a
            href="/admin/usage"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950"
          >
            Usage
          </a>
        </div>
      </nav>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-16 pt-6 md:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Assistant
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
            {assistant?.name ?? "Assistant"}
          </h1>
          <p className="mt-4 break-all text-sm text-slate-500">{assistantId}</p>
          {status ? (
            <p className="mt-4 text-sm text-slate-600">{status}</p>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={saveAssistant}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
          >
            <div>
              <p className="text-sm font-semibold text-slate-950">
                Assistant setup
              </p>
              <p className="mt-1 text-sm text-slate-500">
                These instructions are prepended when this assistant id is used.
              </p>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">
                Instructions
              </span>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className="mt-2 min-h-80 w-full rounded-2xl border border-slate-300 bg-white p-4 font-mono text-sm leading-6 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <button
              type="submit"
              disabled={saving || !name.trim() || !instructions.trim()}
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? "Saving" : "Save assistant"}
            </button>
          </form>

          <form
            onSubmit={runCompletion}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Completion format
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Edit the JSON body and send it with the client credentials
                  required by `/v1/chat/completions`.
                </p>
              </div>
              <span className="inline-flex min-h-8 items-center rounded-full border border-slate-500 bg-slate-600 px-3 text-xs font-semibold text-white">
                Editable JSON
              </span>
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Required headers
                  </p>
                  <pre className="mt-3 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                    {`authorization: Bearer ${clientToken ? "$TAKU_CLIENT_TOKEN" : "<missing-client-token>"}
x-taku-client-id: ${clientId ?? "<missing-client-id>"}`}
                  </pre>
                  <p className="mt-3 break-all text-xs text-slate-500">
                    Current token:{" "}
                    {maskedToken(clientToken) ?? "not stored in this browser"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText("Client id", clientId)}
                    disabled={!clientId}
                    className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy id
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyText("Client token", clientToken)}
                    disabled={!clientToken}
                    className="inline-flex min-h-10 items-center rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy token
                  </button>
                </div>
              </div>
              {copyStatus ? (
                <p className="mt-3 text-sm font-medium text-slate-600">
                  {copyStatus}
                </p>
              ) : null}
            </div>
            <CodeLineEditor
              value={completionPayload}
              onChange={setCompletionPayload}
            />
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={testing}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {testing ? "Running" : "Run completion"}
              </button>
              <button
                type="button"
                onClick={() =>
                  setCompletionPayload(
                    defaultCompletionPayload(
                      assistantId,
                      clientId ?? undefined,
                    ),
                  )
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 px-6 text-sm font-semibold text-slate-800 hover:border-slate-950"
              >
                Reset payload
              </button>
            </div>
            {completionStatus ? (
              <p
                className={`mt-4 rounded-xl border p-4 text-sm font-medium ${
                  completionStatus.toLowerCase().includes("credit") ||
                  completionStatus.toLowerCase().includes("balance")
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                {completionStatus}
              </p>
            ) : null}
            {reply ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                  Reply
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-950">{reply}</p>
              </div>
            ) : null}
            {completionResult ? (
              <pre className="mt-4 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-800">
                {completionResult}
              </pre>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}
