/**
 * Bedtime stories for FUN: the kid picks a hero, a place and what the story
 * is about (from fixed lists, see utils/story.ts) and the AI writes a short
 * gentle story. Nothing a kid types is sent anywhere.
 */
import { KID_VOICE, aiTextOk, chat, parseJson } from '#lib/server/ai';
import { STORY_PLACES, STORY_THEMES } from '#lib/utils/story';

export interface Story {
	title: string;
	paragraphs: string[];
}

export async function writeStory(hero: string, place: string, theme: string): Promise<Story | null> {
	const where = STORY_PLACES.find((p) => p.id === place)?.say ?? place;
	const about = STORY_THEMES.find((t) => t.id === theme)?.say ?? theme;
	const ask =
		`Write a short, calm bedtime story starring ${hero}, set ${where}, about ${about}. ` +
		'4 short paragraphs, about 180 words in all, ending sleepy and happy. ' +
		'Answer with JSON only: {"title": "...", "paragraphs": ["...", "..."]}';
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const s = parseJson<Story>(
				await chat(
					[
						{ role: 'system', content: KID_VOICE },
						{ role: 'user', content: ask }
					],
					{ maxTokens: 700, temperature: 0.9, timeoutMs: 60_000 }
				)
			);
			const title = typeof s.title === 'string' ? s.title.trim().slice(0, 60) : '';
			const paragraphs = Array.isArray(s.paragraphs)
				? s.paragraphs.filter((p): p is string => typeof p === 'string' && !!p.trim()).map((p) => p.trim())
				: [];
			if (title && paragraphs.length >= 2 && paragraphs.length <= 8 && aiTextOk([title, ...paragraphs].join(' ')))
				return { title, paragraphs };
		} catch (err) {
			if (attempt) throw err;
		}
	}
	return null;
}
