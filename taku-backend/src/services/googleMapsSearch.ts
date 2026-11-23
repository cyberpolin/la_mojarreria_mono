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

export async function searchGoogleMaps(query: string) {
  const url = new URL("https://maps.google.com/maps");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "es");
  url.searchParams.set("z", "16");
  url.searchParams.set("output", "embed");
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; TAKU/1.0; +https://taku.lat)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  return readGoogleMapsEmbedPlace(await response.text());
}
