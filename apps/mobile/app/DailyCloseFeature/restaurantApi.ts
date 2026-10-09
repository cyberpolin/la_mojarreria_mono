import AsyncStorage from "@react-native-async-storage/async-storage";
import { APP_CONFIG } from "@/constants/config";

const SESSION_KEY = "MOJARRERIA_RESTAURANT_SESSION_V1";

type ApiPayload<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type RestaurantSession = {
  accessToken: string;
};

async function readSession(): Promise<RestaurantSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RestaurantSession>;
    if (typeof parsed.accessToken !== "string" || !parsed.accessToken) {
      return null;
    }
    return { accessToken: parsed.accessToken };
  } catch {
    return null;
  }
}

async function writeSession(session: RestaurantSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function deviceLogin() {
  const response = await fetch(
    `${APP_CONFIG.restaurantApiBaseUrl}/session/device`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        deviceId: APP_CONFIG.deviceId,
        deviceKey: APP_CONFIG.restaurantDeviceKey,
      }),
    },
  );
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<RestaurantSession> | null;
  const accessToken = payload?.data?.accessToken;
  if (!response.ok || !payload?.ok || !accessToken) {
    throw new Error(
      payload?.error?.message ?? "No se pudo autenticar el dispositivo.",
    );
  }
  const session = { accessToken };
  await writeSession(session);
  return session;
}

async function getAccessToken() {
  const existing = await readSession();
  if (existing) return existing.accessToken;
  const session = await deviceLogin();
  return session.accessToken;
}

export async function restaurantApi<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${APP_CONFIG.restaurantApiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (response.status === 401 && retry) {
    await clearSession();
    return restaurantApi<T>(path, init, false);
  }
  const payload = (await response
    .json()
    .catch(() => null)) as ApiPayload<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(
      payload?.error?.message ?? `Restaurant API failed (${response.status}).`,
    );
  }
  if (payload.data === undefined) {
    throw new Error("No se recibieron datos del API.");
  }
  return payload.data;
}
