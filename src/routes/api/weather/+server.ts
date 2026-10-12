import { json } from '@sveltejs/kit';
import { getConfig } from '#lib/server/config';
import { TtlCache } from '#lib/server/cache';
import type { WeatherData } from '#lib/types';

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

// Short server cache: the kiosk polls every config.weather.refreshMinutes.
const cache = new TtlCache<WeatherData>(5 * 60 * 1000);

interface OpenMeteoResponse {
	timezone: string;
	utc_offset_seconds: number;
	current: {
		time: string;
		temperature_2m: number;
		apparent_temperature: number;
		weather_code: number;
		wind_speed_10m: number;
		relative_humidity_2m: number;
		is_day: number;
	};
	hourly: {
		time: string[];
		temperature_2m: number[];
		apparent_temperature: number[];
		precipitation_probability: (number | null)[];
		weather_code: number[];
		is_day: number[];
		relative_humidity_2m: (number | null)[];
	};
	daily: {
		time: string[];
		weather_code: number[];
		temperature_2m_max: number[];
		temperature_2m_min: number[];
		precipitation_probability_max: (number | null)[];
		wind_speed_10m_max: (number | null)[];
		uv_index_max: (number | null)[];
		sunrise: string[];
		sunset: string[];
	};
}

/** Open-Meteo sends naive local times ("2026-10-07T08:00"); pin them to the
 *  location's UTC offset so they parse correctly whatever the server's TZ. */
function withOffset(local: string, offsetSec: number): string {
	const sign = offsetSec < 0 ? '-' : '+';
	const abs = Math.abs(offsetSec);
	const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
	const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
	return `${local.length === 16 ? local + ':00' : local}${sign}${hh}:${mm}`;
}

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

async function fetchWeather(): Promise<WeatherData> {
	const { location, school } = getConfig();
	const params = new URLSearchParams({
		latitude: String(location.latitude),
		longitude: String(location.longitude),
		current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day',
		hourly:
			'temperature_2m,apparent_temperature,precipitation_probability,weather_code,is_day,relative_humidity_2m',
		daily:
			'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset',
		timezone: 'auto',
		forecast_days: '7', // the WARDROBE tab can plan the week
		temperature_unit: 'fahrenheit',
		wind_speed_unit: 'mph'
	});

	const res = await fetch(`${OPEN_METEO}?${params}`, { signal: AbortSignal.timeout(15000) });
	if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
	const raw = (await res.json()) as OpenMeteoResponse;
	const off = raw.utc_offset_seconds;
	const h = raw.hourly;

	const allHours = h.time.map((t, i) => ({
		local: t,
		time: withOffset(t, off),
		temp_f: h.temperature_2m[i],
		feels_f: h.apparent_temperature[i],
		pop: h.precipitation_probability[i] ?? 0,
		weather_code: h.weather_code[i],
		is_day: h.is_day[i] ?? 1,
		humidity: h.relative_humidity_2m[i]
	}));

	// Next 24 hours from the current hour, in 2-hour steps.
	const nowMs = Date.now();
	const hourly = allHours
		.filter((x) => {
			const delta = new Date(x.time).getTime() - nowMs;
			return delta > -3600_000 && delta < 24 * 3600_000;
		})
		.filter((_, i) => i % 2 === 0)
		.map(({ time, temp_f, pop, weather_code, is_day }) => ({ time, temp_f, pop, weather_code, is_day }));

	const days = raw.daily.time.map((d, i) => {
		const ofDay = allHours.filter((x) => x.local.startsWith(d));
		const hourOf = (x: { local: string }) => Number(x.local.slice(11, 13));
		const schoolHours = ofDay.filter((x) => hourOf(x) >= school.startHour && hourOf(x) < school.endHour);
		const humid = ofDay.map((x) => x.humidity).filter((v): v is number => typeof v === 'number');
		// the waking day in 2-hour steps (6 AM - 10 PM), for the full report
		const hours = ofDay
			.filter((x) => hourOf(x) >= 6 && hourOf(x) <= 22 && hourOf(x) % 2 === 0)
			.map(({ time, temp_f, pop, weather_code, is_day }) => ({ time, temp_f, pop, weather_code, is_day }));
		return {
			date: d,
			code: raw.daily.weather_code[i],
			temp_max_f: raw.daily.temperature_2m_max[i],
			temp_min_f: raw.daily.temperature_2m_min[i],
			rain_max: raw.daily.precipitation_probability_max[i] ?? 0,
			wind_mph: raw.daily.wind_speed_10m_max[i] ?? 0,
			uv_max: raw.daily.uv_index_max[i] ?? null,
			humidity: avg(humid),
			sunrise: raw.daily.sunrise[i] ? withOffset(raw.daily.sunrise[i], off) : null,
			sunset: raw.daily.sunset[i] ? withOffset(raw.daily.sunset[i], off) : null,
			hours,
			// what it feels like while the kids are out (bus stop -> pickup)
			school: schoolHours.length
				? {
						feels_min_f: Math.min(...schoolHours.map((x) => x.feels_f)),
						feels_max_f: Math.max(...schoolHours.map((x) => x.feels_f)),
						pop_max: Math.max(...schoolHours.map((x) => x.pop))
					}
				: null
		};
	});

	return {
		location: location.name,
		current: {
			temp_f: raw.current.temperature_2m,
			feels_f: raw.current.apparent_temperature,
			wind_mph: raw.current.wind_speed_10m,
			weather_code: raw.current.weather_code,
			humidity: raw.current.relative_humidity_2m,
			is_day: raw.current.is_day
		},
		hourly,
		days,
		timezone: raw.timezone,
		fetched_at: new Date().toISOString(),
		stale: false
	};
}

/**
 * GET /api/weather
 * Current conditions, next-24h hourly (2-hour steps) and 7 daily summaries from
 * Open-Meteo, in imperial units. Cached for 5 minutes; if Open-Meteo is down
 * the last good forecast is served with `stale: true`.
 */
export async function GET() {
	const { location } = getConfig();
	const key = `${location.latitude},${location.longitude}`;
	const fresh = cache.get(key);
	if (fresh) return json(fresh);

	try {
		const data = await fetchWeather();
		cache.set(key, data);
		return json(data);
	} catch (err) {
		console.warn(`[weather] ${err}`);
		const stale = cache.getStale(key);
		if (stale) return json({ ...stale, stale: true });
		return json({ error: 'Could not reach the weather service' }, { status: 502 });
	}
}
