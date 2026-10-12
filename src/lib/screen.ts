/**
 * Screen (backlight) power logic, shared by the kiosk page and the server.
 *
 *   on   -> the brightness set with the slider
 *   dim  -> after screen.dimAfterMinutes without a touch (never brighter than "on")
 *   off  -> after screen.offAfterMinutes; a touch wakes the screen
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

/** Which mode the screen should be in after `idleMs` without a touch. */
export function modeForIdle(idleMs: number, s: DashboardConfig['screen']): ScreenMode {
	const min = idleMs / 60_000;
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

/** Open/closed state of the brightness panel (opened from the header clock). */
export const screenPanelOpen = writable(false);
