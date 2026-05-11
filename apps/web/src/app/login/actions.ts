"use server";

import { redirect } from "next/navigation";
import { getGraphqlEndpoint } from "@/lib/web-auth";
import { clearSessionCookie, setSessionCookie } from "@/lib/web-auth.server";

type LoginState = {
  error?: string;
};

type AuthSuccess = {
  sessionToken: string;
  item: {
    email: string;
    user?: { id: string; name?: string | null; role?: string | null };
  };
};

type AuthFailure = { message?: string };

const isAuthSuccess = (
  result: AuthSuccess | AuthFailure | undefined,
): result is AuthSuccess =>
  Boolean(
    result &&
      "sessionToken" in result &&
      typeof result.sessionToken === "string" &&
      result.sessionToken,
  );

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
      authenticateAuthWithPassword: AuthSuccess | AuthFailure;
    };
    errors?: Array<{ message?: string }>;
  };

  if (payload.errors?.length) {
    clearSessionCookie();
    return { error: payload.errors[0]?.message ?? "Login failed." };
  }

  const result = payload.data?.authenticateAuthWithPassword;
  if (!isAuthSuccess(result)) {
    clearSessionCookie();
    const message = result && "message" in result ? result.message : undefined;
    return { error: message ?? "Invalid credentials." };
  }

  const role = result.item.user?.role ?? "";
  if (role !== "ADMIN" && role !== "OWNER") {
    clearSessionCookie();
    return { error: "Access denied." };
  }

  const bootstrapQuery = `
    query BootstrapState {
      restaurants(orderBy: [{ createdAt: desc }], take: 1) {
        name
      }
      users(where: { role: { equals: "OWNER" } }, take: 1) {
        id
      }
    }
  `;

  let ownerExists = false;
  let restaurantReady = false;
  try {
    const bootstrapResponse = await fetch(getGraphqlEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: bootstrapQuery }),
      cache: "no-store",
    });
    if (bootstrapResponse.ok) {
      const payload = (await bootstrapResponse.json()) as {
        data?: {
          users?: Array<{ id: string }>;
          restaurants?: Array<{ name?: string | null }>;
        };
      };
      ownerExists = Boolean(payload.data?.users?.length);
      restaurantReady = Boolean(payload.data?.restaurants?.[0]?.name?.trim());
    }
  } catch {
    // fall back to defaults
  }

  setSessionCookie(result.sessionToken);

  if (role === "ADMIN") {
    if (!ownerExists) {
      redirect("/admin/owner-onboarding");
    }
    redirect("/dashboard");
  }

  if (!restaurantReady) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
