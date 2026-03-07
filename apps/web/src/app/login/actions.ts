"use server";

import { redirect } from "next/navigation";
import { validateCredentials } from "@/lib/web-auth";
import { clearSessionCookie, setSessionCookie } from "@/lib/web-auth.server";

type LoginState = {
  error?: string;
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!validateCredentials(email, password)) {
    clearSessionCookie();
    return { error: "Invalid credentials." };
  }

  setSessionCookie();
  redirect("/");
}
