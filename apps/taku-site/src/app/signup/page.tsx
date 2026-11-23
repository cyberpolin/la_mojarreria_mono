"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { getBackendApiBaseUrl, saveAppSession } from "@/lib/auth";

const signupSchema = z
  .object({
    workspaceName: z.string().trim().min(2, "Nombre de empresa requerido."),
    name: z.string().trim().min(2, "Tu nombre es requerido."),
    email: z
      .string()
      .trim()
      .min(1, "Email requerido.")
      .email("Ingresa un email valido."),
    password: z
      .string()
      .min(8, "El password debe tener al menos 8 caracteres."),
    passwordConfirmation: z.string().min(1, "Confirma tu password."),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Los passwords no coinciden.",
  });

type SignupErrors = Partial<Record<keyof z.infer<typeof signupSchema>, string>>;

type SignupPlan = "free" | "starter" | "business" | "enterprise";

type SignupResponse = {
  ok: boolean;
  data?: Parameters<typeof saveAppSession>[0];
  error?: { message?: string };
};

function readSignupPlan(value: string | null): SignupPlan {
  if (value === "starter" || value === "business" || value === "enterprise") {
    return value;
  }
  return "free";
}

function getSignupErrors(error: z.ZodError<z.infer<typeof signupSchema>>) {
  const errors: SignupErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      field === "workspaceName" ||
      field === "name" ||
      field === "email" ||
      field === "password" ||
      field === "passwordConfirmation"
    ) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

function SignupContent() {
  const searchParams = useSearchParams();
  const selectedPlan = readSignupPlan(searchParams.get("plan"));
  const paymentIntentId = searchParams.get("paymentIntent");
  const initialEmail = searchParams.get("email") ?? "";
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const validation = signupSchema.safeParse({
      workspaceName,
      name,
      email,
      password,
      passwordConfirmation,
    });

    if (!validation.success) {
      setErrors(getSignupErrors(validation.error));
      return;
    }

    setErrors({});
    if (selectedPlan !== "free" && !paymentIntentId) {
      setMessage("Completa el pago antes de crear esta cuenta.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${getBackendApiBaseUrl()}/public/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceName: validation.data.workspaceName,
          name: validation.data.name,
          email: validation.data.email,
          password: validation.data.password,
          plan: selectedPlan,
          ...(paymentIntentId ? { paidPaymentIntentId: paymentIntentId } : {}),
        }),
      });
      const payload = (await response
        .json()
        .catch(() => null)) as SignupResponse | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(
          payload?.error?.message ?? `Signup failed HTTP ${response.status}`,
        );
      }
      saveAppSession(payload.data);
      window.location.href = "/main";
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "No se pudo crear la cuenta.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function clearError(field: keyof SignupErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-950">
      <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
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
              Crear cuenta
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Plan:{" "}
            <span className="font-semibold text-slate-950">{selectedPlan}</span>
            {selectedPlan !== "free" ? (
              <span>
                {" "}
                · Pago{" "}
                {paymentIntentId ? "confirmado para activar" : "requerido"}
              </span>
            ) : null}
          </div>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Empresa
            <input
              value={workspaceName}
              onChange={(event) => {
                setWorkspaceName(event.target.value);
                clearError("workspaceName");
              }}
              aria-invalid={Boolean(errors.workspaceName)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.workspaceName ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.workspaceName}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Tu nombre
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearError("name");
              }}
              aria-invalid={Boolean(errors.name)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.name ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.name}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError("email");
              }}
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.email ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.email}
              </span>
            ) : null}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearError("password");
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
              />
              {errors.password ? (
                <span className="text-xs font-medium text-slate-700">
                  {errors.password}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Confirmar
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value);
                  clearError("passwordConfirmation");
                }}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.passwordConfirmation)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
              />
              {errors.passwordConfirmation ? (
                <span className="text-xs font-medium text-slate-700">
                  {errors.passwordConfirmation}
                </span>
              ) : null}
            </label>
          </div>

          {message ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            {isSubmitting ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-200 pt-5 text-sm">
          <a
            href="/login"
            className="font-semibold text-slate-700 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            Ya tengo cuenta
          </a>
        </div>
      </section>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10 text-slate-950">
          <section className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/5">
            <p className="text-sm font-medium text-slate-700">
              Cargando registro...
            </p>
          </section>
        </main>
      }
    >
      <SignupContent />
    </Suspense>
  );
}
