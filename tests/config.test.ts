import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, inTimeWindow, kidNames, resolveConfig } from '../src/lib/config';

describe('resolveConfig', () => {
	it('falls back to defaults for missing / garbage input', () => {
		expect(resolveConfig(undefined)).toEqual(DEFAULT_CONFIG);
		expect(resolveConfig('nope')).toEqual(DEFAULT_CONFIG);
	});

	it('drops invalid values but keeps valid ones', () => {
		const c = resolveConfig({
			kids: [{ name: 'Ava', avatar: 'not-an-emoji' }, { name: '' }, 'x'],
			location: { name: 'Home', latitude: 999, longitude: -77 },
			kiosk: { nightDim: { from: '25:00', to: '07:00', opacity: 5 } }
		});
		expect(c.kids).toEqual([{ name: 'Ava', avatar: '1f9d2' }]);
		expect(c.location).toEqual({ name: 'Home', latitude: DEFAULT_CONFIG.location.latitude, longitude: -77 });
		expect(c.kiosk.nightDim).toEqual({ from: '20:30', to: '07:00', opacity: DEFAULT_CONFIG.kiosk.nightDim!.opacity });
	});

	it('nightDim: null turns dimming off', () => {
		expect(resolveConfig({ kiosk: { nightDim: null } }).kiosk.nightDim).toBeNull();
	});

	it('the shipped config/dashboard.example.json is fully valid', () => {
		const raw = JSON.parse(readFileSync('config/dashboard.example.json', 'utf8'));
		const c = resolveConfig(raw);
		expect(c.kids.map((k) => k.name)).toEqual(raw.kids.map((k: { name: string }) => k.name));
		expect(c.kids.map((k) => k.avatar)).toEqual(raw.kids.map((k: { avatar: string }) => k.avatar));
		expect(c.school.icsUrl).toBe(raw.school.icsUrl);
	});
});

describe('kidNames', () => {
	it('joins names naturally', () => {
		expect(kidNames([{ name: 'Alex', avatar: '' }])).toBe('Alex');
		expect(kidNames([{ name: 'Alex', avatar: '' }, { name: 'Sam', avatar: '' }])).toBe('Alex & Sam');
		expect(kidNames(['A', 'B', 'C'].map((name) => ({ name, avatar: '' })))).toBe('A, B & C');
	});
});

describe('inTimeWindow', () => {
	const at = (h: number, m = 0) => new Date(2026, 9, 7, h, m);
	it('handles windows that wrap past midnight', () => {
		expect(inTimeWindow(at(21), '20:30', '06:30')).toBe(true);
		expect(inTimeWindow(at(3), '20:30', '06:30')).toBe(true);
		expect(inTimeWindow(at(6, 30), '20:30', '06:30')).toBe(false);
		expect(inTimeWindow(at(12), '20:30', '06:30')).toBe(false);
	});
	it('handles same-day windows', () => {
		expect(inTimeWindow(at(13), '12:00', '14:00')).toBe(true);
		expect(inTimeWindow(at(14), '12:00', '14:00')).toBe(false);
	});
});
