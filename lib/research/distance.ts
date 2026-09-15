/**
 * How far away a competitor actually is, in miles.
 *
 * WHY THIS REPLACED WORD MATCHING
 * Proximity is the heaviest factor in choosing which competitors matter, and it
 * was comparing address strings. Two businesses in a town almost never share a
 * street name, so it matched nobody and the most important factor contributed
 * nothing to any run.
 *
 * WHAT WE KEEP, AND WHAT WE DO NOT
 * A full UK postcode identifies a household, and for a sole trader working from
 * home that is their home. So a postcode is used and thrown away: it goes to
 * the lookup, comes back as a position, and the position is rounded to three
 * decimal places before anything is stored. That is about a hundred metres,
 * which is far more than enough to say a barber is a quarter of a mile away and
 * not enough to say which building.
 *
 * postcodes.io is run by Ideal Postcodes on Ordnance Survey open data. No
 * account, no key, and it takes up to a hundred postcodes in one request.
 */

export type Point = { lat: number; lon: number };

/** About a hundred metres. Enough for "a quarter of a mile", not a doorstep. */
export const round = (p: Point): Point => ({
  lat: Math.round(p.lat * 1000) / 1000,
  lon: Math.round(p.lon * 1000) / 1000,
});

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

/** The postcode inside an address, or null. */
export function postcodeIn(address: string | null | undefined): string | null {
  if (!address) return null;
  const m = UK_POSTCODE.exec(address);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : null;
}

/** The district, "SY1", which is a place rather than a household and is kept. */
export function districtIn(address: string | null | undefined): string | null {
  if (!address) return null;
  const full = UK_POSTCODE.exec(address);
  if (full) return full[1].toUpperCase();
  const bare = /\b([A-Z]{1,2}\d[A-Z\d]?)\b(?!\s*\d[A-Z]{2})/i.exec(address);
  return bare ? bare[1].toUpperCase() : null;
}

/**
 * Positions for a list of postcodes, in one request.
 *
 * Returns what it could resolve and quietly omits what it could not. A postcode
 * that does not exist is a fact about that listing, not a reason to fail: the
 * competitor still counts, they just score nothing for distance, which is the
 * same as any other number we could not read.
 */
export async function positionsFor(
  postcodes: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, Point>> {
  const found = new Map<string, Point>();
  const wanted = [...new Set(postcodes.filter(Boolean))].slice(0, 100);
  if (!wanted.length) return found;

  try {
    const response = await fetchImpl("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: wanted }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return found;

    const body = (await response.json()) as {
      result?: { query: string; result: { latitude: number; longitude: number } | null }[];
    };

    for (const row of body.result ?? []) {
      if (row.result) {
        found.set(row.query.toUpperCase().replace(/\s+/g, " "), round({
          lat: row.result.latitude,
          lon: row.result.longitude,
        }));
      }
    }
  } catch {
    // Down, slow, or blocked. Everyone scores zero for distance, which is the
    // same as it was before this existed. Never a reason to fail a run.
  }
  return found;
}

/** Straight-line miles. A town is small enough that roads do not change the
 *  ranking, and a drive time would need a paid service and an account. */
export function milesBetween(a: Point, b: Point): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

/** How a distance is said on screen. Never more precision than we have. */
export function sayMiles(miles: number): string {
  if (miles < 0.1) return "next door";
  if (miles < 1) return `${Math.round(miles * 10) / 10} miles away`;
  return `${Math.round(miles * 10) / 10} miles away`;
}
