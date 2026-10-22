/**
 * Seasonal / festival themes, US and Indian: header decorations, a greeting
 * on the day itself, a hat for the animal buddies, and a banner for the idle
 * screen ("Diwali in 3 sleeps!" / "Happy Diwali!"). Pure, date-based (local
 * time).
 *
 * Indian festivals (and Eid) follow the lunar calendar, so their dates come
 * from a table (Drik Panchang, New Delhi; checked Oct 2026). Years past the
 * table simply have no Indian festival themes until it is extended.
 */
export type BuddyHat = 'witch' | 'winter' | 'party' | null;

export interface Theme {
	id: string;
	/** e.g. "Diwali" (idle screen countdown: "Diwali in 3 sleeps!") */
	name: string;
	/** a few twemoji codes shown as header decorations */
	decor: string[];
	/** replaces "Good Morning" on the festival day itself (kept short: it shares the header) */
	greeting: string | null;
	/** idle screen banner from the main day on ("Happy Diwali!") */
	cheer: string;
	/** the main day, for the countdown before it (null: no countdown) */
	day: Date | null;
	hat: BuddyHat;
}

/** Thanksgiving (US): the 4th Thursday of November. */
export function thanksgiving(year: number): Date {
	const first = new Date(year, 10, 1).getDay(); // 0 = Sun
	const firstThursday = 1 + ((4 - first + 7) % 7);
	return new Date(year, 10, firstThursday + 21);
}

/** the n-th given weekday (0 = Sun) of a month (0-based) */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
	const first = new Date(year, month, 1).getDay();
	return new Date(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
}

/** Easter Sunday (Gregorian, anonymous algorithm) */
export function easter(year: number): Date {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const h = (19 * a + b - Math.floor(b / 4) - Math.floor((8 * b + 13) / 25) + 15) % 30;
	const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - (c % 4)) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return new Date(year, month - 1, day);
}

// lunar-calendar festivals as MMDD per year
type Lunar = 'sankranti' | 'holi' | 'padwa' | 'eid' | 'rakhi' | 'janmashtami' | 'ganesh' | 'navratri' | 'dussehra' | 'diwali';
// prettier-ignore
const LUNAR: Record<number, Record<Lunar, number>> = {
	2026: { sankranti: 114, holi: 304, padwa: 319, eid: 320, rakhi: 828, janmashtami: 904, ganesh: 914, navratri: 1011, dussehra: 1020, diwali: 1108 },
	2027: { sankranti: 115, holi: 322, padwa: 407, eid: 310, rakhi: 817, janmashtami: 825, ganesh: 904, navratri: 930, dussehra: 1009, diwali: 1029 },
	2028: { sankranti: 115, holi: 311, padwa: 327, eid: 227, rakhi: 805, janmashtami: 813, ganesh: 823, navratri: 919, dussehra: 927, diwali: 1017 },
	2029: { sankranti: 114, holi: 301, padwa: 414, eid: 214, rakhi: 823, janmashtami: 901, ganesh: 911, navratri: 1008, dussehra: 1016, diwali: 1105 },
	2030: { sankranti: 114, holi: 320, padwa: 403, eid: 205, rakhi: 813, janmashtami: 821, ganesh: 901, navratri: 928, dussehra: 1006, diwali: 1026 }
};

const DAY = 86_400_000;
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** whole days from a to b (local dates; DST-safe) */
const daysBetween = (a: Date, b: Date) => Math.round((midnight(b).getTime() - midnight(a).getTime()) / DAY);

interface Festival {
	id: string;
	name: string;
	decor: string[];
	greeting: string | null;
	cheer: string;
	hat?: BuddyHat;
	/** main day this year (null: not this year / unknown) */
	day: (year: number) => Date | null;
	/** shown from `before` days ahead until `after` days past the main day */
	before: number;
	after: number;
	/** greeting on every day of the window, not just the main day */
	greetAll?: boolean;
}

const lunar = (key: Lunar) => (year: number) => {
	const mmdd = LUNAR[year]?.[key];
	return mmdd ? new Date(year, Math.floor(mmdd / 100) - 1, mmdd % 100) : null;
};
const fixed = (month: number, date: number) => (year: number) => new Date(year, month - 1, date);

const INDIA = '1f1ee-1f1f3';

// A festival's own day wins over another's build-up; otherwise the first
// match wins, so short festivals come before the long seasons around them.
// prettier-ignore
const FESTIVALS: Festival[] = [
	{ id: 'sankranti', name: 'Sankranti', decor: ['1fa81', '1f31e', '1f36c'], greeting: 'Happy Sankranti', cheer: 'Happy Makar Sankranti & Pongal!', day: lunar('sankranti'), before: 2, after: 1 },
	{ id: 'republic', name: 'Republic Day', decor: [INDIA, '1f54a', '2728'], greeting: 'Happy Republic Day', cheer: 'Happy Republic Day!', day: fixed(1, 26), before: 0, after: 0 },
	{ id: 'holi', name: 'Holi', decor: ['1f3a8', '1f308', '1f4a6'], greeting: 'Happy Holi', cheer: 'Happy Holi!', day: lunar('holi'), before: 3, after: 0 },
	{ id: 'padwa', name: 'Gudi Padwa & Ugadi', decor: ['1f6a9', '1f96d', '1f33c'], greeting: 'Happy Padwa & Ugadi', cheer: 'Happy Gudi Padwa & Ugadi!', day: lunar('padwa'), before: 1, after: 0 },
	{ id: 'eid', name: 'Eid', decor: ['1f319', '1f54c', '2728'], greeting: 'Eid Mubarak', cheer: 'Eid Mubarak!', day: lunar('eid'), before: 1, after: 1, greetAll: true },
	{ id: 'rakhi', name: 'Raksha Bandhan', decor: ['1f9f5', '1f381', '1f496'], greeting: 'Happy Raksha Bandhan', cheer: 'Happy Raksha Bandhan!', day: lunar('rakhi'), before: 3, after: 0 },
	{ id: 'janmashtami', name: 'Janmashtami', decor: ['1f99a', '1f9c8', '1f476'], greeting: 'Happy Janmashtami', cheer: 'Happy Janmashtami!', day: lunar('janmashtami'), before: 1, after: 0 },
	{ id: 'india-independence', name: 'Independence Day', decor: [INDIA, '1fa81', '1f54a'], greeting: 'Happy 15th August', cheer: 'Happy Independence Day, India!', day: fixed(8, 15), before: 1, after: 0 },
	{ id: 'dussehra', name: 'Dussehra', decor: ['1f3f9', '1f525', '1f31f'], greeting: 'Happy Dussehra', cheer: 'Happy Dussehra!', day: lunar('dussehra'), before: 0, after: 0 },
	{ id: 'diwali', name: 'Diwali', decor: ['1fa94', '2728', '1f9e8'], greeting: 'Happy Diwali', cheer: 'Happy Diwali!', day: lunar('diwali'), before: 7, after: 3 },
	{ id: 'ganesh', name: 'Ganesh Chaturthi', decor: ['1f418', '1f33a', '1f941'], greeting: 'Ganpati Bappa Morya', cheer: 'Ganpati Bappa Morya!', day: lunar('ganesh'), before: 3, after: 10 },
	{ id: 'navratri', name: 'Navratri', decor: ['1f483', '1fa94', '1f33c'], greeting: 'Happy Navratri', cheer: 'Happy Navratri!', day: lunar('navratri'), before: 2, after: 8 },
	{ id: 'easter', name: 'Easter', decor: ['1f430', '1f95a', '1f337'], greeting: 'Happy Easter', cheer: 'Happy Easter!', day: easter, before: 6, after: 0 },
	{ id: 'mothers-day', name: "Mother's Day", decor: ['1f490', '1f496', '1f337'], greeting: "Happy Mother's Day", cheer: "Happy Mother's Day!", day: (y) => nthWeekday(y, 4, 0, 2), before: 2, after: 0 },
	{ id: 'fathers-day', name: "Father's Day", decor: ['1f454', '1f3c6', '1f499'], greeting: "Happy Father's Day", cheer: "Happy Father's Day!", day: (y) => nthWeekday(y, 5, 0, 3), before: 2, after: 0 },
	{ id: 'valentines', name: "Valentine's Day", decor: ['2764', '1f48c', '1f495'], greeting: "Happy Valentine's Day", cheer: "Happy Valentine's Day!", day: fixed(2, 14), before: 7, after: 0 },
	{ id: 'stpatricks', name: "St. Patrick's Day", decor: ['2618', '1f308', '1fa99'], greeting: "Happy St. Patrick's Day", cheer: "Happy St. Patrick's Day!", day: fixed(3, 17), before: 7, after: 0 },
	{ id: 'july4', name: '4th of July', decor: ['1f386', '1f1fa-1f1f8', '1f387'], greeting: 'Happy 4th of July', cheer: 'Happy 4th of July!', hat: 'party', day: fixed(7, 4), before: 3, after: 0 },
	{ id: 'christmas', name: 'Christmas', decor: ['1f384', '1f385', '1f381'], greeting: 'Merry Christmas', cheer: 'Merry Christmas!', hat: 'winter', day: fixed(12, 25), before: 24, after: 1 },
	{ id: 'halloween', name: 'Halloween', decor: ['1f383', '1f987', '1f47b'], greeting: 'Happy Halloween', cheer: 'Happy Halloween!', hat: 'witch', day: fixed(10, 31), before: 30, after: 0 },
	{ id: 'thanksgiving', name: 'Thanksgiving', decor: ['1f983', '1f342', '1f967'], greeting: 'Happy Thanksgiving', cheer: 'Happy Thanksgiving!', day: thanksgiving, before: 30, after: 1 }
];

export function themeFor(date: Date): Theme | null {
	const year = date.getFullYear();
	const found = (f: Festival, day: Date, diff: number): Theme => ({
		id: f.id,
		name: f.name,
		decor: f.decor,
		greeting: diff === 0 || f.greetAll ? f.greeting : null,
		cheer: f.cheer,
		day,
		hat: f.hat ?? null
	});
	// a window can reach over New Year's (look at last and next year's day too)
	const near = (f: Festival) =>
		[year, year + 1, year - 1].flatMap((y) => {
			const day = f.day(y);
			return day ? [{ day, diff: daysBetween(day, date) }] : []; // diff < 0: before the main day
		});
	for (const f of FESTIVALS) {
		const today = near(f).find((n) => n.diff === 0);
		if (today) return found(f, today.day, 0);
	}
	for (const f of FESTIVALS) {
		const hit = near(f).find((n) => n.diff >= -f.before && n.diff <= f.after);
		if (hit) return found(f, hit.day, hit.diff);
	}
	// winter + New Year: Dec 27 - Jan 6, party hats for the countdown
	const m = (date.getMonth() + 1) * 100 + date.getDate();
	if (m >= 1227 || m <= 106)
		return {
			id: 'winter',
			name: 'New Year',
			decor: ['2744', '26c4', '1f389'],
			greeting: m === 101 ? 'Happy New Year' : m === 1231 ? "Happy New Year's Eve" : null,
			cheer: 'Happy New Year!',
			day: new Date(m >= 1227 ? year + 1 : year, 0, 1),
			hat: m >= 1231 || m <= 101 ? 'party' : 'winter'
		};
	return null;
}

/** Idle screen banner: "Diwali in 3 sleeps!" before the day, the cheer from then on. */
export function festivalBanner(theme: Theme, date: Date): string {
	const left = theme.day ? daysBetween(date, theme.day) : 0;
	if (left <= 0) return theme.cheer;
	return left === 1 ? `${theme.name} is tomorrow!` : `${theme.name} in ${left} sleeps!`;
}
