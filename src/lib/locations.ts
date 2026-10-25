import type { Location } from "./muhurat";

const IST = "Asia/Kolkata";

/** Major Indian cities, so common lookups need no network call. */
const CITIES: Record<string, [number, number]> = {
  agra: [27.1767, 78.0081],
  ahmedabad: [23.0225, 72.5714],
  amritsar: [31.634, 74.8723],
  bengaluru: [12.9716, 77.5946],
  bangalore: [12.9716, 77.5946],
  bhopal: [23.2599, 77.4126],
  bhubaneswar: [20.2961, 85.8245],
  chandigarh: [30.7333, 76.7794],
  chennai: [13.0827, 80.2707],
  coimbatore: [11.0168, 76.9558],
  dehradun: [30.3165, 78.0322],
  delhi: [28.6139, 77.209],
  "new delhi": [28.6139, 77.209],
  goa: [15.4909, 73.8278],
  gurugram: [28.4595, 77.0266],
  gurgaon: [28.4595, 77.0266],
  guwahati: [26.1445, 91.7362],
  hyderabad: [17.385, 78.4867],
  indore: [22.7196, 75.8577],
  jaipur: [26.9124, 75.7873],
  jodhpur: [26.2389, 73.0243],
  kochi: [9.9312, 76.2673],
  kolkata: [22.5726, 88.3639],
  lucknow: [26.8467, 80.9462],
  madurai: [9.9252, 78.1198],
  mangaluru: [12.9141, 74.856],
  mumbai: [19.076, 72.8777],
  mysuru: [12.2958, 76.6394],
  mysore: [12.2958, 76.6394],
  nagpur: [21.1458, 79.0882],
  nashik: [19.9975, 73.7898],
  noida: [28.5355, 77.391],
  patna: [25.5941, 85.1376],
  pune: [18.5204, 73.8567],
  raipur: [21.2514, 81.6296],
  ranchi: [23.3441, 85.3096],
  surat: [21.1702, 72.8311],
  thiruvananthapuram: [8.5241, 76.9366],
  udaipur: [24.5854, 73.7125],
  vadodara: [22.3072, 73.1812],
  varanasi: [25.3176, 82.9739],
  vijayawada: [16.5062, 80.648],
  visakhapatnam: [17.6868, 83.2185],
};

const cache = new Map<string, Location | null>();

function key(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findKnownCity(city: string): Location | null {
  const coords = CITIES[key(city)];
  if (!coords) return null;
  return { name: city.trim(), latitude: coords[0], longitude: coords[1], timeZone: IST };
}

interface GeoResult {
  results?: { name: string; latitude: number; longitude: number; timezone?: string; country?: string }[];
}

/**
 * Finds a city's coordinates. Uses the built-in list first, then the free
 * Open-Meteo geocoding service (no key needed). Results are cached in memory.
 */
export async function findLocation(
  city: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 4000,
): Promise<Location | null> {
  const k = key(city);
  if (cache.has(k)) return cache.get(k) ?? null;

  const known = findKnownCity(city);
  if (known) {
    cache.set(k, known);
    return known;
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name=${encodeURIComponent(
      city.trim(),
    )}`;
    const res = await fetcher(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as GeoResult;
    const hit = data.results?.[0];
    const location: Location | null = hit
      ? {
          name: hit.country ? `${hit.name}, ${hit.country}` : hit.name,
          latitude: hit.latitude,
          longitude: hit.longitude,
          timeZone: hit.timezone || IST,
        }
      : null;
    cache.set(k, location);
    return location;
  } catch {
    return null; // network issues should never break plan generation
  }
}

/** For tests. */
export function clearLocationCache(): void {
  cache.clear();
}
