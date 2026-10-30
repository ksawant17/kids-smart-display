/**
 * The hourly clock announcement: "It's 3 o'clock! It's 64 degrees and
 * partly cloudy. Rain is likely around 5." Built from the forecast the
 * dashboard already has (no AI needed), short enough to say in a breath.
 */
import type { WeatherData } from '#lib/types';
import { weatherInfo, weatherLabel } from '#lib/utils/weatherCodes';

export interface HourlySettings {
	enabled: boolean;
	/** first and last hour (0-23) that are announced */
	from: number;
	to: number;
	/** add the weather after the time */
	weather: boolean;
}

export const HOURLY_DEFAULTS: HourlySettings = { enabled: true, from: 7, to: 20, weather: true };

/** 7 -> "7 AM", 12 -> "12 noon", 0 -> "12 midnight" (the admin tab's labels) */
export function hourName(h: number): string {
	if (h === 0) return '12 midnight';
	if (h === 12) return '12 noon';
	return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** Is hour `h` one that gets announced? (from > to wraps past midnight) */
export function announces(h: number, s: HourlySettings): boolean {
	if (!s.enabled) return false;
	return s.from <= s.to ? h >= s.from && h <= s.to : h >= s.from || h <= s.to;
}

function clock(h: number): string {
	if (h === 12) return "It's 12 o'clock, lunchtime!";
	if (h === 0) return "It's midnight.";
	return `It's ${h % 12} o'clock!`;
}

const RAINY: Record<string, string> = { drizzle: 'Rain is', rain: 'Rain is', storm: 'Storms are', snow: 'Snow is' };

/**
 * What to say at `now` (on the hour). `first`: the first announcement of the
 * day, which also gives today's high; `tomorrowFrom`: from this hour on (the
 * evening switch, as on TODAY) the last bit is about tomorrow instead.
 */
export function announcement(
	now: Date,
	wx: WeatherData | null,
	o: { weather: boolean; first: boolean; tomorrowFrom: number }
): string {
	const parts = [clock(now.getHours())];
	if (o.weather) parts.push(...weatherNews(now, wx, o));
	return parts.join(' ');
}

/**
 * The weather in a few short sentences (none when there's no fresh forecast):
 * the hourly announcement and the wake-up alarm's good morning.
 */
export function weatherNews(now: Date, wx: WeatherData | null, o: { first: boolean; tomorrowFrom: number }): string[] {
	if (!wx || wx.stale) return [];
	const h = now.getHours();
	const parts: string[] = [];

	const label = weatherLabel(wx.current.weather_code, wx.current.is_day === 1).toLowerCase();
	parts.push(`It's ${Math.round(wx.current.temp_f)} degrees and ${label}.`);

	// rain (or snow) in the next 3 hours
	const soon = now.getTime() + 3 * 3600_000;
	const wet = wx.hourly.find((e) => {
		const t = new Date(e.time).getTime();
		return t > now.getTime() && t <= soon && e.pop >= 50 && RAINY[weatherInfo(e.weather_code).category];
	});
	const rainingNow = !!RAINY[weatherInfo(wx.current.weather_code).category];
	if (wet && !rainingNow) {
		const at = new Date(wet.time).getHours() % 12 || 12;
		parts.push(`${RAINY[weatherInfo(wet.weather_code).category]} likely around ${at}.`);
	}

	if (wx.alerts.length) parts.push(`There's a weather alert: ${wx.alerts[0].event}.`);

	const today = wx.days[0];
	const tomorrow = wx.days[1];
	if (h === o.tomorrowFrom && tomorrow) {
		parts.push(`Tomorrow looks ${weatherLabel(tomorrow.code, true).toLowerCase()}, with a high of ${Math.round(tomorrow.temp_max_f)}.`);
	} else if (o.first && today) {
		parts.push(`Today's high is ${Math.round(today.temp_max_f)}.`);
	}
	return parts;
}
