/**
 * WMO weather interpretation codes -> Twemoji icon + kid-friendly label.
 * Day/night variants are picked by the caller via `isDay`.
 *
 * Icons are local <img> stickers (see Emoji.svelte) — never text emojis.
 */

export type WeatherCategory = 'sunny' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

export interface WeatherInfo {
	/** twemoji hex code for daytime */
	day: string;
	/** twemoji hex code for nighttime */
	night: string;
	/** kid-friendly label, e.g. "Partly Sunny" */
	label: string;
	/** label to use at night when it differs ("Sunny" -> "Clear") */
	nightLabel?: string;
	category: WeatherCategory;
}

const MAP: Record<number, WeatherInfo> = {
	0: { day: '2600', night: '1f319', label: 'Sunny', nightLabel: 'Clear', category: 'sunny' },
	1: { day: '1f324', night: '1f319', label: 'Mostly Sunny', nightLabel: 'Mostly Clear', category: 'partly' },
	2: { day: '26c5', night: '2601', label: 'Partly Sunny', nightLabel: 'Partly Cloudy', category: 'partly' },
	3: { day: '2601', night: '2601', label: 'Cloudy', category: 'cloudy' },
	45: { day: '1f32b', night: '1f32b', label: 'Foggy', category: 'fog' },
	48: { day: '1f32b', night: '1f32b', label: 'Icy Fog', category: 'fog' },
	51: { day: '1f4a7', night: '1f4a7', label: 'Light Drizzle', category: 'drizzle' },
	53: { day: '1f4a7', night: '1f4a7', label: 'Drizzle', category: 'drizzle' },
	55: { day: '1f4a7', night: '1f4a7', label: 'Heavy Drizzle', category: 'drizzle' },
	56: { day: '1f328', night: '1f328', label: 'Freezing Drizzle', category: 'rain' },
	57: { day: '1f328', night: '1f328', label: 'Freezing Drizzle', category: 'rain' },
	61: { day: '1f327', night: '1f327', label: 'Light Rain', category: 'rain' },
	63: { day: '1f327', night: '1f327', label: 'Rain', category: 'rain' },
	65: { day: '1f327', night: '1f327', label: 'Heavy Rain', category: 'rain' },
	66: { day: '1f328', night: '1f328', label: 'Freezing Rain', category: 'rain' },
	67: { day: '1f328', night: '1f328', label: 'Freezing Rain', category: 'rain' },
	71: { day: '1f328', night: '1f328', label: 'Light Snow', category: 'snow' },
	73: { day: '1f328', night: '1f328', label: 'Snow', category: 'snow' },
	75: { day: '1f328', night: '1f328', label: 'Heavy Snow', category: 'snow' },
	77: { day: '2747', night: '2747', label: 'Snow Flurries', category: 'snow' },
	80: { day: '1f326', night: '1f326', label: 'Showers', category: 'rain' },
	81: { day: '1f326', night: '1f326', label: 'Showers', category: 'rain' },
	82: { day: '1f326', night: '1f326', label: 'Violent Showers', category: 'rain' },
	85: { day: '1f328', night: '1f328', label: 'Snow Showers', category: 'snow' },
	86: { day: '1f328', night: '1f328', label: 'Snow Showers', category: 'snow' },
	95: { day: '1f329', night: '1f329', label: 'Thunderstorms', category: 'storm' },
	96: { day: '26a1', night: '26a1', label: 'Thunderstorms + Hail', category: 'storm' },
	99: { day: '26a1', night: '26a1', label: 'Thunderstorms + Hail', category: 'storm' }
};

export const UNKNOWN: WeatherInfo = {
	day: '2601',
	night: '2601',
	label: 'Cloudy',
	category: 'cloudy'
};

export function weatherInfo(code: number): WeatherInfo {
	return MAP[code] ?? UNKNOWN;
}

/** Pick the right twemoji code for the given code + isDay flag. */
export function weatherEmoji(code: number, isDay: boolean): string {
	const info = weatherInfo(code);
	return isDay ? info.day : info.night;
}

/** Label for the given code + isDay flag ("Sunny" by day, "Clear" at night). */
export function weatherLabel(code: number, isDay: boolean): string {
	const info = weatherInfo(code);
	return isDay ? info.label : (info.nightLabel ?? info.label);
}
