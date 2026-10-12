import { describe, expect, it } from 'vitest';
import { skyPhase } from '../src/lib/sky';

const rise = '2026-10-12T07:15:00-04:00';
const set = '2026-10-12T18:36:00-04:00';
const at = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00-04:00`);

describe('skyPhase', () => {
	it('follows the real sunrise and sunset', () => {
		expect(skyPhase(at('05:00'), rise, set)).toBe('night');
		expect(skyPhase(at('07:00'), rise, set)).toBe('dawn');
		expect(skyPhase(at('12:00'), rise, set)).toBe('day');
		expect(skyPhase(at('17:30'), rise, set)).toBe('dusk');
		expect(skyPhase(at('19:30'), rise, set)).toBe('night');
	});

	it('falls back to 7:00 / 18:30 without a forecast', () => {
		expect(skyPhase(new Date(2026, 9, 12, 12))).toBe('day');
		expect(skyPhase(new Date(2026, 9, 12, 22))).toBe('night');
	});
});
