import { describe, expect, it } from 'vitest';
import { weatherInfo, weatherEmoji, weatherLabel } from '../src/lib/utils/weatherCodes';

describe('weatherInfo (WMO -> twemoji + label)', () => {
	it('maps clear day/sky codes', () => {
		expect(weatherInfo(0).label).toBe('Sunny');
		expect(weatherInfo(0).day).toBe('2600');
		expect(weatherInfo(2).label).toBe('Partly Sunny');
	});

	it('uses the moon at night for clear skies', () => {
		expect(weatherInfo(0).night).toBe('1f319');
		expect(weatherEmoji(0, false)).toBe('1f319');
		expect(weatherEmoji(0, true)).toBe('2600');
	});

	it('maps rain / drizzle / snow / storm families', () => {
		expect(weatherInfo(63).category).toBe('rain');
		expect(weatherInfo(53).category).toBe('drizzle');
		expect(weatherInfo(75).category).toBe('snow');
		expect(weatherInfo(95).category).toBe('storm');
		expect(weatherInfo(95).day).toBe('1f329');
	});

	it('falls back to a cloud labelled "Cloudy" for unknown codes', () => {
		expect(weatherInfo(999).label).toBe('Cloudy');
		expect(weatherInfo(999).day).toBe('2601');
	});

	it('partly cloudy at night is a cloud, not a rain cloud (regression)', () => {
		expect(weatherEmoji(2, false)).toBe('2601');
	});

	it('uses night labels with the moon', () => {
		expect(weatherLabel(0, false)).toBe('Clear');
		expect(weatherLabel(0, true)).toBe('Sunny');
		expect(weatherLabel(63, false)).toBe('Rain');
	});

	it('all codes are valid twemoji hex ids', () => {
		for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) {
			const info = weatherInfo(code);
			expect(info.day).toMatch(/^[0-9a-f]{4,8}(-[0-9a-f]{4,8})?$/);
			expect(info.night).toMatch(/^[0-9a-f]{4,8}(-[0-9a-f]{4,8})?$/);
		}
	});
});
