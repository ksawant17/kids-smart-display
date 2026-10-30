/**
 * Which card texts may be read aloud (POST /api/speak): everything the
 * cards can show, read the way utils/readAloud.ts reads it. Built from the
 * same lists the pages use: the built-in ones plus what a grown-up kept.
 */
import quotes from '#lib/data/quotes.json';
import facts from '#lib/data/facts.json';
import jokes from '#lib/data/jokes.json';
import words from '#lib/data/words.json';
import dinos from '#lib/data/dinos.json';
import { getKept } from '#lib/server/content';
import { dinoSpeech, factSpeech, jokeSpeech, quoteSpeech, wordSpeech } from '#lib/utils/readAloud';

let cached: { kept: string; texts: Set<string> } | null = null;

function texts(): Set<string> {
	const kept = getKept();
	const key = JSON.stringify(kept);
	if (cached?.kept === key) return cached.texts;
	const all = new Set<string>();
	for (const q of [...quotes, ...kept.quotes]) all.add(quoteSpeech(q));
	for (const f of [...facts, ...kept.facts]) all.add(factSpeech(f));
	for (const j of [...jokes, ...kept.jokes]) all.add(jokeSpeech(j, false)).add(jokeSpeech(j, true));
	for (const w of [...words, ...kept.words]) all.add(wordSpeech(w));
	for (const d of dinos) all.add(dinoSpeech(d));
	cached = { kept: key, texts: all };
	return all;
}

/** Is this one of the cards' texts? */
export const isCardText = (text: string) => texts().has(text);
