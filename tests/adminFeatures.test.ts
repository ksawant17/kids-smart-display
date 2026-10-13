import { describe, expect, it } from 'vitest';
import { awakeMode, inBedtime, modeForIdle } from '../src/lib/screen';
import { resolveConfig } from '../src/lib/config';
import { cleanMessage, messagesOn, whenLabel, type ParentMessage } from '../src/lib/utils/messages';
import { hhmmLabel, parseWifiList, signalBars, splitTerse } from '../src/lib/utils/admin';

const at = (h: number, m = 0) => new Date(2026, 9, 12, h, m);
const screen = resolveConfig({}).screen;

describe('bedtime', () => {
	const bed = { enabled: true, start: '20:30', end: '06:30' };

	it('wraps past midnight', () => {
		expect(inBedtime(at(20, 29), bed)).toBe(false);
		expect(inBedtime(at(20, 30), bed)).toBe(true);
		expect(inBedtime(at(23, 59), bed)).toBe(true);
		expect(inBedtime(at(0, 0), bed)).toBe(true);
		expect(inBedtime(at(6, 29), bed)).toBe(true);
		expect(inBedtime(at(6, 30), bed)).toBe(false);
		expect(inBedtime(at(12), bed)).toBe(false);
	});

	it('same-day window, off switch, empty window', () => {
		const nap = { enabled: true, start: '13:00', end: '15:00' };
		expect(inBedtime(at(14), nap)).toBe(true);
		expect(inBedtime(at(15), nap)).toBe(false);
		expect(inBedtime(at(22), { ...bed, enabled: false })).toBe(false);
		expect(inBedtime(at(22), { enabled: true, start: '22:00', end: '22:00' })).toBe(false);
	});

	it('at bedtime: dim while in use, off after a minute', () => {
		expect(modeForIdle(0, screen, true)).toBe('dim');
		expect(modeForIdle(59_000, screen, true)).toBe('dim');
		expect(modeForIdle(60_000, screen, true)).toBe('off');
		// daytime rules unchanged
		expect(modeForIdle(60_000, screen)).toBe('on');
		expect(awakeMode(true)).toBe('dim');
		expect(awakeMode(false)).toBe('on');
	});

	it('config: defaults off, bad times fall back', () => {
		expect(resolveConfig({}).bedtime).toEqual({ enabled: false, start: '20:30', end: '06:30' });
		expect(resolveConfig({ bedtime: { enabled: true, start: '21:00', end: '7:00' } }).bedtime).toEqual({
			enabled: true,
			start: '21:00',
			end: '06:30'
		});
		expect(resolveConfig({ bedtime: { enabled: 'yes' } }).bedtime.enabled).toBe(false);
	});

	it('time labels', () => {
		expect(hhmmLabel('20:30')).toBe('8:30 PM');
		expect(hhmmLabel('06:05')).toBe('6:05 AM');
		expect(hhmmLabel('00:00')).toBe('12:00 AM');
	});
});

describe('grown-up notes', () => {
	const m = (from: string, until: string | null): ParentMessage => ({ id: from, text: 'x', emoji: '1f4e3', from, until });

	it('shows on the right days', () => {
		const list = [m('2026-10-12', '2026-10-12'), m('2026-10-13', '2026-10-13'), m('2026-10-10', null)];
		expect(messagesOn(list, '2026-10-12').map((x) => x.id)).toEqual(['2026-10-12', '2026-10-10']);
		expect(messagesOn(list, '2026-10-13').map((x) => x.id)).toEqual(['2026-10-13', '2026-10-10']);
		expect(messagesOn(list, '2026-10-09')).toEqual([]);
	});

	it('labels', () => {
		const t = '2026-10-12';
		const tm = '2026-10-13';
		expect(whenLabel(m(t, t), t, tm)).toBe('Today');
		expect(whenLabel(m(tm, tm), t, tm)).toBe('Tomorrow');
		expect(whenLabel(m('2026-10-01', null), t, tm)).toBe('Every day');
		expect(whenLabel(m(tm, null), t, tm)).toBe('From tomorrow');
	});

	it('cleans text', () => {
		expect(cleanMessage('  Library   books\ttoday! ')).toBe('Library books today!');
		expect(cleanMessage('   ')).toBeNull();
		expect(cleanMessage('x'.repeat(71))).toBeNull();
		expect(cleanMessage(42)).toBeNull();
	});
});

describe('Wi-Fi list', () => {
	it('splits nmcli terse lines with escaped colons', () => {
		expect(splitTerse('*:Cafe\\: Free:70:WPA2')).toEqual(['*', 'Cafe: Free', '70', 'WPA2']);
	});

	it('one row per network, connected first, then strongest', () => {
		const out = [' :Neighbour:80:WPA2', '*:Home:55:WPA2 WPA3', ' :Home:90:WPA2 WPA3', ' :Library::--', ' ::40:WPA2', ''].join('\n');
		expect(parseWifiList(out)).toEqual([
			{ ssid: 'Home', signal: 55, secure: true, inUse: true },
			{ ssid: 'Neighbour', signal: 80, secure: true, inUse: false },
			{ ssid: 'Library', signal: 0, secure: false, inUse: false }
		]);
	});

	it('signal bars', () => {
		expect([10, 30, 60, 90].map(signalBars)).toEqual([1, 2, 3, 4]);
	});
});
