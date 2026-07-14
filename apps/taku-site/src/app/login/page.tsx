"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  getAdminSession,
  getBackendApiBaseUrl,
  routeForAdminSession,
  saveAppSession,
  type AppSession,
} from "@/lib/auth";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email requerido.")
    .email("Ingresa un email valido."),
  password: z.string().min(1, "Password requerido."),
});

type LoginErrors = {
  email?: string;
  password?: string;
};

function validateLoginForm(params: { email: string; password: string }) {
  const result = loginSchema.safeParse(params);
  if (result.success) {
    return { data: result.data, errors: {} };
  }
  const errors: LoginErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "password") {
      errors[field] = issue.message;
    }
  }
  return { data: null, errors };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("cyberpolin@gmail.com");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const session = getAdminSession();
    if (session) {
      router.replace(routeForAdminSession(session));
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const validation = validateLoginForm({ email, password });
    const nextErrors = validation.errors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!validation.data) return;

    setIsLoading(true);

    try {
      const response = await fetch(`${getBackendApiBaseUrl()}/session/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: AppSession;
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Credenciales invalidas.");
      }

      saveAppSession(payload.data);
      router.replace(routeForAdminSession(payload.data));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo iniciar sesion.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
        <div className="flex items-center gap-3">
          <img
            src="/taku.png"
            alt="TAKU"
            className="h-11 w-11 rounded-lg border border-slate-200 bg-white"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              TAKU
            </p>
            <h1 className="text-xl font-semibold text-slate-950">
              Super Admin
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email) {
                  setErrors((current) => ({ ...current, email: undefined }));
                }
              }}
              required
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.email ? (
              <span
                id="login-email-error"
                className="text-xs font-medium text-slate-700"
              >
                {errors.email}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errors.password) {
                  setErrors((current) => ({ ...current, password: undefined }));
                }
              }}
              required
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.password ? (
              <span
                id="login-password-error"
                className="text-xs font-medium text-slate-700"
              >
                {errors.password}
              </span>
            ) : null}
          </label>

          {error ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <a
            href="/forgot-password"
            className="font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Recuperar password
          </a>
          <a
            href="/signup"
            className="font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Crear cuenta
          </a>
        </div>
      </section>
    </main>
  );
}
