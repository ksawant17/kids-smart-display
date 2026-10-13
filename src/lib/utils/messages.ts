/**
 * Notes from grown-ups shown in the TODAY banner ("Library books today!").
 * Each one shows from `from` to `until` (YYYY-MM-DD, inclusive; until = null:
 * every day until it is removed).
 */

export interface ParentMessage {
	id: string;
	text: string;
	/** twemoji code */
	emoji: string;
	from: string;
	until: string | null;
}

export const MESSAGE_MAX = 70;

/** one-tap notes for the usual school-day reminders */
export const MESSAGE_PRESETS: { text: string; emoji: string }[] = [
	{ text: 'Library day! Bring your books', emoji: '1f4da' },
	{ text: 'Sneakers for gym!', emoji: '1f45f' },
	{ text: 'Picture day! Big smile!', emoji: '1f4f8' },
	{ text: 'Bring your water bottle', emoji: '1f964' },
	{ text: 'Show and tell!', emoji: '1f9f8' },
	{ text: 'Field trip day!', emoji: '1f68c' },
	{ text: 'Early pickup', emoji: '1f697' },
	{ text: 'Pajama day!', emoji: '1f9e6' },
	{ text: 'Practice after school', emoji: '26bd' },
	{ text: 'We love you!', emoji: '2764' }
];

/** stickers to pick for a typed note */
export const MESSAGE_EMOJIS = ['1f4e3', '2b50', '1f4da', '1f392', '1f389', '2764', '1f3b5', '26bd', '1f382', '1f36a'];

const KEY = /^\d{4}-\d{2}-\d{2}$/;
export const isDayKey = (s: unknown): s is string => typeof s === 'string' && KEY.test(s);

/** printable text, 1..MESSAGE_MAX characters after trimming */
export function cleanMessage(text: unknown): string | null {
	if (typeof text !== 'string') return null;
	// eslint-disable-next-line no-control-regex
	const t = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
	return t.length >= 1 && t.length <= MESSAGE_MAX ? t : null;
}

/** messages showing on `dayKey` */
export function messagesOn(messages: ParentMessage[], dayKey: string): ParentMessage[] {
	return messages.filter((m) => m.from <= dayKey && (m.until === null || dayKey <= m.until));
}

/** "Today" / "Tomorrow" / "Every day" / "Mon, Oct 12" */
export function whenLabel(m: ParentMessage, todayKey: string, tomorrowKey: string): string {
	if (m.until === null) return m.from > todayKey ? `From ${m.from === tomorrowKey ? 'tomorrow' : m.from}` : 'Every day';
	if (m.from === m.until) {
		if (m.from === todayKey) return 'Today';
		if (m.from === tomorrowKey) return 'Tomorrow';
		return m.from;
	}
	return `${m.from} – ${m.until}`;
}
