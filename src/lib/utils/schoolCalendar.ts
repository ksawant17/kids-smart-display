/**
 * School-calendar helpers (pure, unit-testable).
 *
 * Events come from the school district's iCal "key dates" feed (see
 * src/lib/server/schoolFeed.ts) and are normalised by fromIcs() into:
 *   { date, endDate?, title, subtitle, type, early? }
 *   type: first_day | last_day | no_school | early_release | event
 */
import type { IcsEvent } from './ics';

export type SchoolEventType = 'first_day' | 'last_day' | 'no_school' | 'early_release' | 'event';

export interface SchoolEvent {
	date: string; // YYYY-MM-DD
	endDate?: string; // inclusive
	title: string;
	subtitle: string;
	type: SchoolEventType;
	/** last day of school is often also an early release */
	early?: boolean;
}

/** How a day cell is colored in the month grid. */
export type DayMark = 'holiday' | 'early' | 'milestone' | null;

/** How an agenda row is styled. */
export type AgendaKind = 'no-school' | 'early' | 'break' | 'normal';

export interface AgendaItem {
	date: string;
	endDate?: string;
	title: string;
	subtitle: string;
	kind: AgendaKind;
	/** started before the "from" day and is still going */
	ongoing: boolean;
}

export type TodayKind = 'no-school' | 'early' | 'special' | 'weekend' | 'summer' | 'regular';

export interface TodayStatus {
	kind: TodayKind;
	/** headline, e.g. "No School Today!" / "Early Release!" / "School Day" */
	title: string;
	/** detail, e.g. event name or "Next day off: Mon, Oct 12" */
	subtitle: string;
	event?: SchoolEvent;
}

/* ------------------------------------------------------------------ */

const pad = (n: number) => String(n).padStart(2, '0');

/** month is 0-based, like Date#getMonth() */
export function dateKey(y: number, m: number, d: number): string {
	return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export function keyOf(date: Date): string {
	return dateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function isWeekend(key: string): boolean {
	const dow = parseKey(key).getDay();
	return dow === 0 || dow === 6;
}

const short = (key: string) => parseKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const weekdayShort = (key: string) =>
	parseKey(key).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/* ---------------------------- feed mapping ---------------------------- */

const NO_SCHOOL = /holiday|break|workday|staff development|planning day|no school|closed|closing/i;

/**
 * Turn a raw feed summary into a kid-friendly event, e.g.
 *   "Holiday (Yom Kippur)"                          -> no_school  "Yom Kippur"
 *   "Student Holiday (Teacher Workday)"             -> no_school  "Teacher Workday"
 *   "Labor Day Break (Holiday)"                     -> no_school  "Labor Day Break"
 *   "End of First Quarter - Two-Hour Early Release" -> early      "2-Hour Early Release" / "End of First Quarter"
 *   "Last Day of School (Early Release)"            -> last_day (early)
 */
export function fromIcs(ev: IcsEvent): SchoolEvent {
	const s = ev.summary.trim();
	const base = { date: ev.start, ...(ev.end !== ev.start ? { endDate: ev.end } : {}) };
	const paren = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(s);
	const outer = paren ? paren[1].trim() : s;
	const inner = paren ? paren[2].trim() : '';

	if (/^first day of school/i.test(s)) {
		return { ...base, title: 'First Day of School', subtitle: 'Welcome back!', type: 'first_day' };
	}
	if (/^last day of school/i.test(s)) {
		const early = /early release/i.test(s);
		return {
			...base,
			title: 'Last Day of School',
			subtitle: early ? 'Early release — summer starts!' : 'Summer starts!',
			type: 'last_day',
			early
		};
	}
	if (/early release|early dismissal/i.test(s)) {
		const what = /two[- ]hour|2[- ]hour/i.test(s) ? '2-Hour Early Release' : 'Early Release';
		const why = s.split(/\s+[-–—]\s+/).find((p) => !/early (release|dismissal)/i.test(p)) ?? '';
		return { ...base, title: what, subtitle: why, type: 'early_release' };
	}
	if (NO_SCHOOL.test(s)) {
		// prefer the specific name: "Holiday (Yom Kippur)" -> "Yom Kippur",
		// but "Labor Day Break (Holiday)" -> "Labor Day Break"
		const generic = /^(student )?holidays?$/i;
		const title = inner && !generic.test(inner) ? inner : outer;
		return { ...base, title: title.replace(/,\s*observed$/i, ' (observed)'), subtitle: 'No School', type: 'no_school' };
	}
	return { ...base, title: s, subtitle: '', type: 'event' };
}

/* ------------------------------ queries ------------------------------ */

/** Does this event cover the given date (handles multi-day ranges)? */
export function covers(ev: SchoolEvent, key: string): boolean {
	return ev.date <= key && key <= (ev.endDate ?? ev.date);
}

const PRIORITY: Record<SchoolEventType, number> = {
	no_school: 0,
	early_release: 1,
	last_day: 2,
	first_day: 3,
	event: 4
};

/** Most important event covering a date (no-school beats everything). */
export function eventOn(events: SchoolEvent[], key: string): SchoolEvent | null {
	let best: SchoolEvent | null = null;
	for (const ev of events) {
		if (covers(ev, key) && (!best || PRIORITY[ev.type] < PRIORITY[best.type])) best = ev;
	}
	return best;
}

/** Day-cell marks for a month grid: no school red, early release yellow, first/last day green. */
export function monthMarks(events: SchoolEvent[], year: number, month: number): Map<string, DayMark> {
	const marks = new Map<string, DayMark>();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	for (let d = 1; d <= daysInMonth; d++) {
		const key = dateKey(year, month, d);
		const ev = eventOn(events, key);
		if (!ev) continue;
		if (ev.type === 'no_school') marks.set(key, 'holiday');
		else if (ev.type === 'early_release' || ev.early) marks.set(key, 'early');
		else if (ev.type === 'first_day' || ev.type === 'last_day') marks.set(key, 'milestone');
	}
	return marks;
}

/** "Nov 25 - Nov 27" for a range, "Oct 12" for a single day. */
export function formatRange(ev: { date: string; endDate?: string }): string {
	if (!ev.endDate || ev.endDate === ev.date) return short(ev.date);
	return `${short(ev.date)} - ${short(ev.endDate)}`;
}

/** Map a school event to its agenda-row form. */
export function agendaItem(ev: SchoolEvent, fromKey = ev.date): AgendaItem {
	const ongoing = ev.date < fromKey;
	const multi = !!ev.endDate && ev.endDate !== ev.date;
	const base = { date: ev.date, endDate: ev.endDate, ongoing };

	if (ev.type === 'no_school') {
		if (!multi) return { ...base, title: 'No School', subtitle: ev.title, kind: 'no-school' };
		const sub = ongoing ? `Now — back after ${short(ev.endDate!)}` : formatRange(ev);
		return { ...base, title: ev.title, subtitle: sub, kind: 'break' };
	}
	if (ev.type === 'early_release' || ev.early) {
		return { ...base, title: ev.title, subtitle: ev.subtitle, kind: 'early' };
	}
	return { ...base, title: ev.title, subtitle: ev.subtitle, kind: 'normal' };
}

/** Events still to come (or still going) on/after a date, sorted and capped. */
export function upNext(events: SchoolEvent[], fromKey: string, count = 4): AgendaItem[] {
	return events
		.filter((ev) => (ev.endDate ?? ev.date) >= fromKey)
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
		.slice(0, count)
		.map((ev) => agendaItem(ev, fromKey));
}

/** Is this date between a school year's last day and the next first day? */
function summerInfo(events: SchoolEvent[], key: string): { summer: boolean; nextFirst?: SchoolEvent } {
	const firsts = events.filter((e) => e.type === 'first_day');
	if (!firsts.length) return { summer: false }; // no data: assume school year
	const lasts = events.filter((e) => e.type === 'last_day');
	const prevFirst = firsts.filter((e) => e.date <= key).at(-1);
	const prevLast = lasts.filter((e) => e.date < key).at(-1);
	const nextFirst = firsts.find((e) => e.date > key);
	const inYear = !!prevFirst && (!prevLast || prevFirst.date > prevLast.date);
	return { summer: !inYear, nextFirst };
}

/** What's the deal with school today? (for the TODAY tab banner) */
export function todayStatus(events: SchoolEvent[], key: string): TodayStatus {
	const ev = eventOn(events, key);
	if (ev) {
		if (ev.type === 'no_school') return { kind: 'no-school', title: 'No School Today!', subtitle: ev.title, event: ev };
		if (ev.type === 'early_release')
			return { kind: 'early', title: 'Early Release!', subtitle: ev.subtitle || ev.title, event: ev };
		if (ev.type === 'last_day')
			return { kind: ev.early ? 'early' : 'special', title: 'Last Day of School!', subtitle: ev.subtitle, event: ev };
		if (ev.type === 'first_day')
			return { kind: 'special', title: 'First Day of School!', subtitle: ev.subtitle, event: ev };
	}

	const { summer, nextFirst } = summerInfo(events, key);
	if (summer) {
		return {
			kind: 'summer',
			title: 'Summer Break!',
			subtitle: nextFirst ? `Back to school ${weekdayShort(nextFirst.date)}` : 'Have a great summer!'
		};
	}
	if (isWeekend(key)) return { kind: 'weekend', title: "It's the Weekend!", subtitle: 'No school today' };
	if (ev) return { kind: 'special', title: ev.title, subtitle: ev.subtitle || 'School Day', event: ev };

	const nextOff = events.find((e) => e.type === 'no_school' && e.date > key);
	return {
		kind: 'regular',
		title: 'School Day',
		subtitle: nextOff ? `Next day off: ${weekdayShort(nextOff.date)}` : ''
	};
}
