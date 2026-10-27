import { json, error } from '@sveltejs/kit';
import { aiOn } from '#lib/server/ai';
import { briefing, readFacts } from '#lib/server/briefing';

/**
 * POST /api/briefing { when, dayName, weather, school, wear, note?, festival? }
 *   -> { text } (text is null when the AI is off, unreachable or wrote something unsuitable)
 */
export async function POST({ request }) {
	if (!aiOn('briefing')) return json({ text: null });
	const facts = readFacts(await request.json().catch(() => null));
	if (!facts) error(400, 'bad facts');
	try {
		return json({ text: await briefing(facts) });
	} catch (err) {
		console.warn(`[briefing] ${err}`);
		return json({ text: null });
	}
}
