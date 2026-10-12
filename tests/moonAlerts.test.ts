import { describe, expect, it } from 'vitest';
import { moonPhase } from '../src/lib/utils/moon';
import { airInfo, alertAdvice, alertLevel } from '../src/lib/utils/forecastStory';

describe('moonPhase', () => {
	// reference dates from published lunar calendars (UTC)
	it('knows full and new moons', () => {
		expect(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))).name).toBe('Full Moon'); // Jan 25 2024 full
		expect(moonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21))).name).toBe('New Moon'); // Apr 8 2024 eclipse
		expect(moonPhase(new Date(Date.UTC(2024, 0, 25, 17, 54))).illumination).toBeGreaterThan(97);
	});

	it('quarters are half lit', () => {
		const q = moonPhase(new Date(Date.UTC(2024, 0, 18, 3, 53))); // first quarter
		expect(q.name).toBe('First Quarter');
		expect(q.illumination).toBeGreaterThan(40);
		expect(q.illumination).toBeLessThan(60);
	});

	it('always returns a twemoji moon', () => {
		for (let d = 0; d < 30; d++) {
			expect(moonPhase(new Date(Date.UTC(2026, 9, 1 + d))).emoji).toMatch(/^1f31[1-8]$/);
		}
	});
});

describe('air quality + alerts in kid words', () => {
	it('airInfo', () => {
		expect(airInfo(30).level).toBe('good');
		expect(airInfo(80).word).toBe('Air is okay');
		expect(airInfo(170).word).toBe('Play inside today');
		expect(airInfo(null).word).toBe('Air: no data');
	});

	it('alertAdvice / alertLevel', () => {
		expect(alertAdvice('Winter Storm Warning').advice).toContain('School might be closed');
		expect(alertAdvice('Heat Advisory').emoji).toBe('1f975');
		expect(alertAdvice('Severe Thunderstorm Watch').advice).toContain('rumbles');
		expect(alertAdvice('Something New').advice).toBe('Ask a grown-up what to do.');
		expect(alertLevel('Severe')).toBe('red');
		expect(alertLevel('Moderate')).toBe('orange');
		expect(alertLevel('Minor')).toBe('yellow');
	});
});
