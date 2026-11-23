export type GoogleMapsPlace = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

const PLACE_PATTERN =
  /"((?:[^"\\]|\\.){2,220})",\[(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)\]/g;

function isCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function unescapeMapsText(value: string) {
  return value
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
}

export function readGoogleMapsEmbedPlace(html: string): GoogleMapsPlace | null {
  for (const match of html.matchAll(PLACE_PATTERN)) {
    const address = unescapeMapsText(match[1] ?? "").trim();
    const latitude = Number(match[2]);
    const longitude = Number(match[3]);
    if (!address || !isCoordinate(latitude, longitude)) continue;
    const name = address.split(",")[0]?.trim() || address;
    return { name, address, latitude, longitude };
  }
  return null;
}

const COORDINATE_PATTERNS = [
  /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
  /[?&](?:q|ll|query)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
];

function placeNameFromUrl(value: string) {
  const match = value.match(/\/maps\/place\/([^/?#]+)/);
  if (!match?.[1]) return null;
  try {
    const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    return name || null;
  } catch {
    return null;
  }
}

function extractUrl(value: string) {
  const match = value.match(/https?:\/\/\S+/i);
  return (match?.[0] ?? value).trim().replace(/[),.;]+$/, "");
}

export function readGoogleMapsLink(value: string): GoogleMapsPlace | null {
  const text = extractUrl(value);
  for (const pattern of COORDINATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!isCoordinate(latitude, longitude)) continue;
    const name = placeNameFromUrl(text) ?? "Ubicacion";
    return { name, address: name, latitude, longitude };
  }
  return null;
}

function allowedMapsUrl(value: string, base?: string) {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return null;
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const googleHost =
    host === "google.com" ||
    host.endsWith(".google.com") ||
    host === "google.com.mx" ||
    host.endsWith(".google.com.mx") ||
    host.startsWith("maps.google.");
  const shortHost = host === "maps.app.goo.gl" || host === "goo.gl";
  if (!googleHost && !shortHost) return null;
  if (host === "goo.gl" && !url.pathname.startsWith("/maps")) return null;
  if (
    googleHost &&
    !host.startsWith("maps.google.") &&
    !url.pathname.startsWith("/maps")
  ) {
    return null;
  }
  return url.toString();
}

export async function resolveGoogleMapsLink(value: string) {
  const direct = readGoogleMapsLink(value);
  if (direct) return direct;
  let current = allowedMapsUrl(extractUrl(value));
  if (!current) return direct;
  for (let hop = 0; hop < 5; hop += 1) {
    const found = readGoogleMapsLink(current);
    if (found && /@|!3d|[?&](?:q|ll|query)=/.test(current)) return found;
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; TAKU/1.0; +https://taku.lat)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return found;
      const next = allowedMapsUrl(location, current);
      if (!next) return found ?? readGoogleMapsLink(location);
      current = next;
      continue;
    }
    if (!response.ok) return found;
    const finalUrl = response.url || current;
    const fromUrl = readGoogleMapsLink(finalUrl);
    if (fromUrl) return fromUrl;
    return readGoogleMapsEmbedPlace(await response.text()) ?? found;
  }
  return readGoogleMapsLink(current);
}
