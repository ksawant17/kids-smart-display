import { json, error } from '@sveltejs/kit';
import { aiOn } from '#lib/server/ai';
import { isAdmin, isLocal } from '#lib/server/admin';
import { ASK_A_GROWN_UP, answer, readQuestion } from '#lib/server/ask';
import { readFacts } from '#lib/server/briefing';
import { getConfig } from '#lib/server/config';
import { allowSpeech, listen, micOn, stopListening } from '#lib/server/voice';

/**
 * 🎤 Ask, in two steps so the kiosk can show what's happening:
 *   POST /api/ask { action: "listen" }   records one question -> { question } ('' = heard nothing)
 *   POST /api/ask { action: "stop" }     "I'm done": ends the recording now
 *   POST /api/ask { action: "answer", question, facts? } -> { answer } (then /api/speak reads it)
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
				return json({ question: readQuestion(await listen(hint)) });
			} catch (err) {
				console.warn(`[ask] ${err}`);
				error(502, 'The microphone could not listen');
			}
		case 'stop':
			stopListening();
			return json({ ok: true });
		case 'answer': {
			const question = readQuestion(body.question);
			if (!question) error(400, 'No question');
			try {
				const text = (await answer(question, readFacts(body.facts))) ?? ASK_A_GROWN_UP;
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
