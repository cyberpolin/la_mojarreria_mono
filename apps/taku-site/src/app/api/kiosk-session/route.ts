import { NextResponse } from "next/server";

const MOJARRERIA_SLUG = "la-mojarreria";

type LoginPayload = {
  ok?: boolean;
  data?: {
    sessionType?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
    adminUser?: unknown;
    currentWorkspace?: { id: string; slug?: string; name?: string };
    workspaces?: Array<{ id: string; slug?: string; name?: string }>;
  };
  error?: { message?: string };
};

function backendBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_TAKU_BACKEND_API_BASE_URL ??
    "http://localhost:4000/api"
  );
}

async function backendJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error
        ? String(
            (payload.error as { message?: string }).message ??
              "No se pudo iniciar sesion.",
          )
        : "No se pudo iniciar sesion.";
    throw new Error(message);
  }
  return payload;
}

export async function POST() {
  try {
    const email = (
      process.env.TAKU_KIOSK_EMAIL ?? "owner@owner.com"
    ).toLowerCase();
    const password = process.env.TAKU_KIOSK_PASSWORD ?? "owner";
    const login = await backendJson<LoginPayload>("/session/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const session = login.data;
    if (!session?.accessToken || !session.refreshToken) {
      throw new Error("Sesion kiosk invalida.");
    }

    if (session.sessionType === "client" && session.user) {
      return NextResponse.json({ ok: true, data: session });
    }

    const workspacesPayload = await backendJson<{
      ok?: boolean;
      data?: Array<{ id: string; slug?: string; name?: string }>;
    }>("/admin/workspaces?pageSize=100", {
      method: "GET",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    const workspaces = workspacesPayload.data ?? [];
    const mojarreria =
      workspaces.find((item) => item.slug === MOJARRERIA_SLUG) ??
      workspaces.find((item) =>
        `${item.name ?? ""} ${item.slug ?? ""}`
          .toLowerCase()
          .includes("mojarreria"),
      ) ??
      workspaces[0];
    if (!mojarreria?.id) {
      throw new Error("No se encontro el workspace de La Mojarreria.");
    }

    const ownerSession = await backendJson<LoginPayload>(
      `/admin/workspaces/${mojarreria.id}/owner-session`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessToken}` },
      },
    );
    if (!ownerSession.data?.accessToken || !ownerSession.data.user) {
      throw new Error("No se pudo crear la sesion de La Mojarreria.");
    }
    return NextResponse.json({ ok: true, data: ownerSession.data });
  } catch (caught) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            caught instanceof Error
              ? caught.message
              : "No se pudo entrar desde la app.",
        },
      },
      { status: 401 },
    );
  }
}
