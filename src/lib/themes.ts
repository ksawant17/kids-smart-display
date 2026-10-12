/**
 * Seasonal/holiday themes: header decorations, a greeting on the day itself,
 * and a hat for the animal buddies. Pure, date-based (local time).
 */
export type BuddyHat = 'witch' | 'winter' | 'party' | null;

export interface Theme {
	id: string;
	/** a few twemoji codes shown as header decorations */
	decor: string[];
	/** replaces "Good Morning" on the holiday itself */
	greeting: string | null;
	hat: BuddyHat;
}

/** Thanksgiving (US): the 4th Thursday of November. */
export function thanksgiving(year: number): Date {
	const first = new Date(year, 10, 1).getDay(); // 0 = Sun
	const firstThursday = 1 + ((4 - first + 7) % 7);
	return new Date(year, 10, firstThursday + 21);
}

const md = (d: Date) => (d.getMonth() + 1) * 100 + d.getDate(); // Oct 31 -> 1031

export function themeFor(date: Date): Theme | null {
	const m = md(date);
	const day = (mmdd: number) => m === mmdd;

	if (m >= 1001 && m <= 1031)
		return { id: 'halloween', decor: ['1f383', '1f987', '1f47b'], greeting: day(1031) ? 'Happy Halloween' : null, hat: 'witch' };

	const tg = thanksgiving(date.getFullYear());
	if (m >= 1101 && m <= md(tg) + 1)
		return {
			id: 'thanksgiving',
			decor: ['1f983', '1f342', '1f967'],
			greeting: m === md(tg) ? 'Happy Thanksgiving' : null,
			hat: null
		};

	if (m >= 1201 || m <= 106)
		return {
			id: 'winter',
			decor: ['2744', '26c4', '1f381'],
			greeting: day(101) ? 'Happy New Year' : day(1231) ? "Happy New Year's Eve" : null,
			hat: m >= 1231 || m <= 101 ? 'party' : 'winter'
		};

	if (m >= 207 && m <= 214)
		return { id: 'valentines', decor: ['2764', '1f48c', '1f495'], greeting: day(214) ? "Happy Valentine's Day" : null, hat: null };

	if (m >= 310 && m <= 317)
		return { id: 'stpatricks', decor: ['2618', '1f308', '1fa99'], greeting: day(317) ? "Happy St. Patrick's Day" : null, hat: null };

	if (m >= 701 && m <= 704)
		return { id: 'july4', decor: ['1f386', '1f1fa-1f1f8', '1f387'], greeting: day(704) ? 'Happy 4th of July' : null, hat: 'party' };

	return null;
}
