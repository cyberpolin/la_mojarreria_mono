"use client";

import { FormEvent, useState } from "react";
import { z } from "zod";
import { getBackendApiBaseUrl } from "@/lib/auth";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email requerido.")
    .email("Ingresa un email valido."),
});

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    setFormError(null);
    setMessage(null);

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setEmailError(validation.error.issues[0]?.message ?? "Email invalido.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `${getBackendApiBaseUrl()}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(validation.data),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { message?: string };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error?.message ?? "No se pudo solicitar recuperacion.",
        );
      }

      setMessage(
        payload.data?.message ??
          "Si el correo existe, enviaremos instrucciones para restablecer la contrasena.",
      );
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo solicitar recuperacion.",
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
              Recuperar password
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Ingresa tu email y enviaremos instrucciones si existe una cuenta
          asociada.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (emailError) setEmailError(null);
              }}
              required
              autoComplete="email"
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? "forgot-email-error" : undefined}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {emailError ? (
              <span
                id="forgot-email-error"
                className="text-xs font-medium text-slate-700"
              >
                {emailError}
              </span>
            ) : null}
          </label>

          {formError ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {formError}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Enviando..." : "Enviar instrucciones"}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-5 text-sm">
          <a
            href="/login"
            className="font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Volver a login
          </a>
        </div>
      </section>
    </main>
  );
}
