import { describe, expect, it } from 'vitest';
import { HOURLY_DEFAULTS, announcement, announces, hourName } from '../src/lib/utils/announce';
import type { DaySummary, HourEntry, WeatherData } from '../src/lib/types';

const at = (h: number) => new Date(2026, 9, 29, h, 0, 0);
const hour = (h: number, pop = 0, code = 2): HourEntry => ({
	time: at(h).toISOString(),
	temp_f: 60,
	pop,
	weather_code: code,
	is_day: 1
});
const day = (max: number, code = 2): DaySummary => ({
	date: '',
	code,
	temp_max_f: max,
	temp_min_f: 50,
	rain_max: 0,
	wind_mph: 3,
	uv_max: null,
	humidity: null,
	sunrise: null,
	sunset: null,
	hours: [],
	school: null
});
const wx = (o: Partial<WeatherData> = {}): WeatherData => ({
	location: '',
	timezone: '',
	fetched_at: '',
	stale: false,
	air: null,
	alerts: [],
	current: { temp_f: 63.6, feels_f: 63, wind_mph: 3, weather_code: 2, humidity: 50, is_day: 1 },
	hourly: [hour(16), hour(17), hour(18)],
	days: [day(69.4), day(71, 61)],
	...o
});
const opts = { weather: true, first: false, tomorrowFrom: 18 };

describe('hourly announcement', () => {
	it('says the time and the weather', () => {
		expect(announcement(at(15), wx(), opts)).toBe("It's 3 o'clock! It's 64 degrees and partly sunny.");
	});

	it('says only the time without the weather', () => {
		expect(announcement(at(12), wx(), { ...opts, weather: false })).toBe("It's 12 o'clock, lunchtime!");
		expect(announcement(at(9), null, opts)).toBe("It's 9 o'clock!");
		expect(announcement(at(9), wx({ stale: true }), opts)).toBe("It's 9 o'clock!");
	});

	it('warns about rain in the next 3 hours', () => {
		const w = wx({ hourly: [hour(16), hour(17, 70, 61), hour(19, 90, 61)] });
		expect(announcement(at(15), w, opts)).toContain('Rain is likely around 5.');
		expect(announcement(at(13), w, opts)).not.toContain('likely');
	});

	it("gives today's high first thing, tomorrow in the evening", () => {
		expect(announcement(at(7), wx(), { ...opts, first: true })).toContain("Today's high is 69.");
		const evening = announcement(at(18), wx(), opts);
		expect(evening).toMatch(/Tomorrow looks [a-z ]+, with a high of 71\.$/);
		expect(evening).not.toContain('Today');
	});

	it('mentions a weather alert', () => {
		const w = wx({ alerts: [{ event: 'Wind Advisory', severity: 'Moderate', headline: '', ends: null }] });
		expect(announcement(at(10), w, opts)).toContain("There's a weather alert: Wind Advisory.");
	});

	it('knows which hours are announced', () => {
		expect(announces(7, HOURLY_DEFAULTS)).toBe(true);
		expect(announces(20, HOURLY_DEFAULTS)).toBe(true);
		expect(announces(21, HOURLY_DEFAULTS)).toBe(false);
		expect(announces(6, HOURLY_DEFAULTS)).toBe(false);
		expect(announces(23, { ...HOURLY_DEFAULTS, from: 22, to: 2 })).toBe(true);
		expect(announces(10, { ...HOURLY_DEFAULTS, enabled: false })).toBe(false);
		expect(hourName(0)).toBe('12 midnight');
		expect(hourName(12)).toBe('12 noon');
		expect(hourName(20)).toBe('8 PM');
	});
});
