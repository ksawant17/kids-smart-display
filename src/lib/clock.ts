/**
 * Shared wall clock for the whole kiosk. Ticks every 15 s so the header
 * clock, the "today" highlight and the date-based content all roll over
 * on their own: the kiosk page itself is never reloaded.
 */
import { derived, readable } from 'svelte/store';
import { keyOf } from '#lib/utils/schoolCalendar';

export const now = readable(new Date(), (set) => {
	set(new Date());
	const t = setInterval(() => set(new Date()), 15_000);
	return () => clearInterval(t);
});

/** "YYYY-MM-DD" for today (local); changes exactly once a day. */
export const todayKey = derived(now, ($now) => keyOf($now));
