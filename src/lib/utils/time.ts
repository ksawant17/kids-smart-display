/** Small time helpers shared across pages (kid dashboard clock, greetings). */

const GREETINGS = {
	morning: 'Good Morning',
	afternoon: 'Good Afternoon',
	evening: 'Good Evening'
} as const;

export function greetingFor(date: Date = new Date()): string {
	const h = date.getHours();
	if (h < 12) return GREETINGS.morning;
	if (h < 17) return GREETINGS.afternoon;
	return GREETINGS.evening;
}

/** "Wed, Oct 7" */
export function shortDate(date: Date = new Date()): string {
	return date.toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/** "8:30 AM" */
export function clockTime(date: Date = new Date()): string {
	return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** "10 AM" / "12 PM" from an "YYYY-MM-DDTHH:MM" local string. */
export function hourLabel(iso: string): string {
	const d = new Date(iso);
	return d.toLocaleTimeString('en-US', { hour: 'numeric' });
}

/** Day of the year, 1-365/366. */
export function dayOfYear(date: Date = new Date()): number {
	const start = Date.UTC(date.getFullYear(), 0, 0);
	const diff = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start;
	return Math.floor(diff / 86400000);
}

/** "October 2026" */
export function monthTitle(year: number, month: number): string {
	return new Date(year, month, 1).toLocaleDateString('en-US', {
		month: 'long',
		year: 'numeric'
	});
}

/** Whole local days since 1970-01-01 (keeps counting across New Year). */
export function dayNumber(date: Date = new Date()): number {
	return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** Deterministic "of the day" pick: changes at local midnight, cycles through every item. */
export function pickDaily<T>(items: readonly T[], date: Date = new Date(), salt = 0): T {
	return items[(dayNumber(date) + salt) % items.length];
}
