import { US_STATES } from '../data/usStates';

/**
 * Photon (OpenStreetMap) — free public instance, no API key.
 * Fair use: debounce client-side; for high traffic consider self-hosting Photon.
 * @see https://photon.komoot.io
 */

const PHOTON_BASE = 'https://photon.komoot.io/api';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';

export interface ParsedPlaceAddress {
  street: string;
  city: string;
  postal: string;
  countryCode: string;
  regionRaw: string;
}

export interface AddressSuggestion {
  id: string;
  label: string;
  parsed: ParsedPlaceAddress;
}

interface PhotonProps {
  osm_id?: number;
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  locality?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  [key: string]: unknown;
}

interface PhotonFeature {
  properties: PhotonProps;
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

interface NominatimItem {
  place_id?: number;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
  };
}

function parsePhotonFeature(f: PhotonFeature): ParsedPlaceAddress {
  const p = f.properties;
  const street =
    [p.housenumber, p.street].filter(Boolean).join(' ').trim() ||
    (typeof p.name === 'string' ? p.name : '') ||
    '';
  const city =
    p.city ||
    p.town ||
    p.village ||
    p.locality ||
    (typeof p.county === 'string' ? p.county : '') ||
    '';
  const postal = typeof p.postcode === 'string' ? p.postcode : '';
  const countryCode = String(p.countrycode || '').toUpperCase();
  const regionRaw = typeof p.state === 'string' ? p.state : '';
  return { street, city, postal, countryCode, regionRaw };
}

function featureLabel(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' ').trim(),
    p.postcode,
    p.city || p.town || p.village || p.locality,
    p.state,
    p.country,
  ].filter(Boolean);
  if (parts.length) return parts.join(', ');
  return typeof p.name === 'string' ? p.name : 'Address';
}

/** US state name or 2-letter code → US_STATES code. */
export function resolveUsStateCode(regionRaw: string): string {
  const r = String(regionRaw || '').trim();
  if (!r) return '';
  const upper = r.toUpperCase();
  if (upper.length === 2 && US_STATES.some((s) => s.code === upper)) return upper;
  const byName = US_STATES.find((s) => s.name.toLowerCase() === r.toLowerCase());
  return byName?.code || '';
}

export interface CitySuggestion {
  id: string;
  label: string;
  /** Plain city name to put in the form */
  cityName: string;
}

function cityNameFromPhoton(f: PhotonFeature): string {
  const p = f.properties;
  if (typeof p.name === 'string' && p.name.trim()) return p.name.trim();
  return (
    p.city ||
    p.town ||
    p.village ||
    p.locality ||
    ''
  ).trim();
}

function cityFeatureLabel(f: PhotonFeature): string {
  const p = f.properties;
  const name = cityNameFromPhoton(f);
  const parts = [name || p.name, p.state, p.country].filter(Boolean);
  return parts.join(', ');
}

/** Cities / towns via Photon `layer=city` (same free API). */
export async function searchPhotonCities(
  query: string,
  options?: { countryCode?: string; usStateCode?: string }
): Promise<CitySuggestion[]> {
  let q = query.trim();
  if (q.length < 1) return [];
  // Single-letter queries are noisy without state context; allow them when a US state is selected.
  if (q.length < 2 && !(options?.countryCode === 'US' && options.usStateCode)) return [];

  if (options?.countryCode === 'US' && options.usStateCode) {
    const stateName = US_STATES.find((s) => s.code === options.usStateCode)?.name;
    if (stateName) q = `${q} ${stateName}`;
  }

  const params = new URLSearchParams({
    q,
    limit: '12',
    lang: 'en',
    layer: 'city',
  });
  const url = `${PHOTON_BASE}/?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = (await res.json()) as PhotonResponse;
  const features = Array.isArray(data.features) ? data.features : [];

  let list = features.filter((f) => cityNameFromPhoton(f));

  const cc = options?.countryCode?.toLowerCase();
  if (cc && cc.length === 2) {
    const filtered = list.filter(
      (f) => String(f.properties?.countrycode || '').toLowerCase() === cc
    );
    if (filtered.length > 0) list = filtered;
  }

  if (options?.countryCode === 'US' && options.usStateCode) {
    const want = options.usStateCode.toUpperCase();
    const byState = list.filter((f) => {
      const raw = String(f.properties?.state || '');
      return resolveUsStateCode(raw) === want;
    });
    if (byState.length > 0) list = byState;
  }

  const seen = new Set<string>();
  const out: CitySuggestion[] = [];

  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    const cityName = cityNameFromPhoton(f);
    if (!cityName) continue;
    const dedupeKey = `${cityName.toLowerCase()}|${String(f.properties?.countrycode || '')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      id: `${f.properties?.osm_id ?? i}-city-${i}`,
      label: cityFeatureLabel(f),
      cityName,
    });
  }

  return out;
}

export async function searchPhotonAddresses(
  query: string,
  options?: { countryCode?: string; usStateCode?: string; city?: string; postal?: string }
): Promise<AddressSuggestion[]> {
  const base = query.trim();
  const ctxCity = String(options?.city || '').trim();
  const ctxPostal = String(options?.postal || '').trim();
  const ctxStateName =
    options?.usStateCode && options.countryCode === 'US'
      ? US_STATES.find((s) => s.code === options.usStateCode)?.name || ''
      : '';

  const q = [base, ctxCity, ctxStateName, ctxPostal].filter(Boolean).join(' ').trim();
  if (q.length < 3) return [];

  // House-number queries are typically more accurate with Nominatim than Photon.
  const looksLikeStreetNumber = /^\s*\d{1,6}\b/.test(base);
  const nominatimResults = await searchNominatimAddresses(q, options);
  if (looksLikeStreetNumber && nominatimResults.length > 0) return nominatimResults;

  const params = new URLSearchParams({
    q,
    limit: '10',
    lang: 'en',
  });
  const url = `${PHOTON_BASE}/?${params.toString()}`;

  const res = await fetch(url);
  if (!res.ok) return nominatimResults;

  const data = (await res.json()) as PhotonResponse;
  const features = Array.isArray(data.features) ? data.features : [];

  let list: PhotonFeature[] = features;
  const cc = options?.countryCode?.toLowerCase();
  if (cc && cc.length === 2) {
    list = list.filter(
      (f) => String(f.properties?.countrycode || '').toLowerCase() === cc
    );
  }

  const mapped = list.map((f, i) => {
    const id = `${f.properties?.osm_id ?? i}-${i}`;
    return {
      id,
      label: featureLabel(f),
      parsed: parsePhotonFeature(f),
    };
  });

  if (mapped.length > 0) return mapped;
  return nominatimResults;
}

async function searchNominatimAddresses(
  query: string,
  options?: { countryCode?: string; usStateCode?: string; city?: string; postal?: string }
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '10',
  });

  const cc = options?.countryCode?.toLowerCase();
  if (cc && cc.length === 2) params.set('countrycodes', cc);

  const res = await fetch(`${NOMINATIM_BASE}?${params.toString()}`);
  if (!res.ok) return [];

  const data = (await res.json()) as NominatimItem[];
  if (!Array.isArray(data)) return [];

  return data.map((item, i) => {
    const a = item.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ').trim();
    const city = a.city || a.town || a.village || a.municipality || a.county || '';
    const parsed: ParsedPlaceAddress = {
      street,
      city,
      postal: a.postcode || '',
      countryCode: String(a.country_code || '').toUpperCase(),
      regionRaw: a.state || '',
    };

    return {
      id: `nominatim-${item.place_id ?? i}`,
      label: item.display_name || [street, city, a.state].filter(Boolean).join(', ') || 'Address',
      parsed,
    };
  });
}
