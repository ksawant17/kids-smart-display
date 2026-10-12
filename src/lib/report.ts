/**
 * Shared state for the full weather report panel.
 * The panel is rendered from the root layout (so it can cover the whole
 * 800x480 frame), and any page opens it via openReport(day).
 * day: 0 = today, 1 = tomorrow (pre-selected when the panel opens).
 *
 * (A plain Svelte store — module runes aren't compiled in .ts files here.)
 */
import { writable } from 'svelte/store';

export interface ReportState {
	open: boolean;
	day: number;
}

export const reportState = writable<ReportState>({ open: false, day: 0 });

export function openReport(day = 0) {
	reportState.set({ open: true, day });
}

export function closeReport() {
	reportState.update((s) => ({ ...s, open: false }));
}
