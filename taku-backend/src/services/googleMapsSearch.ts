export type GoogleMapsPlace = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  kilometers?: number;
};

type MapPoint = {
  latitude: number;
  longitude: number;
};

type ParsedPlace = GoogleMapsPlace & {
  origin?: MapPoint;
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

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, " ")).trim();
  } catch {
    return value.replace(/\+/g, " ").trim();
  }
}

function readLatLng(value: string): MapPoint | null {
  const match = value.match(/^(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!isCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function readDirectionsLink(text: string): ParsedPlace | null {
  const match = text.match(/\/maps\/dir\/([^?#]+)/);
  if (!match?.[1]) return null;
  const segments = match[1].split("/").map(decodeSegment).filter(Boolean);
  const address = segments
    .filter(
      (part) =>
        !part.startsWith("@") && !part.startsWith("data=") && !readLatLng(part),
    )
    .at(-1);
  if (!address) return null;
  const pins = [...text.matchAll(/!1d(-?\d{1,3}\.\d+)!2d(-?\d{1,2}\.\d+)/g)];
  const pin = pins.at(-1);
  if (!pin) return null;
  const longitude = Number(pin[1]);
  const latitude = Number(pin[2]);
  if (!isCoordinate(latitude, longitude)) return null;
  return {
    name: address.split(",")[0]?.trim() || address,
    address,
    latitude,
    longitude,
    origin: segments.map(readLatLng).find((point) => point) ?? undefined,
  };
}

export function readGoogleMapsLink(value: string): ParsedPlace | null {
  const text = extractUrl(value);
  const directions = readDirectionsLink(text);
  if (directions) return directions;
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

const MAPS_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; TAKU/1.0; +https://taku.lat)",
  "accept-language": "es-MX,es;q=0.9",
};

export function readDirectionsPreviewPath(html: string) {
  const match = html.match(/\/maps\/preview\/directions\?[^"'\\\s]+/);
  if (!match?.[0]) return null;
  return match[0].replace(/&amp;/g, "&").replace(/\\u0026/g, "&");
}

function valueAt(data: unknown, path: number[]) {
  let current = data;
  for (const index of path) {
    if (!Array.isArray(current)) return undefined;
    current = current[index];
  }
  return current;
}

export function readDirectionsDistanceMeters(payload: string) {
  let data: unknown;
  try {
    data = JSON.parse(payload.replace(/^\)\]\}'\s*/, ""));
  } catch {
    return null;
  }
  const meters = valueAt(data, [0, 1, 0, 0, 2, 0]);
  if (
    typeof meters !== "number" ||
    !Number.isFinite(meters) ||
    meters < 0 ||
    meters > 2_000_000
  ) {
    return null;
  }
  return meters;
}

export function kilometersFromMeters(meters: number) {
  return Math.round((meters / 1000) * 10) / 10;
}

async function readDrivingKilometers(origin: MapPoint, destination: MapPoint) {
  const embed = new URL("https://www.google.com/maps/dir/");
  embed.searchParams.set("api", "1");
  embed.searchParams.set("origin", `${origin.latitude},${origin.longitude}`);
  embed.searchParams.set(
    "destination",
    `${destination.latitude},${destination.longitude}`,
  );
  embed.searchParams.set("travelmode", "driving");
  embed.searchParams.set("hl", "es");
  embed.searchParams.set("output", "embed");
  const page = await fetch(embed, {
    headers: MAPS_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!page.ok) return null;
  const previewPath = readDirectionsPreviewPath(await page.text());
  if (!previewPath) return null;
  const previewUrl = allowedMapsUrl(previewPath, "https://www.google.com");
  if (!previewUrl) return null;
  const preview = await fetch(previewUrl, {
    headers: MAPS_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!preview.ok) return null;
  const meters = readDirectionsDistanceMeters(await preview.text());
  if (meters == null) return null;
  return kilometersFromMeters(meters);
}

async function withRouteKilometers(place: ParsedPlace | null) {
  if (!place) return null;
  const { origin, ...location } = place;
  if (
    !origin ||
    (Math.abs(origin.latitude - place.latitude) < 0.00001 &&
      Math.abs(origin.longitude - place.longitude) < 0.00001)
  ) {
    return location;
  }
  try {
    const kilometers = await readDrivingKilometers(origin, location);
    if (kilometers == null) return location;
    return { ...location, kilometers };
  } catch {
    return location;
  }
}

export async function resolveGoogleMapsLink(value: string) {
  const direct = readGoogleMapsLink(value);
  if (direct) return withRouteKilometers(direct);
  let current = allowedMapsUrl(extractUrl(value));
  if (!current) return null;
  for (let hop = 0; hop < 5; hop += 1) {
    const found = readGoogleMapsLink(current);
    if (found && /@|!3d|[?&](?:q|ll|query)=/.test(current)) {
      return withRouteKilometers(found);
    }
    const response = await fetch(current, {
      redirect: "manual",
      headers: MAPS_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return withRouteKilometers(found);
      const next = allowedMapsUrl(location, current);
      if (!next)
        return withRouteKilometers(found ?? readGoogleMapsLink(location));
      current = next;
      continue;
    }
    if (!response.ok) return withRouteKilometers(found);
    const finalUrl = response.url || current;
    const fromUrl = readGoogleMapsLink(finalUrl);
    if (fromUrl) return withRouteKilometers(fromUrl);
    return (
      readGoogleMapsEmbedPlace(await response.text()) ??
      (await withRouteKilometers(found))
    );
  }
  return withRouteKilometers(readGoogleMapsLink(current));
}
