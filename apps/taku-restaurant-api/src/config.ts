import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

loadDotenv({ path: resolve(process.cwd(), ".env") });

function stringValue(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function numberValue(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a number`);
  return value;
}

function stringList(name: string, fallback: string[]) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const config = {
  environment: stringValue(
    "TAKU_RESTAURANT_ENV",
    process.env.NODE_ENV ?? "development",
  ),
  host: stringValue("HOST", "0.0.0.0"),
  port: numberValue("PORT", 3160),
  dataFile: stringValue(
    "TAKU_RESTAURANT_DATA_FILE",
    "./data/taku-restaurant.json",
  ),
  jwtSecret: stringValue(
    "TAKU_RESTAURANT_JWT_SECRET",
    "dev-only-change-taku-restaurant-jwt-secret",
  ),
  refreshSecret: stringValue(
    "TAKU_RESTAURANT_REFRESH_SECRET",
    "dev-only-change-taku-restaurant-refresh-secret",
  ),
  publicBaseUrl: stringValue(
    "TAKU_RESTAURANT_PUBLIC_BASE_URL",
    "https://api.restaurant.taku.lat/api",
  ),
  allowedOrigins: Array.from(
    new Set([
      ...stringList("TAKU_RESTAURANT_ALLOWED_ORIGINS", [
        "https://restaurant.taku.lat",
        "https://www.restaurant.taku.lat",
        "http://localhost:3007",
      ]),
      "https://restaurant.taku.lat",
      "http://localhost:3007",
      "http://127.0.0.1:3007",
    ]),
  ),
  ownerEmail: stringValue(
    "TAKU_RESTAURANT_OWNER_EMAIL",
    "cyberpolin@gmail.com",
  ).toLowerCase(),
  ownerPassword: stringValue("TAKU_RESTAURANT_OWNER_PASSWORD", "changeme"),
  ownerName: stringValue("TAKU_RESTAURANT_OWNER_NAME", "La Mojarreria"),
  deviceKey: stringValue(
    "TAKU_RESTAURANT_DEVICE_KEY",
    "taku-restaurant-device-kiosk001",
  ),
  cloudinary: {
    cloudName: stringValue("CLOUDINARY_CLOUD_NAME", ""),
    apiKey: stringValue("CLOUDINARY_API_KEY", ""),
    apiSecret: stringValue("CLOUDINARY_API_SECRET", ""),
    folder: stringValue("CLOUDINARY_API_FOLDER", "mojarreria"),
  },
} as const;
