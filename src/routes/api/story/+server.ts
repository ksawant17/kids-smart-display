import { json, error } from '@sveltejs/kit';
import { aiOn } from '#lib/server/ai';
import { getConfig } from '#lib/server/config';
import { writeStory } from '#lib/server/story';
import { allowSpeech } from '#lib/server/voice';
import { storySpeech } from '#lib/utils/readAloud';
import { isStoryPlace, isStoryTheme } from '#lib/utils/story';

/** POST /api/story { kid: <index in config.kids>, place, theme } -> { title, paragraphs } (and 🔊 may read it) */
export async function POST({ request }) {
	if (!aiOn('stories')) error(404, 'Stories are switched off');
	const body = await request.json().catch(() => null);
	const kid = getConfig().kids[Number(body?.kid)];
	if (!kid || !isStoryPlace(body.place) || !isStoryTheme(body.theme)) error(400, 'bad story choices');
	try {
		const story = await writeStory(kid.name, body.place, body.theme);
		if (!story) error(502, "The story didn't come out right. Try again!");
		allowSpeech(storySpeech(story));
		return json(story);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.warn(`[story] ${err}`);
		error(502, "The storyteller isn't answering right now");
	}
}
