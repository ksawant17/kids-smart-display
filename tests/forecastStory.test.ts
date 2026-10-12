import { describe, expect, it } from 'vitest';
import { daylight, partOfDay, skyStory, sunProgress, tempColor, uvInfo, windWord } from '../src/lib/utils/forecastStory';
import type { DaySummary, HourEntry } from '../src/lib/types';

const day = (over: Partial<DaySummary> = {}): DaySummary => ({
	date: '2026-10-12',
	code: 0,
	temp_max_f: 70,
	temp_min_f: 58,
	rain_max: 0,
	wind_mph: 5,
	uv_max: 3,
	humidity: 50,
	sunrise: null,
	sunset: null,
	school: null,
	hours: [],
	...over
});
const hour = (h: number, pop: number): HourEntry => ({
	time: `2026-10-12T${String(h).padStart(2, '0')}:00:00-04:00`,
	temp_f: 60,
	pop,
	weather_code: 61,
	is_day: 1
});

describe('skyStory', () => {
	it('says when the rain comes and what to do', () => {
		const s = skyStory(day({ code: 61, rain_max: 80 }), [hour(8, 10), hour(14, 70)]);
		expect(s).toBe('A comfy day. Rain likely after lunch. Grab your umbrella!');
	});

	it('spots a chilly morning before a warm afternoon', () => {
		const s = skyStory(day({ school: { feels_min_f: 48, feels_max_f: 74, pop_max: 0 } }), []);
		expect(s).toBe('Chilly morning, warm afternoon. Great day to play outside!');
	});

	it('warns about strong sun and wind', () => {
		expect(skyStory(day({ uv_max: 8, temp_max_f: 88 }), [])).toBe('A hot day. Strong sun, so wear sunscreen!');
		expect(skyStory(day({ code: 3, wind_mph: 25 }), [])).toContain('windy');
	});

	it('snow and storms come first', () => {
		expect(skyStory(day({ code: 73, temp_max_f: 30 }), [hour(9, 90)])).toBe('Brrr, a freezing day. Snow is possible, so bundle up!');
		expect(skyStory(day({ code: 95 }), [hour(15, 90)])).toContain('Thunderstorms');
	});
});

describe('little helpers', () => {
	it('partOfDay', () => {
		expect(partOfDay(3)).toBe('tonight');
		expect(partOfDay(8)).toBe('in the morning');
		expect(partOfDay(12)).toBe('around lunch');
		expect(partOfDay(15)).toBe('after lunch');
		expect(partOfDay(18)).toBe('this evening');
		expect(partOfDay(21)).toBe('tonight');
	});

	it('windWord / uvInfo / tempColor', () => {
		expect(windWord(3).word).toBe('Calm');
		expect(windWord(15).word).toBe('Windy');
		expect(windWord(30).word).toBe('Very windy!');
		expect(uvInfo(7)).toMatchObject({ word: 'Sunscreen!', level: 'high' });
		expect(uvInfo(null).level).toBe('low');
		expect(tempColor(30)).not.toBe(tempColor(90));
	});

	it('daylight and the sun arc', () => {
		const rise = '2026-10-12T07:15:00-04:00';
		const set = '2026-10-12T18:37:00-04:00';
		expect(daylight(rise, set)).toBe('11h 22m');
		expect(sunProgress(new Date('2026-10-12T12:56:00-04:00'), rise, set)).toBeCloseTo(0.5, 2);
		expect(sunProgress(new Date('2026-10-12T21:00:00-04:00'), rise, set)).toBeNull();
	});
});
