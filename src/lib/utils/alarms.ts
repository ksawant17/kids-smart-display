/**
 * Wake-up alarms (set in the Grown-ups tab): a time, a label and how it
 * repeats. "School days" follows the school calendar, so holidays and breaks
 * are skipped by themselves. "Skip next" leaves out one morning (a sick day)
 * without turning the alarm off.
 */

export type Repeat = 'once' | 'daily' | 'weekdays' | 'weekends' | 'school' | 'days';

export interface Alarm {
	id: string;
	/** "HH:MM" (24h), local */
	time: string;
	label: string;
	repeat: Repeat;
	/** for repeat "days": 0 (Sunday) - 6 */
	days: number[];
	on: boolean;
	/** "YYYY-MM-DD": that morning is left out */
	skip: string | null;
}

export const MAX_ALARMS = 8;
export const ALARM_VOLUME_DEFAULT = 85;

export const REPEATS: { id: Repeat; label: string }[] = [
	{ id: 'school', label: 'School days' },
	{ id: 'weekdays', label: 'Weekdays' },
	{ id: 'daily', label: 'Every day' },
	{ id: 'weekends', label: 'Weekends' },
	{ id: 'days', label: 'Pick days' },
	{ id: 'once', label: 'Just once' }
];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const KEY = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" (local) */
export const dayKey = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** An alarm from a saved file or the admin API (null if it isn't one). */
export function readAlarm(v: unknown): Alarm | null {
	if (!v || typeof v !== 'object') return null;
	const a = v as Record<string, unknown>;
	if (typeof a.id !== 'string' || typeof a.time !== 'string' || !HHMM.test(a.time)) return null;
	if (!REPEATS.some((r) => r.id === a.repeat)) return null;
	const days = Array.isArray(a.days) ? [...new Set(a.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
	if (a.repeat === 'days' && !days.length) return null;
	return {
		id: a.id.slice(0, 20),
		time: a.time,
		label: typeof a.label === 'string' ? a.label.replace(/\s+/g, ' ').trim().slice(0, 40) : '',
		repeat: a.repeat as Repeat,
		days: days as number[],
		on: a.on !== false,
		skip: typeof a.skip === 'string' && KEY.test(a.skip) ? a.skip : null
	};
}

/** Does it ring on this day? (not counting "skip" or "on") */
export function ringsOn(a: Alarm, day: Date, schoolDay: (key: string) => boolean): boolean {
	const dow = day.getDay();
	switch (a.repeat) {
		case 'once':
		case 'daily':
			return true;
		case 'weekdays':
			return dow >= 1 && dow <= 5;
		case 'weekends':
			return dow === 0 || dow === 6;
		case 'school':
			return dow >= 1 && dow <= 5 && schoolDay(dayKey(day));
		case 'days':
			return a.days.includes(dow);
	}
}

/**
 * When it next rings after `from` (null: never, e.g. switched off).
 * Built from the local date and time each day, so it stays at 6:45 across
 * daylight-saving changes.
 */
export function nextRing(a: Alarm, from: Date, schoolDay: (key: string) => boolean = () => true): Date | null {
	if (!a.on) return null;
	const [h, m] = a.time.split(':').map(Number);
	for (let i = 0; i < 370; i++) {
		const at = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, h, m, 0, 0);
		if (at.getTime() <= from.getTime()) continue;
		if (a.skip === dayKey(at)) continue;
		if (ringsOn(a, at, schoolDay)) return at;
	}
	return null;
}

/** "6:45 AM" from "06:45" */
export function timeLabel(hhmm: string): string {
	const [h, m] = hhmm.split(':').map(Number);
	return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "today", "tomorrow", "Monday" (within a week), or "Nov 4" */
export function dayWord(at: Date, now: Date): string {
	const days = Math.round(
		(new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() -
			new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
			86_400_000
	);
	if (days === 0) return 'today';
	if (days === 1) return 'tomorrow';
	if (days < 7) return at.toLocaleDateString('en-US', { weekday: 'long' });
	return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** how it repeats, in words: "School days", "Mon, Wed, Fri" */
export function repeatLabel(a: Pick<Alarm, 'repeat' | 'days'>): string {
	if (a.repeat === 'days') return a.days.map((d) => DAY_NAMES[d]).join(', ');
	return REPEATS.find((r) => r.id === a.repeat)!.label;
}

/** "It's a school day." / "There's no school today." for the good-morning message */
export function schoolLine(schoolDay: boolean, weekend: boolean): string {
	if (weekend) return "It's the weekend!";
	return schoolDay ? "It's a school day." : "There's no school today.";
}

/** What the alarm says: "Good morning! It's 6:45. <weather> It's a school day." */
export function wakeText(now: Date, weather: string, school: string): string {
	const t = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/ [AP]M$/, '');
	const hello = now.getHours() < 12 ? 'Good morning!' : 'Hello!';
	return [hello, `It's ${t}.`, weather, school].filter(Boolean).join(' ');
}
