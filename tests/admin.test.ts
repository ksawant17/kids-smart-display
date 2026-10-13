import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	isLocalDateTime,
	isPin,
	isTimezone,
	isZip,
	parseTimedate,
	placeName,
	tzLabel,
	uptimeLabel
} from '../src/lib/utils/admin';
import { resolveConfig } from '../src/lib/config';

describe('admin input checks', () => {
	it('ZIP codes and PINs', () => {
		expect(isZip('22030')).toBe(true);
		expect(isZip('2203')).toBe(false);
		expect(isZip('22030-1234')).toBe(false);
		expect(isZip(22030)).toBe(false);
		expect(isPin('0420')).toBe(true);
		expect(isPin('12345')).toBe(false);
		expect(isPin('12a4')).toBe(false);
	});

	it('time zones: IANA names only', () => {
		expect(isTimezone('America/New_York')).toBe(true);
		expect(isTimezone('America/Argentina/Buenos_Aires')).toBe(true);
		expect(isTimezone('UTC')).toBe(true);
		expect(isTimezone('--help')).toBe(false);
		expect(isTimezone('America/New York')).toBe(false);
		expect(isTimezone('../../etc/passwd')).toBe(false);
	});

	it('manual time format', () => {
		expect(isLocalDateTime('2026-10-12 21:30')).toBe(true);
		expect(isLocalDateTime('2026-10-12T21:30')).toBe(false);
		expect(isLocalDateTime('now')).toBe(false);
	});
});

describe('admin labels', () => {
	it('place names use state abbreviations', () => {
		expect(placeName('Fairfax', 'Virginia')).toBe('Fairfax, VA');
		expect(placeName('Fairfax', 'VA')).toBe('Fairfax, VA');
		expect(placeName('Washington', 'District of Columbia')).toBe('Washington, DC');
		expect(placeName('Somewhere')).toBe('Somewhere');
	});

	it('time zone labels', () => {
		expect(tzLabel('America/Chicago')).toBe('Central');
		expect(tzLabel('Europe/Isle_of_Man')).toBe('Europe/Isle of Man');
	});

	it('uptime', () => {
		expect(uptimeLabel(8 * 60 + 5)).toBe('8 min');
		expect(uptimeLabel(5 * 3600 + 12 * 60)).toBe('5 h 12 min');
		expect(uptimeLabel(86400 + 4 * 3600)).toBe('1 day 4 h');
		expect(uptimeLabel(3 * 86400)).toBe('3 days 0 h');
	});
});

describe('parseTimedate', () => {
	it('reads `timedatectl show`', () => {
		const out = 'Timezone=America/New_York\nLocalRTC=no\nCanNTP=yes\nNTP=yes\nNTPSynchronized=no\nTimeUSec=Mon 2026-10-12 21:42:05 EDT\n';
		expect(parseTimedate(out)).toEqual({ timezone: 'America/New_York', ntp: true, synced: false });
	});
	it('falls back to UTC', () => {
		expect(parseTimedate('')).toEqual({ timezone: 'UTC', ntp: false, synced: false });
	});
});

describe('config: location zip', () => {
	it('keeps a valid ZIP, drops a bad one', () => {
		const loc = { name: 'X', latitude: 1, longitude: 2 };
		expect(resolveConfig({ location: { ...loc, zip: '22030' } }).location.zip).toBe('22030');
		expect(resolveConfig({ location: { ...loc, zip: 'abc' } }).location).not.toHaveProperty('zip');
		expect(resolveConfig({ location: loc }).location).not.toHaveProperty('zip');
	});
});

describe('server: updateConfig and PIN', () => {
	let dir: string;
	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), 'kids-admin-'));
		vi.stubEnv('DASHBOARD_CONFIG', join(dir, 'dashboard.json'));
		vi.stubEnv('DASHBOARD_DATA', dir);
	});
	afterAll(() => {
		vi.unstubAllEnvs();
		rmSync(dir, { recursive: true, force: true });
	});

	it('merges sections and keeps everything else as written', async () => {
		const file = join(dir, 'dashboard.json');
		writeFileSync(file, JSON.stringify({ kids: [{ name: 'Alex', avatar: 'fox' }], screen: { brightness: 80, dimAfterMinutes: 10 } }));
		const { updateConfig } = await import('../src/lib/server/config');
		const config = updateConfig({
			location: { zip: '60601', name: 'Chicago, IL', latitude: 41.88, longitude: -87.62 },
			screen: { dimAfterMinutes: 5 }
		});
		expect(config.location).toEqual({ zip: '60601', name: 'Chicago, IL', latitude: 41.88, longitude: -87.62 });
		expect(config.screen.dimAfterMinutes).toBe(5);
		const raw = JSON.parse(readFileSync(file, 'utf8'));
		expect(raw.kids).toEqual([{ name: 'Alex', avatar: 'fox' }]);
		expect(raw.screen).toEqual({ brightness: 80, dimAfterMinutes: 5 });
	});

	it('PIN: set, check, lock out after 5 wrong tries', async () => {
		const admin = await import('../src/lib/server/admin');
		expect(admin.pinIsSet()).toBe(false);
		admin.savePin('2468');
		expect(admin.pinIsSet()).toBe(true);
		expect(readFileSync(join(dir, 'admin.json'), 'utf8')).not.toContain('2468');
		expect(admin.checkPin('2468')).toEqual({ ok: true });
		for (let i = 4; i >= 1; i--) expect(admin.checkPin('0000')).toEqual({ ok: false, triesLeft: i });
		expect(admin.checkPin('0000')).toMatchObject({ ok: false, waitSeconds: 300 });
		// locked: even the right PIN waits
		expect(admin.checkPin('2468')).toMatchObject({ ok: false });
	});
});
