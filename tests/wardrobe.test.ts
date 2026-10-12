import { describe, expect, it } from 'vitest';
import { dayName, outfitDayIndex, outfitForDay, suggestOutfit } from '../src/lib/utils/wardrobe';
import type { DaySummary } from '../src/lib/types';

const names = (temp: number, rain = 0) => suggestOutfit(temp, rain).items.map((i) => i.name);

describe('suggestOutfit', () => {
	it('recommends winter gear below 45F', () => {
		const n = names(30);
		expect(n).toEqual(expect.arrayContaining(['Winter Coat', 'Scarf', 'Gloves', 'Pants', 'Sneakers']));
	});

	it('recommends light jacket + pants for 45-60F', () => {
		expect(names(55)).toEqual(expect.arrayContaining(['Light Jacket', 'Pants']));
		expect(names(55)).not.toContain('T-Shirt');
	});

	it('recommends long-sleeve + pants for 61-72F', () => {
		expect(names(70)).toEqual(expect.arrayContaining(['Long-Sleeve Shirt', 'Pants']));
		expect(names(70)).not.toContain('Shorts');
	});

	it('recommends t-shirt + shorts above 72F', () => {
		expect(names(85)).toEqual(expect.arrayContaining(['T-Shirt', 'Shorts']));
	});

	it('swaps sneakers for umbrella + rain boots when rain chance > 40%', () => {
		const r = suggestOutfit(70, 50);
		expect(r.rainy).toBe(true);
		expect(r.items.map((i) => i.name)).toEqual(['Long-Sleeve Shirt', 'Pants', 'Umbrella', 'Rain Boots']);
		expect(names(70, 40)).not.toContain('Umbrella');
	});

	it('honours custom thresholds', () => {
		const warmBlooded = { coldBelowF: 35, coolUpToF: 50, mildUpToF: 65, rainChancePct: 60 };
		expect(suggestOutfit(68, 50, warmBlooded).items.map((i) => i.name)).toContain('Shorts');
	});

	it('uses the right clothing pictures (regression: scarf/socks/necktie/sari)', () => {
		const pic = (temp: number, name: string) => suggestOutfit(temp, 0).items.find((i) => i.name === name)?.emoji;
		expect(pic(30, 'Winter Coat')).toBe('1f9e5'); // coat
		expect(pic(30, 'Scarf')).toBe('1f9e3'); // scarf
		expect(pic(85, 'T-Shirt')).toBe('1f455'); // t-shirt
		expect(pic(85, 'Shorts')).toBe('1fa73'); // shorts
	});

	it('builds a short headline summary', () => {
		expect(suggestOutfit(55, 50).summary).toBe('Light Jacket & Umbrella');
		expect(suggestOutfit(85, 0)).toMatchObject({ summary: 'T-Shirt & Sneakers', emoji: '1f455' });
	});
});

describe('outfitForDay', () => {
	const day = (school: DaySummary['school']): DaySummary => ({
		date: '2026-10-07',
		code: 0,
		temp_max_f: 78,
		temp_min_f: 48,
		rain_max: 80,
		wind_mph: 5,
		uv_max: 3,
		humidity: 50,
		hours: [],
		sunrise: null,
		sunset: null,
		school
	});

	it('dresses for the middle of the school day, not just the cold morning', () => {
		// feels 67-88: a hot afternoon wins (regression: was long sleeves at 86F)
		const hot = outfitForDay(day({ feels_min_f: 67, feels_max_f: 88, pop_max: 10 }));
		expect(hot.items.map((i) => i.name)).toEqual(['T-Shirt', 'Shorts', 'Sneakers']);
		expect(hot.rainy).toBe(false); // the 80% daily rain is outside school hours
	});

	it('adds a light jacket for a chilly morning on a warm day', () => {
		const r = outfitForDay(day({ feels_min_f: 50, feels_max_f: 76, pop_max: 0 }));
		expect(r.items.map((i) => i.name)).toEqual(['Long-Sleeve Shirt', 'Light Jacket', 'Pants', 'Sneakers']);
		expect(r.summary).toBe('Long-Sleeve Shirt & Sneakers');
	});

	it('no extra layer when the whole day is cool or cold', () => {
		const r = outfitForDay(day({ feels_min_f: 40, feels_max_f: 55, pop_max: 0 }));
		expect(r.items.map((i) => i.name)).toEqual(['Light Jacket', 'Pants', 'Sneakers']);
	});

	it('falls back to the daily numbers without school-hours data', () => {
		expect(outfitForDay(day(null)).rainy).toBe(true);
	});
});

describe('outfitDayIndex', () => {
	it('shows today until 6 PM, then tomorrow', () => {
		expect(outfitDayIndex(new Date(2026, 9, 7, 7), 18)).toBe(0);
		expect(outfitDayIndex(new Date(2026, 9, 7, 17, 59), 18)).toBe(0);
		expect(outfitDayIndex(new Date(2026, 9, 7, 18), 18)).toBe(1);
		expect(outfitDayIndex(new Date(2026, 9, 7, 23), 18)).toBe(1);
	});
});

describe('dayName', () => {
	it('names forecast days for kids', () => {
		expect(dayName('2026-10-07', 0)).toBe('Today');
		expect(dayName('2026-10-08', 1)).toBe('Tomorrow');
		expect(dayName('2026-10-09', 2)).toBe('Friday');
	});
});
