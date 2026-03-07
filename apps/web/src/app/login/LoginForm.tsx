"use client";

import { useFormState } from "react-dom";
import { loginAction } from "./actions";

const initialState = { error: "" };

export default function LoginForm() {
  const [state, action] = useFormState(loginAction, initialState);

  return (
    <form action={action} className="mt-8 grid gap-4">
      <label className="grid gap-2 text-sm text-slate-200">
        Email
        <input
          name="email"
          type="email"
          required
          className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none transition focus-visible:border-slate-400"
        />
      </label>
      <label className="grid gap-2 text-sm text-slate-200">
        Password
        <input
          name="password"
          type="password"
          required
          className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100 outline-none transition focus-visible:border-slate-400"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-slate-400">{state.error}</p>
      ) : null}
      <button
        type="submit"
        className="mt-2 h-11 rounded-lg border border-slate-700 bg-slate-100 text-sm font-semibold text-slate-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200"
      >
        Sign in
      </button>
    </form>
  );
}
