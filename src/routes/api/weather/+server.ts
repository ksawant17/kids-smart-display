import { json } from '@sveltejs/kit';
import { getWeather } from '#lib/server/weather';

/**
 * GET /api/weather
 * Current conditions, next-24h hourly (2-hour steps) and 7 daily summaries from
 * Open-Meteo, in imperial units. Cached for 5 minutes; if Open-Meteo is down
 * the last good forecast is served with `stale: true`.
 */
export async function GET() {
	const data = await getWeather();
	return data ? json(data) : json({ error: 'Could not reach the weather service' }, { status: 502 });
}
