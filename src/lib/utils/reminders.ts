/**
 * Timers and reminders: "set a timer for 10 minutes", "remind me at 4 to
 * feed the fish". Asked for with 🎤 Ask (the AI helper turns the words into
 * one of the actions below, then the server checks it here) or added in the
 * Grown-ups tab. Kids' limits: a timer up to 3 hours, a reminder later today,
 * a few at a time, and never during bedtime quiet hours.
 */
import { hasBlockedWords } from '#lib/utils/content';

/** alarm: a wake-up alarm going off (or snoozed), see utils/alarms.ts */
export type ReminderKind = 'timer' | 'reminder' | 'alarm';

export interface Reminder {
	id: string;
	kind: ReminderKind;
	/** when it goes off (ms) */
	at: number;
	/** what it's for ("teeth brushing"; '' for a plain timer) */
	label: string;
	/** when it was set (ms) */
	made: number;
}

export const MAX_ACTIVE = 6;
export const TODAY_ONLY = 'I can only set reminders for later today. A grown-up can set ones for another day.';
export const MAX_TIMER_MINUTES = 180;
const MAX_LABEL = 60;

/** Does this sound like it's about a timer or reminder? (only then is the AI asked to sort it out) */
export const aboutReminders = (q: string) =>
	/\b(timers?|remind(er|ers)?|alarms?|count ?down|wake (me|us) up|cancel|how (long|much time) (is )?left)\b/i.test(q);

const WORDS: Record<string, number> = {
	a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
	fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, half: 0.5
};

/**
 * "set a timer for 10 minutes", "a 5 minute timer", "timer for one hour":
 * understood straight away, without the AI. null for anything else.
 */
export function quickTimer(q: string): { seconds: number; label: string } | null {
	const t = q
		.toLowerCase()
		.replace(/[.!?,]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\bhalf an hour\b/, '30 minutes');
	if (!/\btimer\b/.test(t) || /\b(cancel|stop|left|remind)\b/.test(t)) return null;
	const m = t.match(/\b(\d+(?:\.\d+)?|[a-z-]+)(?: and a half)? (seconds?|minutes?|mins?|hours?)\b/);
	if (!m) return null;
	const n = /^\d/.test(m[1]) ? Number(m[1]) : WORDS[m[1]];
	if (!n) return null;
	const half = m[0].includes('and a half') ? 0.5 : 0;
	const unit = m[2].startsWith('s') ? 1 : m[2].startsWith('h') ? 3600 : 60;
	// "a timer for 10 minutes for teeth brushing" -> "teeth brushing"
	const rest = t.slice(m.index! + m[0].length);
	const label = rest.match(/^ (?:timer )?(?:for|to) (.+)$/)?.[1] ?? '';
	return { seconds: Math.round((n + half) * unit), label: cleanLabel(label) };
}

/** a label safe to show and say ('' if not) */
export function cleanLabel(v: unknown): string {
	if (typeof v !== 'string') return '';
	const s = v
		.replace(/[^\p{L}\p{N} ',!?-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^(to|for) /i, '')
		.slice(0, MAX_LABEL);
	return hasBlockedWords(s) ? '' : s;
}

export type Intent =
	| { action: 'timer'; seconds: number; label: string }
	| { action: 'reminder'; at: number; label: string }
	| { action: 'list' }
	| { action: 'cancel'; label: string }
	| { action: 'none' };

/** The prompt that turns a kid's words into one action (as JSON). */
export function intentPrompt(now: Date): string {
	const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
	const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	return (
		'You turn what a child said to a family smart display into one action, as JSON only, no other words.\n' +
		`It is ${time} (${hhmm}) now.\n` +
		'Actions:\n' +
		'{"action":"timer","minutes":<number>,"label":"<what it is for, or empty>"}\n' +
		'{"action":"reminder","time":"HH:MM","label":"<what to remind about>"} (at a time: 24-hour, today; "at 4" in the daytime means 16:00)\n' +
		'{"action":"reminder","minutes":<number>,"label":"<what to remind about>"} (in so many minutes from now, like "in 20 minutes")\n' +
		'{"action":"list"} (what timers or reminders are set, how long is left)\n' +
		'{"action":"cancel","label":"<which one, or empty>"}\n' +
		'{"action":"none"} (anything else, like a question or a wake-up alarm)\n' +
		'Labels are a few plain words, like "feed the fish" or "teeth brushing".'
	);
}

/** Checks what the AI said (anything odd -> { action: 'none' }). */
export function readIntent(raw: unknown, now: Date): Intent {
	if (!raw || typeof raw !== 'object') return { action: 'none' };
	const r = raw as Record<string, unknown>;
	const label = cleanLabel(r.label);
	switch (r.action) {
		case 'timer': {
			const minutes = Number(r.minutes);
			if (!Number.isFinite(minutes) || minutes <= 0) return { action: 'none' };
			return { action: 'timer', seconds: Math.round(minutes * 60), label };
		}
		case 'reminder': {
			const minutes = Number(r.minutes);
			if (r.time === undefined && Number.isFinite(minutes) && minutes > 0)
				return { action: 'reminder', at: now.getTime() + Math.round(minutes * 60) * 1000, label };
			const m = typeof r.time === 'string' ? r.time.match(/^(\d{1,2}):(\d{2})$/) : null;
			if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { action: 'none' };
			const at = new Date(now);
			at.setHours(Number(m[1]), Number(m[2]), 0, 0);
			return { action: 'reminder', at: at.getTime(), label };
		}
		case 'list':
			return { action: 'list' };
		case 'cancel':
			return { action: 'cancel', label };
	}
	return { action: 'none' };
}

/** "7:05 PM" */
export const clockTime = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** "10 minutes", "1 hour and 5 minutes", "30 seconds" */
export function duration(seconds: number): string {
	const s = Math.max(0, Math.round(seconds));
	if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
	const total = Math.round(s / 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	const mins = `${m} minute${m === 1 ? '' : 's'}`;
	if (!h) return mins;
	const hours = `${h} hour${h === 1 ? '' : 's'}`;
	return m ? `${hours} and ${mins}` : hours;
}

/** "the teeth brushing timer", "the timer", "the reminder to feed the fish" */
export function nameOf(r: Pick<Reminder, 'kind' | 'label'>): string {
	if (r.kind === 'alarm') return r.label ? `the ${r.label} alarm` : 'the alarm';
	if (r.kind === 'timer') return r.label ? `the ${r.label} timer` : 'the timer';
	return r.label ? `the reminder to ${r.label}` : 'the reminder';
}

/** what's said when it has been set */
export function confirmation(r: Reminder, now: number): string {
	if (r.kind === 'timer') {
		const d = duration((r.at - now) / 1000);
		return r.label ? `OK! ${d} for ${r.label}, starting now.` : `OK! A timer for ${d}, starting now.`;
	}
	return `OK! I'll remind you at ${clockTime(r.at)}${r.label ? ` to ${r.label}` : ''}.`;
}

/** what's said when it goes off */
export function ringText(r: Pick<Reminder, 'kind' | 'label'>): string {
	if (r.kind === 'alarm') return 'Time to wake up!';
	if (r.kind === 'timer') return r.label ? `Time's up for ${r.label}!` : "Time's up!";
	return r.label ? `Reminder: time to ${r.label}!` : "It's reminder time!";
}

/** "how long is left?" */
export function listText(list: Reminder[], now: number): string {
	if (!list.length) return "There aren't any timers or reminders right now.";
	return list
		.slice(0, 3)
		.map((r) =>
			r.kind === 'timer'
				? `${cap(nameOf(r))} has ${duration((r.at - now) / 1000)} left.`
				: `${cap(nameOf(r))} is at ${clockTime(r.at)}.`
		)
		.join(' ');
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** the one to cancel: the only one, or the one whose label matches */
export function pickToCancel(list: Reminder[], label: string): Reminder | null {
	if (list.length === 1) return list[0];
	if (!label) return null;
	const words = label.toLowerCase().split(' ').filter((w) => w.length > 2);
	const hits = list.filter((r) => words.some((w) => r.label.toLowerCase().includes(w)));
	return hits.length === 1 ? hits[0] : null;
}
