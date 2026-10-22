import { describe, expect, it } from 'vitest';
import { easter, festivalBanner, thanksgiving, themeFor } from '../src/lib/themes';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

describe('thanksgiving', () => {
	it('is the 4th Thursday of November', () => {
		expect(thanksgiving(2026).getDate()).toBe(26);
		expect(thanksgiving(2027).getDate()).toBe(25);
		expect(thanksgiving(2025).getDate()).toBe(27);
	});
});

describe('easter', () => {
	it('matches known dates', () => {
		expect(easter(2026)).toEqual(new Date(2026, 3, 5));
		expect(easter(2027)).toEqual(new Date(2027, 2, 28));
		expect(easter(2028)).toEqual(new Date(2028, 3, 16));
	});
});

describe('themeFor: US', () => {
	it('Halloween all October (around the Indian festivals), greeting on the 31st, witch hats', () => {
		expect(themeFor(d(2026, 10, 5))).toMatchObject({ id: 'halloween', greeting: null, hat: 'witch' });
		expect(themeFor(d(2026, 10, 31))).toMatchObject({ id: 'halloween', greeting: 'Happy Halloween' });
		// Diwali 2027 is Oct 29, but Halloween itself still wins on the 31st
		expect(themeFor(d(2027, 10, 31))?.id).toBe('halloween');
	});

	it('Thanksgiving countdown in November, through the day after', () => {
		expect(themeFor(d(2026, 11, 20))).toMatchObject({ id: 'thanksgiving', greeting: null });
		expect(themeFor(d(2026, 11, 26))).toMatchObject({ id: 'thanksgiving', greeting: 'Happy Thanksgiving' });
		expect(themeFor(d(2026, 11, 27))?.id).toBe('thanksgiving');
		expect(themeFor(d(2026, 11, 28))).toBeNull();
	});

	it('Christmas in December, then winter wraps the New Year with party hats', () => {
		expect(themeFor(d(2026, 12, 10))).toMatchObject({ id: 'christmas', hat: 'winter', greeting: null });
		expect(themeFor(d(2026, 12, 25))?.greeting).toBe('Merry Christmas');
		expect(themeFor(d(2026, 12, 28))).toMatchObject({ id: 'winter', hat: 'winter' });
		expect(themeFor(d(2026, 12, 31))).toMatchObject({ hat: 'party', greeting: "Happy New Year's Eve" });
		expect(themeFor(d(2027, 1, 1))).toMatchObject({ hat: 'party', greeting: 'Happy New Year' });
		expect(themeFor(d(2027, 1, 6))?.id).toBe('winter');
		expect(themeFor(d(2027, 1, 7))).toBeNull();
	});

	it('smaller holidays and plain days', () => {
		expect(themeFor(d(2027, 2, 14))?.greeting).toBe("Happy Valentine's Day");
		expect(themeFor(d(2027, 3, 17))?.id).toBe('stpatricks');
		expect(themeFor(d(2027, 7, 4))?.greeting).toBe('Happy 4th of July');
		expect(themeFor(d(2027, 3, 28))?.greeting).toBe('Happy Easter');
		expect(themeFor(d(2027, 5, 9))?.greeting).toBe("Happy Mother's Day");
		expect(themeFor(d(2027, 6, 20))?.greeting).toBe("Happy Father's Day");
		expect(themeFor(d(2027, 5, 20))).toBeNull();
	});
});

describe('themeFor: Indian festivals', () => {
	it('Diwali: a week of build-up, greeting on the day', () => {
		expect(themeFor(d(2026, 11, 1))).toMatchObject({ id: 'diwali', greeting: null });
		expect(themeFor(d(2026, 11, 8))).toMatchObject({ id: 'diwali', greeting: 'Happy Diwali' });
		expect(themeFor(d(2026, 11, 11))?.id).toBe('diwali');
		expect(themeFor(d(2026, 11, 12))?.id).toBe('thanksgiving');
	});

	it('Navratri, Dussehra, Ganesh, Holi and the rest from the date table', () => {
		expect(themeFor(d(2026, 10, 11))).toMatchObject({ id: 'navratri', greeting: 'Happy Navratri' });
		expect(themeFor(d(2026, 10, 20))).toMatchObject({ id: 'dussehra', greeting: 'Happy Dussehra' });
		expect(themeFor(d(2026, 9, 20))?.id).toBe('ganesh');
		expect(themeFor(d(2027, 3, 22))?.greeting).toBe('Happy Holi');
		expect(themeFor(d(2027, 4, 7))?.id).toBe('padwa');
		expect(themeFor(d(2027, 8, 17))?.greeting).toBe('Happy Raksha Bandhan');
		expect(themeFor(d(2027, 8, 15))?.id).toBe('india-independence');
		expect(themeFor(d(2027, 1, 26))?.greeting).toBe('Happy Republic Day');
		expect(themeFor(d(2027, 1, 15))?.id).toBe('sankranti');
		// Eid can shift a day with the moon: greeted across its whole window
		expect(themeFor(d(2027, 3, 9))?.greeting).toBe('Eid Mubarak');
	});

	it('no table entry: no lunar festival (fixed-date ones still show)', () => {
		expect(themeFor(d(2031, 11, 1))?.id).toBe('thanksgiving');
		expect(themeFor(d(2031, 8, 15))?.id).toBe('india-independence');
	});
});

describe('festivalBanner', () => {
	it('counts down in sleeps, then cheers', () => {
		expect(festivalBanner(themeFor(d(2026, 11, 5))!, d(2026, 11, 5))).toBe('Diwali in 3 sleeps!');
		expect(festivalBanner(themeFor(d(2026, 11, 7))!, d(2026, 11, 7))).toBe('Diwali is tomorrow!');
		expect(festivalBanner(themeFor(d(2026, 11, 8))!, d(2026, 11, 8))).toBe('Happy Diwali!');
		expect(festivalBanner(themeFor(d(2026, 11, 10))!, d(2026, 11, 10))).toBe('Happy Diwali!');
		expect(festivalBanner(themeFor(d(2026, 12, 30))!, d(2026, 12, 30))).toBe('New Year in 2 sleeps!');
	});
});
