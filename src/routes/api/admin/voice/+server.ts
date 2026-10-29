import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { getConfig } from '#lib/server/config';
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
 * GET /api/admin/voice -> { installed, server, voices: [{ id, name, funny }], voice, speed }
 * (without a voice server only Amy, the Pi's own voice, is offered)
 */
export async function GET({ cookies }) {
	requireAdmin(cookies);
	const voices = await serverVoices();
	const s = getVoice();
	return json({ installed: voiceInstalled(), server: !!voices, voices: voices ?? AMY_ONLY, voice: s.voice, speed: s.speed });
}

/** POST /api/admin/voice { voice?, speed? } -> settings, and the new voice says hello */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	const patch: Partial<VoiceSettings> = {};
	if (body.voice !== undefined) {
		if (!voiceIdOk(body.voice)) error(400, 'bad voice');
		patch.voice = body.voice;
	}
	if (body.speed !== undefined) {
		if (typeof body.speed !== 'number' || body.speed < SPEEDS.min || body.speed > SPEEDS.max) error(400, 'bad speed');
		patch.speed = body.speed;
	}
	const s = saveVoice(patch);
	if (voiceInstalled() && s.enabled && s.volume > 0) {
		const kids = getConfig().kids.map((k) => k.name);
		say(`Hi ${kids.join(' and ')}! This is how I sound. Seven times eight is fifty-six.`).catch((err) =>
			console.warn(`[voice] ${err}`)
		);
	}
	return json(s);
}
