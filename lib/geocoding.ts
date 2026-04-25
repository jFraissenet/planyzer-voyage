// Address autocomplete via OpenStreetMap Nominatim.
// Free, no API key. Rate-limited to ~1 req/s — debounce on the caller side.
// https://nominatim.org/release-docs/latest/api/Search/

export type AddressSuggestion = {
  /** Short, human-friendly label suitable for inputs/cards (e.g. "Place de la Comédie, Lyon"). */
  short: string;
  /** Full address as returned by Nominatim, used for the dropdown context. */
  display: string;
  lat: number;
  lng: number;
  mapsUrl: string;
};

type NominatimAddress = {
  name?: string;
  amenity?: string;
  attraction?: string;
  tourism?: string;
  shop?: string;
  building?: string;
  house_number?: string;
  road?: string;
  pedestrian?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
};

function buildShortLabel(item: NominatimItem): string {
  const a = item.address ?? {};
  const place = a.name || a.amenity || a.attraction || a.tourism || a.shop;
  const street = [a.house_number, a.road || a.pedestrian]
    .filter(Boolean)
    .join(" ")
    .trim();
  const city =
    a.city || a.town || a.village || a.municipality || a.county;

  const primary = place || street || a.suburb || a.neighbourhood;
  const secondary = city || a.state || a.country;

  if (primary && secondary && primary !== secondary)
    return `${primary}, ${secondary}`;
  if (primary) return primary;
  if (secondary) return secondary;
  // Fallback: first two comma-separated parts of display_name.
  const parts = item.display_name
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

/** Shorten an arbitrary stored address (e.g. legacy entries with the full
 *  Nominatim display_name) to keep cards readable. */
export function shortenAddress(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 2) return trimmed;
  return `${parts[0]}, ${parts[1]}`;
}

export async function searchAddresses(
  query: string,
  options?: { signal?: AbortSignal; language?: string },
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    format: "json",
    q: trimmed,
    addressdetails: "1",
    limit: "5",
  });

  const headers: Record<string, string> = {
    "User-Agent": "Planyzer/1.0 (contact: jeremy.fraissenet@neoteem.fr)",
    "Accept-Language": options?.language ?? "fr,en;q=0.8",
  };

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { signal: options?.signal, headers },
  );
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);

  const data = (await res.json()) as NominatimItem[];

  return data.map((item) => {
    const lat = Number.parseFloat(item.lat);
    const lng = Number.parseFloat(item.lon);
    return {
      short: buildShortLabel(item),
      display: item.display_name,
      lat,
      lng,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    };
  });
}

export function buildMapsUrlFromText(text: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    text.trim(),
  )}`;
}
