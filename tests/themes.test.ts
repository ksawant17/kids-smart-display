import { describe, expect, it } from 'vitest';
import { thanksgiving, themeFor } from '../src/lib/themes';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

describe('thanksgiving', () => {
	it('is the 4th Thursday of November', () => {
		expect(thanksgiving(2026).getDate()).toBe(26);
		expect(thanksgiving(2027).getDate()).toBe(25);
		expect(thanksgiving(2025).getDate()).toBe(27);
	});
});

describe('themeFor', () => {
	it('Halloween all October, greeting on the 31st, witch hats', () => {
		expect(themeFor(d(2026, 10, 11))).toMatchObject({ id: 'halloween', greeting: null, hat: 'witch' });
		expect(themeFor(d(2026, 10, 31))?.greeting).toBe('Happy Halloween');
	});

	it('Thanksgiving through the day after', () => {
		expect(themeFor(d(2026, 11, 26))).toMatchObject({ id: 'thanksgiving', greeting: 'Happy Thanksgiving' });
		expect(themeFor(d(2026, 11, 27))?.id).toBe('thanksgiving');
		expect(themeFor(d(2026, 11, 28))).toBeNull();
	});

	it('winter wraps the New Year, party hats for the countdown', () => {
		expect(themeFor(d(2026, 12, 10))).toMatchObject({ id: 'winter', hat: 'winter' });
		expect(themeFor(d(2026, 12, 31))).toMatchObject({ hat: 'party', greeting: "Happy New Year's Eve" });
		expect(themeFor(d(2027, 1, 1))).toMatchObject({ hat: 'party', greeting: 'Happy New Year' });
		expect(themeFor(d(2027, 1, 6))?.id).toBe('winter');
		expect(themeFor(d(2027, 1, 7))).toBeNull();
	});

	it('smaller holidays and plain days', () => {
		expect(themeFor(d(2027, 2, 14))?.greeting).toBe("Happy Valentine's Day");
		expect(themeFor(d(2027, 3, 17))?.id).toBe('stpatricks');
		expect(themeFor(d(2027, 7, 4))?.greeting).toBe('Happy 4th of July');
		expect(themeFor(d(2027, 5, 12))).toBeNull();
	});
});
