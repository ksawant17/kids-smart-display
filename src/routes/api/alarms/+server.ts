import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { listAlarms, removeAlarm, saveAlarm, skipNext, tryAlarm } from '#lib/server/alarms';
import { getVoice, saveVoice, voiceInstalled } from '#lib/server/voice';

const reply = async () => json({ alarms: await listAlarms(), volume: getVoice().alarmVolume });
const okId = (v: unknown) => (typeof v === 'string' ? v.slice(0, 20) : '');

/**
 * Wake-up alarms (Grown-ups tab only):
 *   GET  -> { alarms: [Alarm & { next }], volume }
 *   POST { save: Alarm }          add (no id) or change one
 *   POST { remove: id }
 *   POST { skip: id, on: bool }   leave out (or keep) its next morning
 *   POST { volume: 10-100 }       the alarms' own loudness
 *   POST { try: true } -> { text } the tune and the good morning, now
 */
export async function GET({ cookies }) {
	requireAdmin(cookies);
	return reply();
}

export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'bad request');
	try {
		if (body.save !== undefined) saveAlarm(body.save);
		else if (body.remove !== undefined) removeAlarm(okId(body.remove));
		else if (body.skip !== undefined) await skipNext(okId(body.skip), body.on === true);
		else if (body.volume !== undefined) {
			const v = Number(body.volume);
			if (!Number.isFinite(v) || v < 10 || v > 100) error(400, 'bad volume');
			saveVoice({ alarmVolume: Math.round(v) });
		} else if (body.try === true) {
			if (!voiceInstalled()) error(404, 'The alarm needs the audio HAT');
			return json({ text: await tryAlarm() });
		} else error(400, 'Unknown action');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		error(400, err instanceof Error ? err.message : String(err));
	}
	return reply();
}
