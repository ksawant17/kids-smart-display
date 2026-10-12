/**
 * Kid-language helpers for the full weather report (pure, unit-testable):
 * a short "sky story", wind words, UV advice, temperature colours, daylight.
 */
import type { DaySummary, HourEntry } from '#lib/types';
import { weatherInfo } from './weatherCodes';

const hourOf = (iso: string) => new Date(iso).getHours();

/** "tonight" / "in the morning" / "around lunch" / "after lunch" / "this evening" */
export function partOfDay(hour: number): string {
	if (hour < 5) return 'tonight'; // the small hours belong to the night before
	if (hour < 11) return 'in the morning';
	if (hour < 13) return 'around lunch';
	if (hour < 17) return 'after lunch';
	if (hour < 20) return 'this evening';
	return 'tonight';
}

function tempWord(high: number): string {
	if (high < 40) return 'Brrr, a freezing day';
	if (high < 55) return 'A chilly day';
	if (high < 65) return 'A cool day';
	if (high < 75) return 'A comfy day';
	if (high < 85) return 'A warm day';
	return 'A hot day';
}

/**
 * One or two short sentences about the day, e.g.
 * "A warm day. Rain likely after lunch, grab your umbrella!"
 */
export function skyStory(day: DaySummary, hours: HourEntry[]): string {
	const parts: string[] = [];
	const cat = weatherInfo(day.code).category;
	const low = day.school?.feels_min_f ?? day.temp_min_f;
	const high = day.school?.feels_max_f ?? day.temp_max_f;

	if (low <= 52 && high >= 68) parts.push('Chilly morning, warm afternoon.');
	else parts.push(`${tempWord(day.temp_max_f)}.`);

	const wet = hours.find((h) => h.pop >= 50);
	if (cat === 'snow') parts.push('Snow is possible, so bundle up!');
	else if (cat === 'storm') parts.push('Thunderstorms around. Stay inside when it rumbles!');
	else if (wet) parts.push(`Rain likely ${partOfDay(hourOf(wet.time))}. Grab your umbrella!`);
	else if (day.rain_max >= 30) parts.push('Maybe a shower or two.');
	else if (day.wind_mph >= 20) parts.push('Hold on to your hat, it is windy!');
	else if ((day.uv_max ?? 0) >= 6) parts.push('Strong sun, so wear sunscreen!');
	else if (cat === 'sunny' || cat === 'partly') parts.push('Great day to play outside!');
	else parts.push('Staying dry.');

	return parts.join(' ');
}

/** Wind in kid words, with a twemoji code. */
export function windWord(mph: number): { word: string; emoji: string } {
	if (mph < 6) return { word: 'Calm', emoji: '1f343' }; // leaves
	if (mph < 13) return { word: 'Breezy', emoji: '1f343' };
	if (mph < 20) return { word: 'Windy', emoji: '1fa81' }; // kite
	return { word: 'Very windy!', emoji: '1f32c' }; // wind face
}

/** UV index advice. */
export function uvInfo(uv: number | null): { word: string; emoji: string; level: 'low' | 'mid' | 'high' } {
	if (uv == null) return { word: 'Sun: no data', emoji: '2600', level: 'low' };
	if (uv < 3) return { word: 'Low sun', emoji: '1f60e', level: 'low' };
	if (uv < 6) return { word: 'Sunglasses', emoji: '1f576', level: 'mid' };
	return { word: 'Sunscreen!', emoji: '1f9f4', level: 'high' };
}

/** Dot / text colour for a temperature: blue (cold) -> green -> orange -> red (hot). */
export function tempColor(f: number): string {
	if (f < 40) return '#60a5fa';
	if (f < 55) return '#38bdf8';
	if (f < 65) return '#34d399';
	if (f < 75) return '#facc15';
	if (f < 85) return '#fb923c';
	return '#ef4444';
}

/** "11h 22m" of daylight between sunrise and sunset. */
export function daylight(sunrise: string, sunset: string): string {
	const mins = Math.max(0, Math.round((new Date(sunset).getTime() - new Date(sunrise).getTime()) / 60000));
	return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

/** Where the sun is on its arc, 0 (sunrise) .. 1 (sunset); null when it's down. */
export function sunProgress(now: Date, sunrise: string, sunset: string): number | null {
	const a = new Date(sunrise).getTime();
	const b = new Date(sunset).getTime();
	const t = now.getTime();
	if (t < a || t > b) return null;
	return (t - a) / (b - a);
}

/** US air quality index in kid words. */
export function airInfo(aqi: number | null | undefined): { word: string; emoji: string; level: 'good' | 'ok' | 'bad' } {
	if (aqi == null) return { word: 'Air: no data', emoji: '1f343', level: 'ok' };
	if (aqi <= 50) return { word: 'Air is great', emoji: '1f33f', level: 'good' };
	if (aqi <= 100) return { word: 'Air is okay', emoji: '1f343', level: 'ok' };
	if (aqi <= 150) return { word: 'Take it easy outside', emoji: '1f637', level: 'bad' };
	return { word: 'Play inside today', emoji: '1f637', level: 'bad' };
}

/** Kid-friendly advice for a National Weather Service alert. */
export function alertAdvice(event: string): { advice: string; emoji: string } {
	const e = event.toLowerCase();
	if (/winter|snow|ice|blizzard|freez|frost|sleet/.test(e))
		return { advice: 'Bundle up! School might be closed, ask a grown-up.', emoji: '2744' };
	if (/heat/.test(e)) return { advice: 'Drink lots of water and stay cool.', emoji: '1f975' };
	if (/thunder|tornado|lightning/.test(e)) return { advice: 'Stay inside when it rumbles!', emoji: '26a1' };
	if (/flood|rain/.test(e)) return { advice: 'Stay away from deep water.', emoji: '1f30a' };
	if (/wind|gale/.test(e)) return { advice: 'Hold on to your hat!', emoji: '1f32c' };
	if (/fog/.test(e)) return { advice: 'Extra careful at the bus stop.', emoji: '1f32b' };
	if (/air quality|smoke/.test(e)) return { advice: 'Play inside today.', emoji: '1f637' };
	if (/cold|chill/.test(e)) return { advice: 'Wear your warmest coat!', emoji: '1f976' };
	return { advice: 'Ask a grown-up what to do.', emoji: '26a0' };
}

/** Severe/extreme alerts are red, moderate orange, the rest yellow. */
export function alertLevel(severity: string): 'red' | 'orange' | 'yellow' {
	if (severity === 'Extreme' || severity === 'Severe') return 'red';
	if (severity === 'Moderate') return 'orange';
	return 'yellow';
}
