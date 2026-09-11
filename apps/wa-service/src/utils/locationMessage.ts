import type { proto } from "@whiskeysockets/baileys";

export type WhatsAppLocation = {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
};

function readCoordinate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readLocationFromWhatsApp(
  message: proto.IMessage | null | undefined,
): WhatsAppLocation | null {
  if (!message) return null;
  const location = message.locationMessage ?? message.liveLocationMessage;
  if (!location) return null;
  const latitude = readCoordinate(location.degreesLatitude);
  const longitude = readCoordinate(location.degreesLongitude);
  if (latitude == null || longitude == null) return null;
  const name =
    "name" in location && typeof location.name === "string"
      ? location.name.trim()
      : "";
  const address =
    "address" in location && typeof location.address === "string"
      ? location.address.trim()
      : "caption" in location && typeof location.caption === "string"
        ? location.caption.trim()
        : "";
  return {
    latitude,
    longitude,
    name: name || undefined,
    address: address || undefined,
  };
}

export function formatLocationBody(location: WhatsAppLocation) {
  if (location.name && location.address) {
    return `${location.name} · ${location.address}`;
  }
  return location.address || location.name || "Ubicacion";
}
