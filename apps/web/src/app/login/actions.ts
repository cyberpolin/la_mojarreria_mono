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

type BootstrapPayload = {
  data?: {
    users?: Array<{ id: string }>;
    restaurants?: Array<{ name?: string | null }>;
  };
  errors?: Array<{ message?: string }>;
};

const isAuthSuccess = (
  result: AuthSuccess | AuthFailure | undefined,
): result is AuthSuccess =>
  Boolean(
    result &&
      "sessionToken" in result &&
      typeof result.sessionToken === "string" &&
      result.sessionToken,
  );

const getSafeNextPath = (formData: FormData) => {
  const next = String(formData.get("next") ?? "");
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  if (next.startsWith("/login") || next.startsWith("/logout")) {
    return "/dashboard";
  }
  return next;
};

const getEndpointLogLabel = () => {
  try {
    const endpoint = new URL(getGraphqlEndpoint());
    return `${endpoint.hostname}${endpoint.pathname}`;
  } catch {
    return "invalid-graphql-endpoint";
  }
};

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const nextPath = getSafeNextPath(formData);

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
  let bootstrapCompleted = false;
  try {
    const bootstrapResponse = await fetch(getGraphqlEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: bootstrapQuery }),
      cache: "no-store",
    });
    const payload = (await bootstrapResponse.json()) as BootstrapPayload;
    const errorMessages =
      payload.errors?.map((error) => error.message).filter(Boolean) ?? [];
    if (bootstrapResponse.ok) {
      if (!payload.errors?.length) {
        bootstrapCompleted = true;
        ownerExists = Boolean(payload.data?.users?.length);
        restaurantReady = Boolean(payload.data?.restaurants?.[0]?.name?.trim());
      }
    }
    console.info("[web-login] bootstrap", {
      endpoint: getEndpointLogLabel(),
      status: bootstrapResponse.status,
      role,
      bootstrapCompleted,
      ownerExists,
      restaurantReady,
      restaurantCount: payload.data?.restaurants?.length ?? 0,
      userCount: payload.data?.users?.length ?? 0,
      errors: errorMessages,
    });
  } catch (error) {
    console.warn("[web-login] bootstrap failed", {
      endpoint: getEndpointLogLabel(),
      role,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  setSessionCookie(result.sessionToken);

  if (!restaurantReady) {
    redirect("/onboarding");
  }

  redirect(nextPath);
}
