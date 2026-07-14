"use client";

import { useEffect, useState } from "react";

type StoredSession = {
  sessionToken?: string;
  account?: StoredAccount;
};

type StoredAccount = {
  passwordSetupRequired?: boolean;
};

type MeResponse =
  | {
      ok: true;
      account: {
        passwordSetupRequired?: boolean;
      };
    }
  | { ok: false; error: string };

type PasswordResponse =
  | {
      ok: true;
      account: {
        passwordSetupRequired?: boolean;
      };
    }
  | {
      ok: false;
      error: string;
      issues?: { password?: string[] };
    };

const apiBaseUrl =
  process.env.NEXT_PUBLIC_TAKU_WA_API_BASE_URL ?? "http://localhost:3001";

function loadStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function updateStoredAccount(account: StoredAccount): void {
  try {
    const raw = window.localStorage.getItem("TAKU_WA_SIGNUP_RESULT");
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const existingAccount: Record<string, unknown> =
      typeof parsed.account === "object" && parsed.account !== null
        ? (parsed.account as Record<string, unknown>)
        : {};
    window.localStorage.setItem(
      "TAKU_WA_SIGNUP_RESULT",
      JSON.stringify({
        ...parsed,
        account: { ...existingAccount, ...account },
      }),
    );
  } catch {
    // The API is the source of truth; local storage is only a session cache.
  }
}

export function PasswordSetupWarning() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [shouldShow, setShouldShow] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = loadStoredSession();
    const token = stored?.sessionToken;
    if (!token) {
      return;
    }

    setSessionToken(token);
    if (stored.account?.passwordSetupRequired) {
      setShouldShow(true);
    }

    fetch(`${apiBaseUrl}/v1/account/me`, {
      headers: {
        "content-type": "application/json",
        "x-session-token": token,
      },
    })
      .then(async (response) => {
        const payload = (await response.json()) as MeResponse;
        if (!response.ok || !payload.ok) {
          return;
        }

        setShouldShow(Boolean(payload.account.passwordSetupRequired));
      })
      .catch(() => {
        setShouldShow(Boolean(stored.account?.passwordSetupRequired));
      });
  }, []);

  async function savePassword() {
    if (!sessionToken) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/account/password`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-session-token": sessionToken,
        },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as PasswordResponse;
      if (!response.ok || !payload.ok) {
        const passwordIssue = !payload.ok
          ? payload.issues?.password?.[0]
          : null;
        throw new Error(
          passwordIssue ??
            (!payload.ok ? payload.error : "Could not set password"),
        );
      }

      updateStoredAccount(payload.account);
      setPassword("");
      setNotice("Password saved.");
      setShouldShow(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not set password",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-3 text-slate-950 shadow-sm">
      <form
        className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void savePassword();
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Set your account password</p>
          <p className="text-xs text-slate-700">
            This account was created after payment. Add a password so you can
            log in again from another browser.
          </p>
          {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
          {notice ? (
            <p className="mt-1 text-xs text-emerald-700">{notice}</p>
          ) : null}
        </div>
        <input
          type="password"
          value={password}
          minLength={8}
          autoComplete="new-password"
          placeholder="New password"
          disabled={isSaving}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-full border border-amber-300 bg-white px-4 text-sm outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-100 md:w-64"
        />
        <button
          type="submit"
          disabled={isSaving || password.length < 8}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSaving ? "Saving..." : "Save password"}
        </button>
      </form>
    </div>
  );
}
