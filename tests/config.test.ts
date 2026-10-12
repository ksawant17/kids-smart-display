import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT_CONFIG, kidNames, resolveConfig } from '../src/lib/config';

describe('resolveConfig', () => {
	it('falls back to defaults for missing / garbage input', () => {
		expect(resolveConfig(undefined)).toEqual(DEFAULT_CONFIG);
		expect(resolveConfig('nope')).toEqual(DEFAULT_CONFIG);
	});

	it('drops invalid values but keeps valid ones', () => {
		const c = resolveConfig({
			kids: [{ name: 'Ava', avatar: 'not-an-emoji' }, { name: '' }, 'x'],
			location: { name: 'Home', latitude: 999, longitude: -77 },
			screen: { brightness: 2, minBrightness: 10, dimBrightness: 'low', offAfterMinutes: -5 }
		});
		expect(c.kids).toEqual([{ name: 'Ava', avatar: 'bear', color: '#b388ff' }]);
		expect(c.location).toEqual({ name: 'Home', latitude: DEFAULT_CONFIG.location.latitude, longitude: -77 });
		expect(c.screen).toEqual({ ...DEFAULT_CONFIG.screen, brightness: DEFAULT_CONFIG.screen.brightness });
	});

	it('kids pick an animal buddy (or a twemoji code) and a clothes colour', () => {
		const c = resolveConfig({
			kids: [
				{ name: 'A', avatar: 'monkey', color: '#123abc' },
				{ name: 'B', avatar: '1f467-1f3fd', color: 'blue' },
				{ name: 'C', avatar: 'dragon' }
			]
		});
		expect(c.kids).toEqual([
			{ name: 'A', avatar: 'monkey', color: '#123abc' },
			{ name: 'B', avatar: '1f467-1f3fd', color: '#3b82f6' },
			{ name: 'C', avatar: 'bear', color: '#f472b6' }
		]);
	});

	it('screen timers of 0 are allowed (= never)', () => {
		const c = resolveConfig({ screen: { dimAfterMinutes: 0, offAfterMinutes: 0 } });
		expect(c.screen).toMatchObject({ dimAfterMinutes: 0, offAfterMinutes: 0 });
	});

	it('the shipped config/dashboard.example.json is fully valid', () => {
		const raw = JSON.parse(readFileSync('config/dashboard.example.json', 'utf8'));
		const c = resolveConfig(raw);
		expect(c.kids.map((k) => k.name)).toEqual(raw.kids.map((k: { name: string }) => k.name));
		expect(c.kids.map((k) => k.avatar)).toEqual(raw.kids.map((k: { avatar: string }) => k.avatar));
		expect(c.kids.map((k) => k.color)).toEqual(raw.kids.map((k: { color: string }) => k.color));
		expect(c.school.icsUrl).toBe(raw.school.icsUrl);
	});
});

describe('kidNames', () => {
	it('joins names naturally', () => {
		expect(kidNames([{ name: 'Alex', avatar: '', color: '' }])).toBe('Alex');
		expect(kidNames([{ name: 'Alex', avatar: '', color: '' }, { name: 'Sam', avatar: '', color: '' }])).toBe('Alex & Sam');
		expect(kidNames(['A', 'B', 'C'].map((name) => ({ name, avatar: '', color: '' })))).toBe('A, B & C');
	});
});
