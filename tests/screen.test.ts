import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../src/lib/config';
import { modeForIdle, rawLevel, targetPercent } from '../src/lib/screen';

const cfg = DEFAULT_CONFIG.screen; // dim after 10 min to 10%, off after 60 min
const min = (m: number) => m * 60_000;

describe('modeForIdle', () => {
	it('on, then dim after 10 minutes, then off after an hour', () => {
		expect(modeForIdle(0, cfg)).toBe('on');
		expect(modeForIdle(min(9.9), cfg)).toBe('on');
		expect(modeForIdle(min(10), cfg)).toBe('dim');
		expect(modeForIdle(min(59), cfg)).toBe('dim');
		expect(modeForIdle(min(60), cfg)).toBe('off');
	});

	it('0 minutes means never', () => {
		const never = { ...cfg, dimAfterMinutes: 0, offAfterMinutes: 0 };
		expect(modeForIdle(min(600), never)).toBe('on');
		expect(modeForIdle(min(600), { ...cfg, offAfterMinutes: 0 })).toBe('dim');
	});
});

describe('targetPercent', () => {
	it('on = the chosen brightness, off = 0', () => {
		expect(targetPercent('on', 80, 30)).toBe(80);
		expect(targetPercent('off', 80, 30)).toBe(0);
	});

	it('dim is capped at dimBrightness, but never brighter than the chosen brightness', () => {
		expect(targetPercent('dim', 80, 30)).toBe(30);
		expect(targetPercent('dim', 20, 30)).toBe(20);
	});
});

describe('rawLevel', () => {
	it('maps percent to the backlight range', () => {
		expect(rawLevel(100, 255)).toBe(255);
		expect(rawLevel(30, 255)).toBe(77);
		expect(rawLevel(0, 255)).toBe(0);
	});

	it('keeps any non-zero percent visible and clamps out-of-range values', () => {
		expect(rawLevel(0.1, 255)).toBe(1);
		expect(rawLevel(150, 255)).toBe(255);
		expect(rawLevel(-5, 255)).toBe(0);
	});
});
