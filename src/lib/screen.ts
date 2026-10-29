/**
 * Screen (backlight) power logic, shared by the kiosk page and the server.
 *
 *   on   -> the brightness set with the slider
 *   dim  -> after screen.dimAfterMinutes without a touch (never brighter than "on")
 *   off  -> after screen.offAfterMinutes; a touch wakes the screen
 *
 * Bedtime (config.bedtime, quiet hours): "awake" means dim, and the screen
 * goes off after a minute without a touch. When bedtime ends the kiosk turns
 * the screen back on by itself.
 */
import { writable } from 'svelte/store';
import type { DashboardConfig } from '#lib/config';

export type ScreenMode = 'on' | 'dim' | 'off';

export interface ScreenStatus {
	/** a real backlight was found (false in a desktop browser / dev machine) */
	available: boolean;
	/** the user's brightness, % */
	brightness: number;
	mode: ScreenMode;
}

/** minutes without a touch before the screen goes off at bedtime */
export const BEDTIME_OFF_MINUTES = 1;

const minutesOf = (hhmm: string) => {
	const [h, m] = hhmm.split(':').map(Number);
	return h * 60 + m;
};

/** Is `date` inside the quiet hours? (start > end wraps past midnight) */
export function inBedtime(date: Date, b: DashboardConfig['bedtime']): boolean {
	if (!b.enabled) return false;
	const t = date.getHours() * 60 + date.getMinutes();
	const start = minutesOf(b.start);
	const end = minutesOf(b.end);
	if (start === end) return false;
	return start < end ? t >= start && t < end : t >= start || t < end;
}

/** The brightest the screen gets right now (a touch wakes it to this). */
export const awakeMode = (bedtime: boolean): ScreenMode => (bedtime ? 'dim' : 'on');

/** Which mode the screen should be in after `idleMs` without a touch. */
export function modeForIdle(idleMs: number, s: DashboardConfig['screen'], bedtime = false): ScreenMode {
	const min = idleMs / 60_000;
	if (bedtime) return min >= BEDTIME_OFF_MINUTES ? 'off' : 'dim';
	if (s.offAfterMinutes > 0 && min >= s.offAfterMinutes) return 'off';
	if (s.dimAfterMinutes > 0 && min >= s.dimAfterMinutes) return 'dim';
	return 'on';
}

/** Backlight percentage for a mode. */
export function targetPercent(mode: ScreenMode, brightness: number, dimBrightness: number): number {
	if (mode === 'off') return 0;
	if (mode === 'dim') return Math.min(dimBrightness, brightness);
	return brightness;
}

/** Percentage -> raw backlight level (0..max); anything above 0% stays at least 1 (visible). */
export function rawLevel(percent: number, max: number): number {
	const p = Math.max(0, Math.min(100, percent));
	if (p === 0) return 0;
	return Math.max(1, Math.round((p / 100) * max));
}

/** Open/closed state of the quick menu (pulled down from the top of the screen). */
export const screenPanelOpen = writable(false);

/**
 * A story is open on FUN: someone is reading, not touching. The idle timers
 * (back to TODAY, dim, off, bedtime's one minute) wait this much longer.
 */
export const reading = writable(false);
/** the 🎤 Ask sheet (header / idle screen button) */
export const askOpen = writable(false);
/** when the 🎤 button was pressed (0: not held): kids talk while holding it */
export const micHeld = writable(0);
export const READING_GRACE_MS = 10 * 60_000;
