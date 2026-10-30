import { json, error } from '@sveltejs/kit';
import { isAdmin, isLocal } from '#lib/server/admin';
import { addReminder, cancelReminder, reminderState, snooze, stopRinging } from '#lib/server/reminders';
import { MAX_TIMER_MINUTES, cleanLabel } from '#lib/utils/reminders';

const okId = (v: unknown) => (typeof v === 'string' ? v.slice(0, 40) : '');

/**
 * Timers and reminders (the kiosk screen, or an unlocked Grown-ups tab):
 *   GET  -> { upcoming: Reminder[], ringing: Reminder[] }
 *   POST { action: "stop", id? }     stop one going off (all with no id)
 *   POST { action: "snooze", id }    5 more minutes
 *   POST { action: "cancel", id }    take one off the list (also 🎤 Ask's Undo)
 *   POST { action: "add", kind: "timer", minutes, label? }
 *   POST { action: "add", kind: "reminder", time: "HH:MM", label? }  (grown-ups: today, or tomorrow once it has gone by)
 */
export function GET({ cookies, getClientAddress }) {
	if (!isLocal(getClientAddress()) && !isAdmin(cookies)) error(403, 'Only the dashboard screen can do that');
	return json(reminderState());
}

export async function POST({ request, cookies, getClientAddress }) {
	const admin = isAdmin(cookies);
	if (!isLocal(getClientAddress()) && !admin) error(403, 'Only the dashboard screen can do that');
	const body = await request.json().catch(() => null);
	switch (body?.action) {
		case 'stop':
			stopRinging(okId(body.id));
			break;
		case 'snooze':
			if (!snooze(okId(body.id))) error(404, 'Not going off');
			break;
		case 'cancel':
			if (!cancelReminder(okId(body.id))) error(404, 'Not found');
			break;
		case 'add': {
			if (!admin) error(403, 'Only grown-ups can add them here');
			const label = cleanLabel(body.label);
			let at: number;
			if (body.kind === 'timer') {
				const minutes = Number(body.minutes);
				if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_TIMER_MINUTES) error(400, 'bad minutes');
				at = Date.now() + Math.round(minutes * 60_000);
			} else if (body.kind === 'reminder') {
				const m = typeof body.time === 'string' ? body.time.match(/^([01]\d|2[0-3]):([0-5]\d)$/) : null;
				if (!m) error(400, 'bad time');
				const d = new Date();
				d.setHours(Number(m[1]), Number(m[2]), 0, 0);
				if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
				at = d.getTime();
			} else error(400, 'bad kind');
			const res = addReminder(body.kind, at, label, { kid: false });
			if (!res.ok) error(400, res.why);
			break;
		}
		default:
			error(400, 'Unknown action');
	}
	return json(reminderState());
}
