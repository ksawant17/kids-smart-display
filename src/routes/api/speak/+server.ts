import { json, error } from '@sveltejs/kit';
import { isAdmin, isLocal } from '#lib/server/admin';
import { isBriefingText } from '#lib/server/briefing';
import { isCardText } from '#lib/server/readable';
import { maySay, say, speaking, stopSpeaking, voiceOn } from '#lib/server/voice';

/**
 * POST /api/speak { text } reads it aloud and answers when it has finished;
 *                 { stop: true } stops talking.
 * Only text the dashboard wrote itself can be spoken (the briefing, answers,
 * stories, and the QUOTE / FUN cards as utils/readAloud.ts reads them), so
 * nobody on the home network can make it say anything else.
 */
export async function POST({ request, cookies, getClientAddress }) {
	if (!isLocal(getClientAddress()) && !isAdmin(cookies)) error(403, 'Only the dashboard screen can do that');
	const body = await request.json().catch(() => null);
	if (body?.stop === true) {
		stopSpeaking();
		return json({ ok: true });
	}
	if (!voiceOn()) error(404, 'The voice is off');
	const text = typeof body?.text === 'string' ? body.text : '';
	if (!isBriefingText(text) && !maySay(text) && !isCardText(text)) error(400, 'Nothing to read');
	if (speaking() === text) {
		stopSpeaking(); // a second tap stops it
		return json({ ok: true, stopped: true });
	}
	stopSpeaking();
	try {
		await say(text);
		return json({ ok: true });
	} catch (err) {
		console.warn(`[voice] ${err}`);
		error(502, 'The voice could not speak');
	}
}
