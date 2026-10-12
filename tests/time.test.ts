import { describe, expect, it } from 'vitest';
import { dayNumber, dayOfYear, greetingFor, hourLabel, pickDaily, shortDate } from '../src/lib/utils/time';
import facts from '../src/lib/data/facts.json';
import quotes from '../src/lib/data/quotes.json';

describe('dayOfYear', () => {
	it('is 1 on Jan 1', () => {
		expect(dayOfYear(new Date(2026, 0, 1))).toBe(1);
	});

	it('handles leap years', () => {
		expect(dayOfYear(new Date(2028, 0, 31))).toBe(31);
		expect(dayOfYear(new Date(2028, 1, 1))).toBe(32);
		expect(dayOfYear(new Date(2027, 1, 1))).toBe(32);
	});
});

describe('greetingFor', () => {
	it('morning / afternoon / evening', () => {
		expect(greetingFor(new Date(2026, 0, 1, 8))).toBe('Good Morning');
		expect(greetingFor(new Date(2026, 0, 1, 14))).toBe('Good Afternoon');
		expect(greetingFor(new Date(2026, 0, 1, 20))).toBe('Good Evening');
	});
});

describe('shortDate', () => {
	it('formats "Wed, Oct 7"', () => {
		expect(shortDate(new Date(2026, 9, 7))).toBe('Wed, Oct 7');
	});
});

describe('hourLabel', () => {
	it('formats local hour strings like Open-Meteo sends', () => {
		expect(hourLabel('2026-10-07T08:00')).toBe('8 AM');
		expect(hourLabel('2026-10-07T12:00')).toBe('12 PM');
	});
});

describe('pickDaily', () => {
	it('changes at midnight and walks through every item', () => {
		const items = ['a', 'b', 'c'];
		const seen = new Set([0, 1, 2].map((d) => pickDaily(items, new Date(2026, 9, 7 + d, 12))));
		expect(seen.size).toBe(3);
		expect(pickDaily(items, new Date(2026, 9, 7, 0, 1))).toBe(pickDaily(items, new Date(2026, 9, 7, 23, 59)));
	});

	it('keeps rotating across New Year', () => {
		expect(dayNumber(new Date(2027, 0, 1)) - dayNumber(new Date(2026, 11, 31))).toBe(1);
	});
});

describe('daily rotation data', () => {
	it('facts are structured, with 1-2 icons each', () => {
		expect(facts.length).toBeGreaterThanOrEqual(20);
		for (const f of facts) {
			expect(f.text.length).toBeGreaterThan(10);
			expect(f.emoji.length).toBeGreaterThanOrEqual(1);
			expect(f.emoji.length).toBeLessThanOrEqual(2);
		}
	});

	it('quotes all have text, author and an icon', () => {
		expect(quotes.length).toBeGreaterThanOrEqual(20);
		for (const q of quotes) {
			expect(q.text && q.author && q.emoji).toBeTruthy();
		}
	});
});
