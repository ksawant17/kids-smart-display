/**
 * Seasonal / festival themes, US and Indian: header decorations, a greeting
 * on the day itself, a hat for the animal buddies, and a banner for the idle
 * screen ("Diwali in 3 sleeps!" / "Happy Diwali! शुभ दीपावली").
 *
 * The Hindu festivals come from the Marathi calendar (utils/panchang.ts),
 * computed for the dashboard's own location, so they work for any year. Eid
 * (Islamic calendar) uses a small date table (2026-2030).
 */
import { panchangMonth, type Place } from '#lib/utils/panchang';

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
	/** the Marathi wish under it ("शुभ दीपावली"), if any */
	mr: string | null;
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

// Eid al-Fitr (Islamic calendar; can move a day with the moon sighting), MMDD
const EID: Record<number, number> = { 2026: 320, 2027: 310, 2028: 227, 2029: 214, 2030: 205 };

/** where the dashboard is, until the layout says (config default) */
export const DEFAULT_PLACE: Place = { latitude: 38.85, longitude: -77.31 };

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
	mr?: string;
	hat?: BuddyHat;
	/** fixed / rule-based main day in a year (null: not that year) */
	day?: (year: number) => Date | null;
	/** or: the Marathi calendar festival (utils/panchang ids) that is the main day */
	marathi?: string;
	/** shown from `before` days ahead until `after` days past the main day */
	before: number;
	after: number;
	/** greeting on every day of the window, not just the main day */
	greetAll?: boolean;
}

const fixed = (month: number, date: number) => (year: number) => new Date(year, month - 1, date);
const eid = (year: number) => (EID[year] ? new Date(year, Math.floor(EID[year] / 100) - 1, EID[year] % 100) : null);

const INDIA = '1f1ee-1f1f3';

// A festival's own day wins over another's build-up; otherwise the first
// match wins, so short festivals come before the long seasons around them.
// prettier-ignore
const FESTIVALS: Festival[] = [
	// ---- Marathi calendar ----
	{ id: 'sankranti', name: 'Makar Sankranti', marathi: 'makar-sankranti', decor: ['1fa81', '1f36c', '1f31e'], greeting: 'Happy Sankranti', cheer: 'Happy Makar Sankranti!', mr: 'तिळगूळ घ्या, गोड गोड बोला', before: 2, after: 1 },
	{ id: 'maha-shivratri', name: 'Maha Shivratri', marathi: 'maha-shivratri', decor: ['1f531', '1f319', '1f64f'], greeting: 'Happy Maha Shivratri', cheer: 'Happy Maha Shivratri!', mr: 'हर हर महादेव', before: 0, after: 0 },
	{ id: 'holi', name: 'Holi', marathi: 'dhulivandan', decor: ['1f3a8', '1f308', '1f4a6'], greeting: 'Happy Holi', cheer: 'Happy Holi!', mr: 'होळीच्या हार्दिक शुभेच्छा', before: 3, after: 4 },
	{ id: 'padwa', name: 'Gudi Padwa', marathi: 'gudi-padwa', decor: ['1f6a9', '1f96d', '1f33c'], greeting: 'Happy Gudi Padwa', cheer: 'Happy Gudi Padwa! Happy New Year!', mr: 'गुढीपाडव्याच्या हार्दिक शुभेच्छा', before: 2, after: 0 },
	{ id: 'ram-navami', name: 'Ram Navami', marathi: 'ram-navami', decor: ['1f3f9', '1f451', '1f338'], greeting: 'Happy Ram Navami', cheer: 'Happy Ram Navami!', mr: 'जय श्रीराम', before: 0, after: 0 },
	{ id: 'hanuman-jayanti', name: 'Hanuman Jayanti', marathi: 'hanuman-jayanti', decor: ['1f412', '1f4aa', '1f6a9'], greeting: 'Happy Hanuman Jayanti', cheer: 'Happy Hanuman Jayanti!', mr: 'जय हनुमान', before: 0, after: 0 },
	{ id: 'akshaya-tritiya', name: 'Akshaya Tritiya', marathi: 'akshaya-tritiya', decor: ['2728', '1fa99', '1f96d'], greeting: 'Happy Akshaya Tritiya', cheer: 'Happy Akshaya Tritiya!', mr: 'अक्षय्य तृतीयेच्या शुभेच्छा', before: 0, after: 0 },
	{ id: 'ashadhi-ekadashi', name: 'Ashadhi Ekadashi', marathi: 'ashadhi-ekadashi', decor: ['1f6a9', '1f64f', '1f3b6'], greeting: 'Happy Ashadhi Ekadashi', cheer: 'Happy Ashadhi Ekadashi!', mr: 'विठ्ठल विठ्ठल · जय हरी विठ्ठल', before: 1, after: 0 },
	{ id: 'guru-purnima', name: 'Guru Purnima', marathi: 'guru-purnima', decor: ['1f4da', '1f64f', '1f315'], greeting: 'Happy Guru Purnima', cheer: 'Happy Guru Purnima!', mr: 'गुरुपौर्णिमेच्या शुभेच्छा', before: 0, after: 0 },
	{ id: 'nag-panchami', name: 'Nag Panchami', marathi: 'nag-panchami', decor: ['1f40d', '1f33c', '1f95b'], greeting: 'Happy Nag Panchami', cheer: 'Happy Nag Panchami!', mr: 'नागपंचमीच्या शुभेच्छा', before: 0, after: 0 },
	{ id: 'rakhi', name: 'Raksha Bandhan', marathi: 'narali-purnima', decor: ['1f9f5', '1f965', '1f381'], greeting: 'Happy Raksha Bandhan', cheer: 'Happy Raksha Bandhan!', mr: 'नारळी पौर्णिमा · रक्षाबंधन', before: 3, after: 0 },
	{ id: 'gokulashtami', name: 'Gokulashtami', marathi: 'gokulashtami', decor: ['1f99a', '1f9c8', '1f3fa'], greeting: 'Happy Gokulashtami', cheer: 'Happy Gokulashtami! Dahi Handi!', mr: 'गोविंदा आला रे आला!', before: 1, after: 1 },
	{ id: 'pola', name: 'Pola', marathi: 'pola', decor: ['1f402', '1f33e', '1f514'], greeting: 'Happy Pola', cheer: 'Happy Pola!', mr: 'बैलपोळ्याच्या शुभेच्छा', before: 0, after: 0 },
	{ id: 'ganesh', name: 'Ganesh Chaturthi', marathi: 'ganesh-chaturthi', decor: ['1f418', '1f33a', '1f941'], greeting: 'Ganpati Bappa Morya', cheer: 'Ganpati Bappa Morya!', mr: 'गणपती बाप्पा मोरया!', before: 3, after: 10 },
	{ id: 'navratri', name: 'Navratri', marathi: 'ghatasthapana', decor: ['1f483', '1fa94', '1f33c'], greeting: 'Happy Navratri', cheer: 'Happy Navratri!', mr: 'नवरात्रीच्या हार्दिक शुभेच्छा', before: 2, after: 8 },
	{ id: 'dasara', name: 'Dasara', marathi: 'dasara', decor: ['1f3f9', '1f343', '1f31f'], greeting: 'Happy Dasara', cheer: 'Happy Dasara!', mr: 'दसऱ्याच्या हार्दिक शुभेच्छा · सोनं घ्या, सोन्यासारखं राहा', before: 0, after: 0 },
	{ id: 'kojagiri', name: 'Kojagiri Purnima', marathi: 'kojagiri', decor: ['1f315', '1f95b', '2728'], greeting: 'Happy Kojagiri', cheer: 'Happy Kojagiri Purnima!', mr: 'कोजागरी पौर्णिमेच्या शुभेच्छा', before: 0, after: 0 },
	{ id: 'diwali', name: 'Diwali', marathi: 'lakshmi-pujan', decor: ['1fa94', '2728', '1f9e8'], greeting: 'Happy Diwali', cheer: 'Happy Diwali!', mr: 'शुभ दीपावली', before: 7, after: 3 },
	{ id: 'tripuri-purnima', name: 'Tripuri Purnima', marathi: 'tripuri-purnima', decor: ['1fa94', '1f315', '2728'], greeting: 'Happy Tripuri Purnima', cheer: 'Happy Tripuri Purnima!', mr: 'त्रिपुरी पौर्णिमेच्या शुभेच्छा', before: 0, after: 0 },
	// ---- fixed dates ----
	{ id: 'republic', name: 'Republic Day', decor: [INDIA, '1f54a', '2728'], greeting: 'Happy Republic Day', cheer: 'Happy Republic Day!', mr: 'प्रजासत्ताक दिनाच्या शुभेच्छा', day: fixed(1, 26), before: 0, after: 0 },
	{ id: 'india-independence', name: 'Independence Day', decor: [INDIA, '1fa81', '1f54a'], greeting: 'Happy 15th August', cheer: 'Happy Independence Day, India!', mr: 'स्वातंत्र्य दिनाच्या शुभेच्छा', day: fixed(8, 15), before: 1, after: 0 },
	{ id: 'eid', name: 'Eid', decor: ['1f319', '1f54c', '2728'], greeting: 'Eid Mubarak', cheer: 'Eid Mubarak!', day: eid, before: 1, after: 1, greetAll: true },
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

const LOOK_AHEAD = Math.max(...FESTIVALS.filter((f) => f.marathi).map((f) => f.before));
const LOOK_BACK = Math.max(...FESTIVALS.filter((f) => f.marathi).map((f) => f.after));

/** Marathi festival days around a date: festival id -> local dates */
function marathiAround(date: Date, place: Place): Map<string, Date[]> {
	const out = new Map<string, Date[]>();
	for (let i = -LOOK_BACK; i <= LOOK_AHEAD; i++) {
		const day = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i);
		const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
		for (const f of panchangMonth(day.getFullYear(), day.getMonth(), place).get(key)?.festivals ?? [])
			out.set(f.id, [...(out.get(f.id) ?? []), day]);
	}
	return out;
}

export function themeFor(date: Date, place: Place = DEFAULT_PLACE): Theme | null {
	const year = date.getFullYear();
	const marathi = marathiAround(date, place);
	const found = (f: Festival, day: Date, diff: number): Theme => ({
		id: f.id,
		name: f.name,
		decor: f.decor,
		greeting: diff === 0 || f.greetAll ? f.greeting : null,
		cheer: f.cheer,
		mr: f.mr ?? null,
		day,
		hat: f.hat ?? null
	});
	// a window can reach over New Year's (look at last and next year's day too)
	// diff < 0: before the main day
	const near = (f: Festival) =>
		f.marathi
			? (marathi.get(f.marathi) ?? []).map((day) => ({ day, diff: daysBetween(day, date) }))
			: [year, year + 1, year - 1].flatMap((y) => {
					const day = f.day?.(y);
					return day ? [{ day, diff: daysBetween(day, date) }] : [];
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
			mr: null,
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
