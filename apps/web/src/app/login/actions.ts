"use server";

import { redirect } from "next/navigation";
import { getGraphqlEndpoint } from "@/lib/web-auth";
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

  const response = await fetch(getGraphqlEndpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        mutation Authenticate($email: String!, $password: String!) {
          authenticateAuthWithPassword(email: $email, password: $password) {
            ... on AuthAuthenticationWithPasswordSuccess {
              sessionToken
              item {
                id
                email
                user {
                  id
                  name
                  role
                }
              }
            }
            ... on AuthAuthenticationWithPasswordFailure {
              message
            }
          }
        }
      `,
      variables: { email, password },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    clearSessionCookie();
    return { error: "Login failed. Please try again." };
  }

  const payload = (await response.json()) as {
    data?: {
      authenticateAuthWithPassword:
        | {
            sessionToken: string;
            item: {
              email: string;
              user?: { id: string; name?: string | null; role?: string | null };
            };
          }
        | { message?: string };
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    clearSessionCookie();
    return { error: payload.errors[0]?.message ?? "Login failed." };
  }

  const result = payload.data?.authenticateAuthWithPassword;
  if (!result || "message" in result || !result.sessionToken) {
    clearSessionCookie();
    return { error: result?.message ?? "Invalid credentials." };
  }

  const role = result.item.user?.role ?? "";
  if (role !== "ADMIN") {
    clearSessionCookie();
    return { error: "Access denied." };
  }

  setSessionCookie(result.sessionToken);
  redirect("/");
}
