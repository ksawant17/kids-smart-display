import { describe, expect, it } from 'vitest';
import { outfitDayIndex, outfitForDay, suggestOutfit } from '../src/lib/utils/wardrobe';
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

	it('recommends long-sleeve for 61-72F', () => {
		expect(names(70)).toContain('Long-Sleeve Shirt');
		expect(names(70)).not.toContain('Shorts');
	});

	it('recommends t-shirt + shorts above 72F', () => {
		expect(names(85)).toEqual(expect.arrayContaining(['T-Shirt', 'Shorts']));
	});

	it('swaps sneakers for umbrella + rain boots when rain chance > 40%', () => {
		const r = suggestOutfit(70, 50);
		expect(r.rainy).toBe(true);
		expect(r.items.map((i) => i.name)).toEqual(['Long-Sleeve Shirt', 'Umbrella', 'Rain Boots']);
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
		humidity: 50,
		sunrise: null,
		sunset: null,
		school
	});

	it('dresses for the coldest school-hours feels-like, not the afternoon high', () => {
		const r = outfitForDay(day({ feels_min_f: 50, feels_max_f: 76, pop_max: 10 }));
		expect(r.items.map((i) => i.name)).toContain('Light Jacket');
		expect(r.rainy).toBe(false); // the 80% rain is outside school hours
	});

	it('falls back to the daily numbers without school-hours data', () => {
		expect(outfitForDay(day(null)).rainy).toBe(true);
	});
});

describe('outfitDayIndex', () => {
	it('shows today until school is out, then tomorrow', () => {
		expect(outfitDayIndex(new Date(2026, 9, 7, 7), 15)).toBe(0);
		expect(outfitDayIndex(new Date(2026, 9, 7, 15), 15)).toBe(1);
	});
});
