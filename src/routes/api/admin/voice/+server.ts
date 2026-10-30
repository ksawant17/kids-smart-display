import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { getConfig } from '#lib/server/config';
import { announceNow } from '#lib/server/announce';
import {
	DEFAULT_VOICE,
	SPEEDS,
	getVoice,
	saveVoice,
	say,
	serverVoices,
	voiceIdOk,
	voiceInstalled,
	type VoiceSettings
} from '#lib/server/voice';

const AMY_ONLY = [{ id: DEFAULT_VOICE, name: 'Amy', funny: false }];

/**
 * GET /api/admin/voice -> { installed, server, voices: [{ id, name, funny }], voice, speed, hourly }
 * (without a voice server only Amy, the Pi's own voice, is offered)
 */
export async function GET({ cookies }) {
	requireAdmin(cookies);
	const voices = await serverVoices();
	const s = getVoice();
	return json({ installed: voiceInstalled(), server: !!voices, voices: voices ?? AMY_ONLY, voice: s.voice, speed: s.speed, hourly: s.hourly });
}

/**
 * POST /api/admin/voice { voice?, speed? } -> settings, and the new voice says hello
 *                       { hourly: { enabled, from, to, weather } } -> settings (quietly)
 *                       { announce: true } -> { text }: the hourly announcement, now
 */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	if (body.announce === true) {
		if (!voiceInstalled()) error(404, 'The voice needs the audio HAT');
		try {
			return json({ text: await announceNow() });
		} catch (err) {
			console.warn(`[hourly] ${err}`);
			error(502, 'The voice could not speak');
		}
	}
	const patch: Partial<VoiceSettings> = {};
	if (body.hourly !== undefined) {
		const h = body.hourly ?? {};
		const hour = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 23;
		if (typeof h.enabled !== 'boolean' || typeof h.weather !== 'boolean' || !hour(h.from) || !hour(h.to))
			error(400, 'bad hourly settings');
		patch.hourly = { enabled: h.enabled, from: h.from, to: h.to, weather: h.weather };
	}
	if (body.voice !== undefined) {
		if (!voiceIdOk(body.voice)) error(400, 'bad voice');
		patch.voice = body.voice;
	}
	if (body.speed !== undefined) {
		if (typeof body.speed !== 'number' || body.speed < SPEEDS.min || body.speed > SPEEDS.max) error(400, 'bad speed');
		patch.speed = body.speed;
	}
	const s = saveVoice(patch);
	if ((patch.voice || patch.speed) && voiceInstalled() && s.enabled && s.volume > 0) {
		const kids = getConfig().kids.map((k) => k.name);
		say(`Hi ${kids.join(' and ')}! This is how I sound. Seven times eight is fifty-six.`).catch((err) =>
			console.warn(`[voice] ${err}`)
		);
	}
	return json(s);
}
