import { json, error } from '@sveltejs/kit';
import { getVoice, saveVoice, say, voiceInstalled, type VoiceSettings } from '#lib/server/voice';
import { isAdmin, isLocal } from '#lib/server/admin';

/**
 * POST /api/voice { volume?: 0-100, mic?: boolean, sample?: true } -> settings
 * From the quick menu's volume slider and mic switch. `sample` says a word at
 * the new volume (when the slider is let go). Like the screen controls: only
 * the kiosk itself or an unlocked Grown-ups tab.
 */
export async function POST({ request, cookies, getClientAddress }) {
	if (!isLocal(getClientAddress()) && !isAdmin(cookies)) error(403, 'Only the dashboard screen can do that');
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	const patch: Partial<VoiceSettings> = {};
	if (body.volume !== undefined) {
		if (typeof body.volume !== 'number' || !Number.isFinite(body.volume)) error(400, 'volume must be a number');
		patch.volume = Math.min(100, Math.max(0, Math.round(body.volume)));
	}
	if (body.mic !== undefined) {
		if (typeof body.mic !== 'boolean') error(400, 'mic must be true or false');
		patch.mic = body.mic;
	}
	const s = Object.keys(patch).length ? saveVoice(patch) : getVoice();
	if (body.sample === true && voiceInstalled() && s.enabled && s.volume > 0)
		say('This loud!').catch((err) => console.warn(`[voice] ${err}`));
	return json(s);
}
