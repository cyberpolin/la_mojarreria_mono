import { APP_CONFIG } from "@/constants/config";
import { setWaServiceStatus } from "./waServiceStatusStore";

type BusinessHour = {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
};

type RestaurantResponse = {
  restaurant?: {
    businessHours?: BusinessHour[] | null;
  } | null;
};

type WaServiceStatusResponse = {
  ok?: boolean;
  status?: {
    active?: boolean;
    connected?: boolean;
  } | null;
  waService?: {
    active?: boolean;
    connected?: boolean;
  } | null;
};

const RESTAURANT_URL = "https://app.lamojarreria.com/api/restaurant";
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
let cachedBusinessHours: {
  dateKey: string;
  businessHours: BusinessHour[] | null | undefined;
} | null = null;
let lastExpectedWaServiceActive: boolean | null = null;

const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const parseTimeToMinutes = (value: string): number | null => {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

const isWithinTimeWindow = (
  nowMinutes: number,
  openTime: string,
  closeTime: string,
) => {
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

  if (openMinutes === null || closeMinutes === null) return false;
  if (openMinutes === closeMinutes) return true;

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
};

const isRestaurantOpenNow = (
  businessHours: BusinessHour[] | null | undefined,
  date = new Date(),
) => {
  const today = DAY_KEYS[date.getDay()];
  const todayHours = businessHours?.find((hour) => hour.day === today);
  if (!todayHours?.open) return false;

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  return isWithinTimeWindow(
    nowMinutes,
    todayHours.openTime,
    todayHours.closeTime,
  );
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  if (!body) {
    throw new Error(`Missing JSON response for ${url}`);
  }

  return body;
}

export async function syncWaServiceWithBusinessHours(): Promise<void> {
  if (!APP_CONFIG.apiMaintenanceApiKey) {
    console.warn(
      "[WA_SERVICE_HOURS]: EXPO_PUBLIC_API_MAINTENANCE_API_KEY is not configured.",
    );
    return;
  }

  const todayKey = getLocalDateKey();
  if (cachedBusinessHours?.dateKey !== todayKey) {
    const restaurantPayload =
      await fetchJson<RestaurantResponse>(RESTAURANT_URL);
    cachedBusinessHours = {
      dateKey: todayKey,
      businessHours: restaurantPayload.restaurant?.businessHours,
    };
  }

  const shouldActivateWaService = !isRestaurantOpenNow(
    cachedBusinessHours.businessHours,
  );

  if (lastExpectedWaServiceActive === shouldActivateWaService) {
    return;
  }

  const statusPayload = await fetchJson<WaServiceStatusResponse>(
    `${APP_CONFIG.apiUrl}/wa-service/status`,
  );
  const isWaServiceActive = Boolean(statusPayload.status?.active);
  setWaServiceStatus({
    active: isWaServiceActive,
    connected: Boolean(statusPayload.status?.connected),
  });

  if (isWaServiceActive === shouldActivateWaService) {
    lastExpectedWaServiceActive = shouldActivateWaService;
    return;
  }

  const action = shouldActivateWaService ? "activate" : "deactivate";
  const actionPayload = await fetchJson<WaServiceStatusResponse>(
    `${APP_CONFIG.apiUrl}/wa-service/${action}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": APP_CONFIG.apiMaintenanceApiKey,
      },
    },
  );
  setWaServiceStatus({
    active: Boolean(actionPayload.waService?.active),
    connected: Boolean(actionPayload.waService?.connected),
  });
  lastExpectedWaServiceActive = shouldActivateWaService;

  console.log(
    `[WA_SERVICE_HOURS]: ${action} requested because restaurant is ${
      shouldActivateWaService ? "closed" : "open"
    }.`,
  );
}
