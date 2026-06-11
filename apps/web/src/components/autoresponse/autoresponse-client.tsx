"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type WaStatus = {
  ok?: boolean;
  active?: boolean;
  connected?: boolean;
  connection?: string;
  state?: string;
  error?: string;
};

type InstructionsResponse = {
  ok?: boolean;
  instructions?: string;
  updatedAt?: string;
  error?: string;
};

type TestPhonesResponse = {
  ok?: boolean;
  phones?: string[];
  error?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

function parsePhones(value: string) {
  return value
    .split(/[\n,]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

export function AutoresponseClient() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [instructions, setInstructions] = useState("");
  const [instructionsUpdatedAt, setInstructionsUpdatedAt] = useState<
    string | null
  >(null);
  const [phonesText, setPhonesText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [isSavingPhones, setIsSavingPhones] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const phoneCount = useMemo(
    () => parsePhones(phonesText).length,
    [phonesText],
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusPayload, instructionsPayload, phonesPayload] =
        await Promise.all([
          fetch("/api/autoresponse/wa-status", { cache: "no-store" }).then(
            (response) => readJson<WaStatus>(response),
          ),
          fetch("/api/autoresponse/bot-instructions", {
            cache: "no-store",
          }).then(async (response) => {
            if (response.status === 404) {
              return { ok: false, instructions: "" } as InstructionsResponse;
            }
            return readJson<InstructionsResponse>(response);
          }),
          fetch("/api/autoresponse/test-phones", { cache: "no-store" }).then(
            (response) => readJson<TestPhonesResponse>(response),
          ),
        ]);

      setStatus(statusPayload);
      setInstructions(instructionsPayload.instructions ?? "");
      setInstructionsUpdatedAt(instructionsPayload.updatedAt ?? null);
      setPhonesText((phonesPayload.phones ?? []).join("\n"));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load autoresponse settings",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const saveInstructions = async () => {
    setIsSavingInstructions(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await fetch("/api/autoresponse/bot-instructions", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instructions }),
      }).then((response) => readJson<InstructionsResponse>(response));
      setInstructions(payload.instructions ?? instructions);
      setInstructionsUpdatedAt(payload.updatedAt ?? null);
      setMessage("Bot instructions saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save instructions",
      );
    } finally {
      setIsSavingInstructions(false);
    }
  };

  const savePhones = async () => {
    setIsSavingPhones(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await fetch("/api/autoresponse/test-phones", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phones: parsePhones(phonesText) }),
      }).then((response) => readJson<TestPhonesResponse>(response));
      setPhonesText((payload.phones ?? []).join("\n"));
      setMessage("Test phones saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save test phones",
      );
    } finally {
      setIsSavingPhones(false);
    }
  };

  const toggleStatus = async () => {
    const nextActive = !status?.active;
    setIsToggling(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await fetch("/api/autoresponse/wa-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      }).then((response) => readJson<WaStatus>(response));
      setStatus(payload);
      setMessage(
        `Auto-response ${payload.active ? "activated" : "deactivated"}.`,
      );
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update status",
      );
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              WA auto-response
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              State: {status?.state ?? "unknown"} | Connected:{" "}
              {status?.connected ? "yes" : "no"} | Connection:{" "}
              {status?.connection ?? "unknown"}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={isLoading || isToggling}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              status?.active
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isToggling
              ? "Updating..."
              : status?.active
                ? "Deactivate"
                : "Activate"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Bot instructions
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {instructionsUpdatedAt
                ? `Last updated: ${new Date(instructionsUpdatedAt).toLocaleString()}`
                : "No saved timestamp."}
            </p>
          </div>
          <button
            type="button"
            onClick={saveInstructions}
            disabled={isSavingInstructions || !instructions.trim()}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingInstructions ? "Saving..." : "Save instructions"}
          </button>
        </div>
        <textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={12}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-slate-400"
          placeholder="Write the permanent instructions for bot-service..."
        />
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-50">
              Auto-response test phones
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {phoneCount} phone{phoneCount === 1 ? "" : "s"} configured. One
              phone per line or comma separated.
            </p>
          </div>
          <button
            type="button"
            onClick={savePhones}
            disabled={isSavingPhones}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingPhones ? "Saving..." : "Save phones"}
          </button>
        </div>
        <textarea
          value={phonesText}
          onChange={(event) => setPhonesText(event.target.value)}
          rows={6}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100 outline-none focus:border-slate-400"
          placeholder="521993..."
        />
      </section>
    </div>
  );
}
