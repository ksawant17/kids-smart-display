import { json, error } from '@sveltejs/kit';
import { aiOn } from '#lib/server/ai';
import { isAdmin, isLocal } from '#lib/server/admin';
import { ASK_A_GROWN_UP, answer, newConversation, readQuestion, readWeatherNow, reminderAnswer } from '#lib/server/ask';
import { readFacts } from '#lib/server/briefing';
import { getConfig } from '#lib/server/config';
import { allowSpeech, listen, micOn, stopListening } from '#lib/server/voice';

/**
 * 🎤 Ask, in two steps so the kiosk can show what's happening:
 *   POST /api/ask { action: "listen", hold?, id? }  records one question -> { question } ('' = heard nothing)
 *     hold: the kid holds the 🎤 button while talking; letting go sends "stop" with the same id
 *   POST /api/ask { action: "stop", id? }  ends the recording now
 *   POST /api/ask { action: "answer", question, facts?, weatherNow?, fresh? } -> { answer, undo? } (then /api/speak reads it)
 *     a timer or reminder is set (or listed, cancelled) instead of answered; undo: its id
 *     weatherNow: the temperature and sky right now, as on screen (facts has the day's high and low)
 *     fresh: the first question since the sheet opened (forget the last conversation)
 * Only the kiosk itself (or an unlocked Grown-ups tab) may use the mic.
 */
export async function POST({ request, cookies, getClientAddress }) {
	if (!isLocal(getClientAddress()) && !isAdmin(cookies)) error(403, 'Only the dashboard screen can do that');
	if (!aiOn('ask') || !micOn()) error(404, 'Asking is switched off');
	const body = await request.json().catch(() => null);
	switch (body?.action) {
		case 'listen':
			try {
				const hint = getConfig().kids.map((k) => k.name).join(', ');
				const id = typeof body.id === 'string' ? body.id.slice(0, 40) : '';
				return json({ question: readQuestion(await listen(hint, { hold: body.hold === true, id })) });
			} catch (err) {
				console.warn(`[ask] ${err}`);
				error(502, 'The microphone could not listen');
			}
		case 'stop':
			stopListening(typeof body.id === 'string' ? body.id.slice(0, 40) : '');
			return json({ ok: true });
		case 'answer': {
			const question = readQuestion(body.question);
			if (!question) error(400, 'No question');
			if (body.fresh === true) newConversation();
			try {
				const set = await reminderAnswer(question);
				if (set) {
					allowSpeech(set.answer);
					return json(set);
				}
				const text = (await answer(question, readFacts(body.facts), readWeatherNow(body.weatherNow))) ?? ASK_A_GROWN_UP;
				allowSpeech(text);
				return json({ answer: text });
			} catch (err) {
				console.warn(`[ask] ${err}`);
				error(502, 'The AI helper did not answer');
			}
		}
	}
	error(400, 'Unknown action');
}
