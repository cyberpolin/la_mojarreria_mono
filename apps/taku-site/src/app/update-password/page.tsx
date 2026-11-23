"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  getAdminSession,
  getBackendApiBaseUrl,
  routeForAdminSession,
  saveAdminSession,
  type AdminSession,
} from "@/lib/auth";

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password actual requerido."),
    newPassword: z
      .string()
      .min(8, "El nuevo password debe tener al menos 8 caracteres.")
      .refine((value) => value !== "changeme", {
        message: "El nuevo password no puede ser changeme.",
      }),
    passwordConfirmation: z.string().min(1, "Confirma el nuevo password."),
  })
  .refine((data) => data.newPassword === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Los passwords no coinciden.",
  });

type UpdatePasswordErrors = Partial<
  Record<keyof z.infer<typeof updatePasswordSchema>, string>
>;

function mapErrors(error: z.ZodError<z.infer<typeof updatePasswordSchema>>) {
  const errors: UpdatePasswordErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      field === "currentPassword" ||
      field === "newPassword" ||
      field === "passwordConfirmation"
    ) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [currentPassword, setCurrentPassword] = useState("changeme");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errors, setErrors] = useState<UpdatePasswordErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedSession = getAdminSession();
    if (!storedSession) {
      router.replace("/login");
      return;
    }
    setSession(storedSession);
  }, [router]);

  function clearError(field: keyof UpdatePasswordErrors) {
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const validation = updatePasswordSchema.safeParse({
      currentPassword,
      newPassword,
      passwordConfirmation,
    });

    if (!validation.success) {
      setErrors(mapErrors(validation.error));
      return;
    }
    if (!session) return;

    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch(
        `${getBackendApiBaseUrl()}/admin/auth/change-password`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify(validation.data),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: {
          adminUser: AdminSession["adminUser"];
          requiresPasswordChange: false;
        };
        error?: { message?: string };
      };

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(
          payload.error?.message ?? "No se pudo actualizar el password.",
        );
      }

      const nextSession = {
        ...session,
        adminUser: payload.data.adminUser,
        requiresPasswordChange: false,
      };
      saveAdminSession(nextSession);
      router.replace(routeForAdminSession(nextSession));
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar el password.",
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
              Actualizar password
            </h1>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600">
          Antes de entrar al panel, cambia el password inicial del super owner.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password actual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                clearError("currentPassword");
              }}
              aria-invalid={Boolean(errors.currentPassword)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.currentPassword ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.currentPassword}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Nuevo password
            <input
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                clearError("newPassword");
              }}
              aria-invalid={Boolean(errors.newPassword)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.newPassword ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.newPassword}
              </span>
            ) : null}
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Confirmar nuevo password
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) => {
                setPasswordConfirmation(event.target.value);
                clearError("passwordConfirmation");
              }}
              aria-invalid={Boolean(errors.passwordConfirmation)}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 aria-[invalid=true]:border-slate-950"
            />
            {errors.passwordConfirmation ? (
              <span className="text-xs font-medium text-slate-700">
                {errors.passwordConfirmation}
              </span>
            ) : null}
          </label>

          {formError ? (
            <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              {formError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Actualizando..." : "Actualizar password"}
          </button>
        </form>
      </section>
    </main>
  );
}
