/**
 * Timers and reminders on the kiosk: what's coming (the idle screen's chip,
 * with the next wake-up alarm) and what's going off (RingBanner). Loaded again whenever the server says
 * they changed (the button event stream, see +layout.svelte), and every 30
 * seconds in case that was missed.
 */
import { writable } from 'svelte/store';
import type { Reminder } from '#lib/utils/reminders';

export const reminders = writable<{
	upcoming: Reminder[];
	ringing: Reminder[];
	nextAlarm: { at: number; label: string } | null;
}>({ upcoming: [], ringing: [], nextAlarm: null });

export async function loadReminders(): Promise<void> {
	try {
		const res = await fetch('/api/reminders');
		if (res.ok) reminders.set(await res.json());
	} catch {
		/* keep what we have; try again on the next tick */
	}
}

export function startReminders(): () => void {
	loadReminders();
	const t = setInterval(loadReminders, 30_000);
	return () => clearInterval(t);
}

/** Stop / 5 more minutes / take it off the list (the screen's buttons, 🎤 Ask's Undo) */
export async function reminderAction(action: 'stop' | 'snooze' | 'cancel', id = ''): Promise<boolean> {
	try {
		const res = await fetch('/api/reminders', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ action, id })
		});
		if (res.ok) reminders.set(await res.json());
		return res.ok;
	} catch {
		return false;
	}
}
