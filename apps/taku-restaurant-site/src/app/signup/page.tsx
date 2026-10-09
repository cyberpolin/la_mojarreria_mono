"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signupRequest } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { Button } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const session = await signupRequest({
        name,
        restaurantName,
        email,
        password,
      });
      saveSession(session);
      router.replace("/app");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo crear la cuenta.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          TAKU Restaurant
        </p>
        <h1 className="mt-2 text-xl font-semibold">Crear cuenta</h1>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Tu nombre
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Restaurante
            <input
              required
              value={restaurantName}
              onChange={(event) => setRestaurantName(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 rounded-lg border border-slate-300 px-3 outline-none focus:border-slate-950"
            />
          </label>
          {error ? <p className="text-sm text-slate-700">{error}</p> : null}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Creando..." : "Crear cuenta"}
          </Button>
        </form>
      </section>
    </main>
  );
}
