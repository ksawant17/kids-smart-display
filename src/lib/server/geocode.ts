/**
 * US ZIP code -> place name, coordinates and time zone, for the admin tab.
 * Open-Meteo's geocoder first (same service as the forecast; it knows the time
 * zone too), then Zippopotam.us, with the time zone from an Open-Meteo forecast.
 */
import { placeName } from '#lib/utils/admin';

export interface ZipPlace {
	zip: string;
	name: string;
	latitude: number;
	longitude: number;
	timezone: string | null;
}

const TIMEOUT = 8000;

/** null on 404 (Zippopotam's "no such ZIP") */
async function getJson(url: string): Promise<unknown> {
	const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function openMeteo(zip: string): Promise<ZipPlace | null> {
	const params = new URLSearchParams({ name: zip, countryCode: 'US', count: '5', language: 'en' });
	const raw = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`)) as {
		results?: { name: string; admin1?: string; latitude: number; longitude: number; timezone?: string; postcodes?: string[] }[];
	};
	// only a place that really lists this ZIP (a name search can match anything)
	const hit = raw?.results?.find((r) => r.postcodes?.includes(zip));
	if (!hit) return null;
	return {
		zip,
		name: placeName(hit.name, hit.admin1),
		latitude: hit.latitude,
		longitude: hit.longitude,
		timezone: hit.timezone ?? null
	};
}

async function zippopotam(zip: string): Promise<ZipPlace | null> {
	const raw = (await getJson(`https://api.zippopotam.us/us/${zip}`)) as {
		places?: { 'place name': string; 'state abbreviation': string; latitude: string; longitude: string }[];
	};
	const p = raw?.places?.[0];
	if (!p) return null;
	const latitude = Number(p.latitude);
	const longitude = Number(p.longitude);
	let timezone: string | null = null;
	try {
		const f = (await getJson(
			`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&timezone=auto&forecast_days=1`
		)) as { timezone?: string };
		timezone = f.timezone ?? null;
	} catch {
		/* the place is still useful without it */
	}
	return { zip, name: placeName(p['place name'], p['state abbreviation']), latitude, longitude, timezone };
}

/** null = no such ZIP; throws when neither service can be reached. */
export async function lookupZip(zip: string): Promise<ZipPlace | null> {
	let lastErr: unknown = null;
	for (const source of [openMeteo, zippopotam]) {
		try {
			const place = await source(zip);
			if (place) return place;
		} catch (err) {
			lastErr = err;
		}
	}
	if (lastErr) throw lastErr;
	return null;
}
