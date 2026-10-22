/**
 * Marathi panchang (पंचांग), computed on the Pi: the lunar month (amanta, as
 * in Maharashtra: months end on Amavasya), paksha (शुद्ध / वद्य), tithi,
 * Shaka year, and the Marathi festivals, for the dashboard's own location.
 *
 * How: tithi = which 12° step the Moon is ahead of the Sun. Sun: Meeus ch. 25
 * (~0.01°); Moon: Meeus ch. 47 with the 60 main longitude terms (~0.003°), so a
 * tithi boundary lands within a few minutes. A lunar month is named after the
 * sidereal sign (Lahiri ayanamsa) the Sun enters during it; a month with no
 * Sun sign change is Adhik (अधिक). A day's tithi is the one running at sunrise.
 * Festivals use the time of day their tradition looks at (Lakshmi Pujan in the
 * evening, Janmashtami at midnight, Sankashti at moonrise...), approximated
 * from the local sun, so no time zone is involved.
 *
 * Checked against Drik Panchang (tests/panchang.test.ts). A festival can still
 * differ by a day from a printed calendar for another city.
 */

export interface Place {
	latitude: number;
	longitude: number;
}

export interface Tithi {
	/** 1-30: 1-15 शुद्ध (Shukla), 16-30 वद्य (Krishna); 15 = Purnima, 30 = Amavasya */
	n: number;
	/** 0 = Chaitra ... 11 = Phalgun */
	month: number;
	adhik: boolean;
}

export interface PanchangDay extends Tithi {
	shaka: number;
	/** Marathi festivals on this day */
	festivals: MarathiFestival[];
	/** "आश्विन वद्य द्वादशी" */
	marathi: string;
	/** "Ashwin Krishna Dwadashi" */
	english: string;
}

export interface MarathiFestival {
	id: string;
	mr: string;
	en: string;
	/** twemoji code */
	emoji: string;
	/** big festival (vs. the monthly Ekadashi / Sankashti / Purnima / Amavasya) */
	major: boolean;
}

/* ----------------------------- astronomy ----------------------------- */

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const norm = (deg: number) => ((deg % 360) + 360) % 360;

/** Julian day from a JS time (ms) */
const jdOf = (ms: number) => ms / 86_400_000 + 2440587.5;
const msOf = (jd: number) => (jd - 2440587.5) * 86_400_000;

/** apparent geocentric longitude of the Sun (degrees, tropical) */
export function sunLongitude(jd: number): number {
	const T = (jd - 2451545) / 36525;
	const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
	const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
	const C =
		(1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) +
		(0.019993 - 0.000101 * T) * sin(2 * M) +
		0.000289 * sin(3 * M);
	const omega = 125.04 - 1934.136 * T;
	return norm(L0 + C - 0.00569 - 0.00478 * sin(omega));
}

// Meeus table 47.A: [D, M, M', F, Σl coefficient (1e-6 degrees)]
// prettier-ignore
const MOON_TERMS: [number, number, number, number, number][] = [
	[0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
	[0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
	[2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
	[0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
	[4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
	[2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
	[2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689],
	[2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390], [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236],
	[0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
	[2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892],
	[2, 1, 1, 0, -810], [4, -1, -2, 0, 759], [0, 2, -1, 0, -713], [2, 2, -1, 0, -700],
	[2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
	[4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381],
	[1, 1, 1, 0, 351], [3, 0, -2, 0, -340], [4, 0, -3, 0, 330], [2, -1, 2, 0, 327],
	[0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294]
];

/** apparent geocentric longitude of the Moon (degrees, tropical; same nutation as the Sun) */
export function moonLongitude(jd: number): number {
	const T = (jd - 2451545) / 36525;
	const T2 = T * T;
	const T3 = T2 * T;
	const T4 = T3 * T;
	const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000;
	const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000;
	const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000;
	const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000;
	const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000;
	const E = 1 - 0.002516 * T - 0.0000074 * T2;
	const A1 = 119.75 + 131.849 * T;
	const A2 = 53.09 + 479264.29 * T;
	let sum = 0;
	for (const [d, m, mp, f, c] of MOON_TERMS) {
		const e = m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E;
		sum += c * e * sin(d * D + m * M + mp * Mp + f * F);
	}
	sum += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
	const omega = 125.04452 - 1934.136261 * T;
	const nutation = -0.00478 * sin(omega); // ≈ Δψ, so Moon - Sun is unaffected
	return norm(Lp + sum / 1e6 + nutation);
}

/** Lahiri (Chitrapaksha) ayanamsa, degrees */
function ayanamsa(jd: number): number {
	return 23.853 + ((jd - 2451545) / 365.25) * (50.29 / 3600);
}

/** how far the Moon is ahead of the Sun, 0-360° */
const elongation = (jd: number) => norm(moonLongitude(jd) - sunLongitude(jd));

/** sidereal sign of the Sun, 0 = Mesha ... 11 = Meena */
const sunSign = (jd: number) => Math.floor(norm(sunLongitude(jd) - ayanamsa(jd)) / 30);

/** the new moon at or before jd (Moon catching up the Sun) */
function newMoonBefore(jd: number): number {
	let t = jd - elongation(jd) / 12.19;
	for (let i = 0; i < 6; i++) {
		let e = elongation(t);
		if (e > 180) e -= 360; // just before the new moon
		t -= e / 12.19;
	}
	return t <= jd ? t : newMoonBefore(jd - 25);
}

/* ------------------------------ the sun ------------------------------ */

/** sunrise / solar noon / sunset (Julian days, UT) on a calendar date at a place */
export function sunTimes(y: number, m: number, d: number, place: Place) {
	// local solar noon of that date, then the sunrise equation (NOAA / Wikipedia)
	const jdNoon = jdOf(Date.UTC(y, m - 1, d, 12)) - place.longitude / 360;
	const n = jdNoon - 2451545;
	const M = norm(357.5291 + 0.98560028 * n);
	const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
	const lambda = norm(M + C + 180 + 102.9372);
	const transit = 2451545 + n + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
	const decl = Math.asin(sin(lambda) * sin(23.4397)) / RAD;
	const cosW =
		(sin(-0.833) - sin(place.latitude) * sin(decl)) / (cos(place.latitude) * cos(decl));
	const w = (Math.acos(Math.max(-1, Math.min(1, cosW))) / RAD) / 360;
	return { rise: transit - w, noon: transit, set: transit + w };
}

/* ------------------------------- tithi ------------------------------- */

/** tithi number only (cheap) */
const tithiNumber = (jd: number) => Math.floor(elongation(jd) / 12) + 1;

/** the lunar month running at jd */
function monthAt(jd: number): Pick<Tithi, 'month' | 'adhik'> {
	const nm1 = newMoonBefore(jd);
	const nm2 = newMoonBefore(nm1 + 31);
	const s1 = sunSign(nm1);
	const s2 = sunSign(nm2);
	return { month: (s1 + 1) % 12, adhik: s1 === s2 };
}

export function tithiAt(jd: number): Tithi {
	return { n: tithiNumber(jd), ...monthAt(jd) };
}

/** when, on that day, a festival's tithi is looked at */
type When = 'sunrise' | 'noon' | 'afternoon' | 'evening' | 'night' | 'moonrise' | 'midnight';

function timeOf(when: When, y: number, m: number, d: number, place: Place): number {
	const s = sunTimes(y, m, d, place);
	switch (when) {
		case 'sunrise':
			return s.rise;
		case 'noon':
			return s.noon;
		case 'afternoon':
			return s.noon + 2.5 / 24;
		case 'evening': // pradosh
			return s.set + 1 / 24;
		case 'night': // end of pradosh
			return s.set + 2.4 / 24;
		case 'moonrise': // a few days past full moon the Moon rises ~3 h after sunset
			return s.set + 3 / 24;
		case 'midnight':
			return s.noon + 0.5;
	}
}

/* ------------------------------ names ------------------------------ */

export const MONTHS_MR = ['चैत्र', 'वैशाख', 'ज्येष्ठ', 'आषाढ', 'श्रावण', 'भाद्रपद', 'आश्विन', 'कार्तिक', 'मार्गशीर्ष', 'पौष', 'माघ', 'फाल्गुन'];
export const MONTHS_EN = ['Chaitra', 'Vaishakh', 'Jyeshtha', 'Ashadh', 'Shravan', 'Bhadrapad', 'Ashwin', 'Kartik', 'Margashirsha', 'Paush', 'Magh', 'Phalgun'];
// prettier-ignore
const TITHI_MR = ['प्रतिपदा', 'द्वितीया', 'तृतीया', 'चतुर्थी', 'पंचमी', 'षष्ठी', 'सप्तमी', 'अष्टमी', 'नवमी', 'दशमी', 'एकादशी', 'द्वादशी', 'त्रयोदशी', 'चतुर्दशी'];
// prettier-ignore
const TITHI_EN = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi'];

const DIGITS = '०१२३४५६७८९';
/** 1948 -> "१९४८" */
export const marathiDigits = (n: number) => String(n).replace(/\d/g, (c) => DIGITS[Number(c)]);

export function monthName(t: Pick<Tithi, 'month' | 'adhik'>, lang: 'mr' | 'en' = 'mr'): string {
	const name = (lang === 'mr' ? MONTHS_MR : MONTHS_EN)[t.month];
	return t.adhik ? (lang === 'mr' ? `अधिक ${name}` : `Adhik ${name}`) : name;
}

export function tithiName(n: number, lang: 'mr' | 'en' = 'mr'): string {
	if (n === 15) return lang === 'mr' ? 'पौर्णिमा' : 'Purnima';
	if (n === 30) return lang === 'mr' ? 'अमावास्या' : 'Amavasya';
	return (lang === 'mr' ? TITHI_MR : TITHI_EN)[(n - 1) % 15];
}

export const pakshaName = (n: number, lang: 'mr' | 'en' = 'mr') =>
	n <= 15 ? (lang === 'mr' ? 'शुद्ध' : 'Shukla') : lang === 'mr' ? 'वद्य' : 'Krishna';

/* ---------------------------- festivals ---------------------------- */

interface Rule extends MarathiFestival {
	month: number;
	tithi: number;
	when: When;
	/** Purnima festivals: if Bhadra (the first half of Purnima) still runs at this time, it moves to the next day */
	bhadra?: When;
	/** tithi at that time on two days running: keep the second (default: the first) */
	second?: boolean;
}

// prettier-ignore
const RULES: Rule[] = [
	{ id: 'gudi-padwa', mr: 'गुढीपाडवा', en: 'Gudi Padwa', emoji: '1f6a9', major: true, month: 0, tithi: 1, when: 'sunrise' },
	{ id: 'ram-navami', mr: 'रामनवमी', en: 'Ram Navami', emoji: '1f3f9', major: true, month: 0, tithi: 9, when: 'noon' },
	{ id: 'hanuman-jayanti', mr: 'हनुमान जयंती', en: 'Hanuman Jayanti', emoji: '1f4aa', major: true, month: 0, tithi: 15, when: 'sunrise' },
	{ id: 'akshaya-tritiya', mr: 'अक्षय्य तृतीया', en: 'Akshaya Tritiya', emoji: '2728', major: true, month: 1, tithi: 3, when: 'sunrise' },
	{ id: 'vat-purnima', mr: 'वटपौर्णिमा', en: 'Vat Purnima', emoji: '1f333', major: true, month: 2, tithi: 15, when: 'sunrise' },
	{ id: 'ashadhi-ekadashi', mr: 'आषाढी एकादशी', en: 'Ashadhi Ekadashi', emoji: '1f64f', major: true, month: 3, tithi: 11, when: 'sunrise' },
	{ id: 'guru-purnima', mr: 'गुरुपौर्णिमा', en: 'Guru Purnima', emoji: '1f4da', major: true, month: 3, tithi: 15, when: 'sunrise' },
	{ id: 'nag-panchami', mr: 'नागपंचमी', en: 'Nag Panchami', emoji: '1f40d', major: true, month: 4, tithi: 5, when: 'sunrise' },
	{ id: 'narali-purnima', mr: 'नारळी पौर्णिमा · रक्षाबंधन', en: 'Narali Purnima · Raksha Bandhan', emoji: '1f965', major: true, month: 4, tithi: 15, when: 'afternoon', bhadra: 'night' },
	{ id: 'gokulashtami', mr: 'गोकुळाष्टमी', en: 'Gokulashtami', emoji: '1f99a', major: true, month: 4, tithi: 23, when: 'sunrise' },
	{ id: 'pola', mr: 'पोळा', en: 'Pola', emoji: '1f402', major: true, month: 4, tithi: 30, when: 'sunrise' },
	{ id: 'hartalika', mr: 'हरतालिका', en: 'Hartalika', emoji: '1f33c', major: true, month: 5, tithi: 3, when: 'sunrise' },
	{ id: 'ganesh-chaturthi', mr: 'गणेश चतुर्थी', en: 'Ganesh Chaturthi', emoji: '1f418', major: true, month: 5, tithi: 4, when: 'noon' },
	{ id: 'anant-chaturdashi', mr: 'अनंत चतुर्दशी', en: 'Anant Chaturdashi', emoji: '1f418', major: true, month: 5, tithi: 14, when: 'sunrise' },
	{ id: 'ghatasthapana', mr: 'घटस्थापना', en: 'Ghatasthapana (Navratri)', emoji: '1fa94', major: true, month: 6, tithi: 1, when: 'sunrise' },
	{ id: 'dasara', mr: 'दसरा', en: 'Dasara', emoji: '1f3f9', major: true, month: 6, tithi: 10, when: 'afternoon' },
	{ id: 'kojagiri', mr: 'कोजागरी पौर्णिमा', en: 'Kojagiri Purnima', emoji: '1f95b', major: true, month: 6, tithi: 15, when: 'midnight' },
	{ id: 'vasubaras', mr: 'वसुबारस', en: 'Vasubaras', emoji: '1f404', major: true, month: 6, tithi: 27, when: 'evening' },
	{ id: 'dhanteras', mr: 'धनत्रयोदशी', en: 'Dhanteras', emoji: '1fa99', major: true, month: 6, tithi: 28, when: 'evening' },
	{ id: 'narak-chaturdashi', mr: 'नरक चतुर्दशी', en: 'Narak Chaturdashi', emoji: '1fa94', major: true, month: 6, tithi: 29, when: 'sunrise' },
	{ id: 'lakshmi-pujan', mr: 'लक्ष्मीपूजन', en: 'Lakshmi Pujan (Diwali)', emoji: '1fa94', major: true, month: 6, tithi: 30, when: 'evening' },
	{ id: 'padwa', mr: 'दिवाळी पाडवा', en: 'Diwali Padwa', emoji: '1fa94', major: true, month: 7, tithi: 1, when: 'sunrise' },
	{ id: 'bhaubeej', mr: 'भाऊबीज', en: 'Bhaubeej', emoji: '1f381', major: true, month: 7, tithi: 2, when: 'afternoon', second: true },
	{ id: 'kartiki-ekadashi', mr: 'कार्तिकी एकादशी', en: 'Kartiki Ekadashi', emoji: '1f64f', major: true, month: 7, tithi: 11, when: 'sunrise' },
	{ id: 'tripuri-purnima', mr: 'त्रिपुरी पौर्णिमा', en: 'Tripuri Purnima', emoji: '1fa94', major: true, month: 7, tithi: 15, when: 'evening' },
	{ id: 'datta-jayanti', mr: 'दत्त जयंती', en: 'Datta Jayanti', emoji: '1f64f', major: true, month: 8, tithi: 15, when: 'evening' },
	{ id: 'maha-shivratri', mr: 'महाशिवरात्री', en: 'Maha Shivratri', emoji: '1f531', major: true, month: 10, tithi: 29, when: 'midnight' },
	{ id: 'holi', mr: 'होळी', en: 'Holi (Holika Dahan)', emoji: '1f525', major: true, month: 11, tithi: 15, when: 'evening' },
	{ id: 'rang-panchami', mr: 'रंगपंचमी', en: 'Rang Panchami', emoji: '1f308', major: true, month: 11, tithi: 20, when: 'sunrise' }
];

const HOLI = RULES.find((r) => r.id === 'holi')!;

// every month: Ekadashi (both), Sankashti Chaturthi, Purnima, Amavasya
// prettier-ignore
const MONTHLY: (Omit<Rule, 'month'>)[] = [
	{ id: 'ekadashi', mr: 'एकादशी', en: 'Ekadashi', emoji: '1f64f', major: false, tithi: 11, when: 'sunrise' },
	{ id: 'ekadashi', mr: 'एकादशी', en: 'Ekadashi', emoji: '1f64f', major: false, tithi: 26, when: 'sunrise' },
	{ id: 'sankashti', mr: 'संकष्टी चतुर्थी', en: 'Sankashti Chaturthi', emoji: '1f418', major: false, tithi: 19, when: 'moonrise' },
	{ id: 'purnima', mr: 'पौर्णिमा', en: 'Purnima', emoji: '1f315', major: false, tithi: 15, when: 'sunrise' },
	{ id: 'amavasya', mr: 'अमावास्या', en: 'Amavasya', emoji: '1f311', major: false, tithi: 30, when: 'sunrise' }
];

const prevTithi = (n: number) => (n === 1 ? 30 : n - 1);
const nextTithi = (n: number) => (n === 30 ? 1 : n + 1);

/** calendar date + n days */
function addDays(y: number, m: number, d: number, n: number): [number, number, number] {
	const t = new Date(Date.UTC(y, m - 1, d + n));
	return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

type RuleLike = Omit<Rule, 'month'> & { month?: number };

/** the plain tithi rule: its tithi runs at the festival's time of day */
function tithiDay(rule: RuleLike, y: number, m: number, d: number, place: Place): boolean {
	const at = (dd: [number, number, number]) => timeOf(rule.when, ...dd, place);
	const now = at([y, m, d]);
	const today = tithiNumber(now);
	const monthOk = (jd: number) => {
		const t = monthAt(jd);
		return !t.adhik && (rule.month === undefined || t.month === rule.month);
	};
	if (today === rule.tithi) {
		// running on two days at that time: the first (or the second) of them
		if (tithiNumber(at(addDays(y, m, d, rule.second ? 1 : -1))) === rule.tithi) return false;
		return monthOk(now);
	}
	// skipped (kshaya): it starts after today's time and is over by tomorrow's,
	// so it is kept on the day it begins
	if (today !== prevTithi(rule.tithi)) return false;
	const tomorrow = at(addDays(y, m, d, 1));
	return tithiNumber(tomorrow) === nextTithi(rule.tithi) && monthOk(rule.tithi === 30 ? now : tomorrow);
}

/** Bhadra (Vishti): the first half of Purnima; a Purnima festival in it moves to the next day */
function inBhadra(rule: RuleLike, y: number, m: number, d: number, place: Place): boolean {
	return elongation(timeOf(rule.bhadra!, y, m, d, place)) < 174;
}

/** Bhadra still running then, and Purnima still there at the next sunrise: it moves to that day */
function movesOn(rule: RuleLike, y: number, m: number, d: number, place: Place): boolean {
	if (!inBhadra(rule, y, m, d, place)) return false;
	return tithiNumber(sunTimes(...addDays(y, m, d, 1), place).rise) === rule.tithi;
}

/** Is this festival on this day? */
function falls(rule: RuleLike, y: number, m: number, d: number, place: Place): boolean {
	if (!rule.bhadra) return tithiDay(rule, y, m, d, place);
	if (tithiDay(rule, y, m, d, place)) return !movesOn(rule, y, m, d, place);
	const prev = addDays(y, m, d, -1);
	return tithiDay(rule, ...prev, place) && movesOn(rule, ...prev, place);
}

/** Makar Sankranti: the day the Sun moves into sidereal Makara; after sunset it counts the next day */
function isMakarSankranti(y: number, m: number, d: number, place: Place): boolean {
	if (m !== 1) return false;
	const today = sunTimes(y, m, d, place);
	const yesterday = sunTimes(...addDays(y, m, d, -1), place);
	return sunSign(yesterday.set) === 8 && sunSign(today.set) === 9;
}

/** the full panchang for one calendar date (y, month 1-12, d) */
export function panchangFor(y: number, m: number, d: number, place: Place): PanchangDay {
	const t = tithiAt(sunTimes(y, m, d, place).rise);
	const festivals: MarathiFestival[] = [];
	const add = (r: MarathiFestival) => {
		if (!festivals.some((f) => f.id === r.id)) festivals.push({ id: r.id, mr: r.mr, en: r.en, emoji: r.emoji, major: r.major });
	};
	if (isMakarSankranti(y, m, d, place))
		add({ id: 'makar-sankranti', mr: 'मकर संक्रांत', en: 'Makar Sankranti', emoji: '1fa81', major: true });
	for (const r of RULES) if (falls(r, y, m, d, place)) add(r);
	// colours the day after the Holi bonfire
	if (falls(HOLI, ...addDays(y, m, d, -1), place))
		add({ id: 'dhulivandan', mr: 'धुलिवंदन', en: 'Dhulivandan', emoji: '1f3a8', major: true });
	// the monthly days, unless a big festival already names that day (Ashadhi Ekadashi...)
	for (const r of MONTHLY) if (!festivals.some((f) => f.major) && falls(r, y, m, d, place)) add(r);

	// Shaka year: starts at Gudi Padwa (Chaitra); Paush-Phalgun in Jan-Apr still belong to the old one
	const shaka = y - (m <= 4 && t.month >= 9 ? 79 : 78);
	return {
		...t,
		shaka,
		festivals,
		marathi: `${monthName(t)} ${pakshaName(t.n)} ${tithiName(t.n)}`,
		english: `${monthName(t, 'en')} ${pakshaName(t.n, 'en')} ${tithiName(t.n, 'en')}`
	};
}

/** a whole month of panchang days, by "YYYY-MM-DD" (memoised: the grid re-renders often) */
const cache = new Map<string, Map<string, PanchangDay>>();
export function panchangMonth(year: number, month0: number, place: Place): Map<string, PanchangDay> {
	const id = `${year}-${month0}@${place.latitude.toFixed(2)},${place.longitude.toFixed(2)}`;
	const hit = cache.get(id);
	if (hit) return hit;
	const out = new Map<string, PanchangDay>();
	const days = new Date(year, month0 + 1, 0).getDate();
	for (let d = 1; d <= days; d++) {
		const key = `${year}-${String(month0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
		out.set(key, panchangFor(year, month0 + 1, d, place));
	}
	if (cache.size > 24) cache.clear();
	cache.set(id, out);
	return out;
}

/** upcoming big Marathi festivals from a date, for the calendar's side list */
export function upcomingFestivals(
	fromKey: string,
	place: Place,
	count = 4,
	maxDays = 120
): { date: string; festival: MarathiFestival }[] {
	const out: { date: string; festival: MarathiFestival }[] = [];
	const [y, m, d] = fromKey.split('-').map(Number);
	for (let i = 0; i < maxDays && out.length < count; i++) {
		const day = new Date(Date.UTC(y, m - 1, d + i));
		const yy = day.getUTCFullYear();
		const mm = day.getUTCMonth();
		const key = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
		const p = panchangMonth(yy, mm, place).get(key);
		for (const f of p?.festivals ?? []) if (f.major && out.length < count) out.push({ date: key, festival: f });
	}
	return out;
}

// exported for tests
export const _internal = { newMoonBefore, elongation, jdOf, msOf };
