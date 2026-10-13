/**
 * Grown-up notes for the TODAY banner, polled from the server every minute
 * (so a note sent from a phone shows up quickly). Started by the root layout.
 */
import { writable } from 'svelte/store';
import type { ParentMessage } from '#lib/utils/messages';

export const messages = writable<ParentMessage[]>([]);

export async function loadMessages(): Promise<void> {
	try {
		const res = await fetch('/api/messages');
		if (res.ok) messages.set(await res.json());
	} catch {
		/* keep what we have; try again on the next tick */
	}
}

export function startMessages(): () => void {
	loadMessages();
	const t = setInterval(loadMessages, 60_000);
	return () => clearInterval(t);
}
