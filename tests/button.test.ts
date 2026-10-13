import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonGestures, type Gesture } from '../src/lib/utils/button';
import { resolveConfig } from '../src/lib/config';

describe('top button gestures', () => {
	let got: Gesture[];
	let b: ButtonGestures;
	beforeEach(() => {
		vi.useFakeTimers();
		got = [];
		b = new ButtonGestures((g) => got.push(g), { holdMs: 2000, resetMs: 10_000 });
	});
	afterEach(() => vi.useRealTimers());

	it('a quick press is a tap', () => {
		b.press();
		vi.advanceTimersByTime(300);
		b.release();
		expect(got).toEqual(['tap']);
	});

	it('holding opens the menu once, and letting go is not also a tap', () => {
		b.press();
		vi.advanceTimersByTime(2500);
		expect(got).toEqual(['hold']);
		b.release();
		expect(got).toEqual(['hold']);
	});

	it('holding 10 s restarts the screen (after the menu)', () => {
		b.press();
		vi.advanceTimersByTime(10_000);
		b.release();
		expect(got).toEqual(['hold', 'reset']);
	});

	it('ignores repeated edges (bounce that got through)', () => {
		b.press();
		b.press();
		b.release();
		b.release();
		expect(got).toEqual(['tap']);
	});

	it('each press starts fresh', () => {
		b.press();
		vi.advanceTimersByTime(3000);
		b.release();
		b.press();
		b.release();
		expect(got).toEqual(['hold', 'tap']);
	});
});

describe('button config', () => {
	it('defaults: on, GPIO17, 2 s', () => {
		expect(resolveConfig({}).button).toEqual({ enabled: true, gpio: 17, holdSeconds: 2 });
	});
	it('validates', () => {
		expect(resolveConfig({ button: { enabled: false, gpio: 27, holdSeconds: 3 } }).button).toEqual({
			enabled: false,
			gpio: 27,
			holdSeconds: 3
		});
		expect(resolveConfig({ button: { gpio: 99, holdSeconds: 0 } }).button).toEqual({ enabled: true, gpio: 17, holdSeconds: 2 });
	});
});
