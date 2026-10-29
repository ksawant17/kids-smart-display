/**
 * Fresh quotes and fun facts from the internet, vetted by a grown-up.
 *
 * The Pi fetches candidates every day (ZenQuotes for quotes, Useless Facts
 * for facts, JokeAPI and icanhazdadjoke for jokes; see
 * src/lib/server/content.ts), and the AI helper, when it is on, writes
 * jokes, facts and words too. None of it is vetted for
 * kids, so candidates first go through `kidSafe()` (length + blocked words),
 * then wait in the Grown-ups tab ("New Content") until someone taps Keep or
 * Skip. Only kept ones are shown, mixed in with the built-in lists.
 */

export type ContentKind = 'quote' | 'fact' | 'joke' | 'word';

export interface Candidate {
	id: string;
	kind: ContentKind;
	text: string;
	/** quotes only */
	author?: string;
	/** jokes: the punchline (`text` is the question); words: the meaning (`text` is the word) */
	answer?: string;
	/** words only: how to say it, and the word in a sentence */
	say?: string;
	sentence?: string;
	/** "zenquotes" | "uselessfacts" | "jokeapi" | "icanhazdadjoke" | "ai" */
	source: string;
}

/** same shapes as src/lib/data/quotes.json and facts.json */
export interface KeptQuote {
	id: string;
	text: string;
	author: string;
	emoji: string;
	source: string;
}
export interface KeptFact {
	id: string;
	text: string;
	emoji: string[];
	source: string;
}

/** same shape as src/lib/data/jokes.json */
export interface KeptJoke {
	id: string;
	q: string;
	a: string;
	emoji: string;
	source: string;
}

/** same shape as src/lib/data/words.json */
export interface KeptWord {
	id: string;
	word: string;
	say: string;
	emoji: string;
	meaning: string;
	sentence: string;
	source: string;
}

export interface KeptContent {
	quotes: KeptQuote[];
	facts: KeptFact[];
	jokes: KeptJoke[];
	words: KeptWord[];
}

/** longest text that still fits the TODAY banner / FUN card nicely (words: the meaning) */
export const MAX_LENGTH = { quote: 120, fact: 150, joke: 100, word: 80 } as const;

// Topics a kids' screen shouldn't raise on its own. Deliberately broad: a
// false alarm only costs one candidate, and a grown-up still checks the rest.
const BLOCKED = new RegExp(
	'\\b(' +
		[
			'kill\\w*', 'perish\\w*', 'sperm\\w*', 'semen', 'pregnan\\w*', 'injur\\w*', 'die', 'died', 'dies', 'dying', 'dead\\w*', 'death\\w*', 'murder\\w*', 'suicid\\w*', 'war', 'wars',
			'weapon\\w*', 'guns?', 'bombs?', 'blood\\w*', 'sex\\w*', 'naked', 'nude', 'drugs?', 'alcohol\\w*', 'beers?',
			'wine', 'vodka', 'whisk(e)?y', 'drunk\\w*', 'cigar\\w*', 'smok\\w*', 'gambl\\w*', 'casino\\w*', 'poison\\w*',
			'inject\\w*', 'intravenous\\w*', 'gods?', 'jesus', 'christ\\w*', 'relig\\w*', 'satan', 'devil', 'hell', 'damn\\w*',
			'enem(y|ies)', 'hate\\w*', 'divorc\\w*', 'prison\\w*', 'crim(e|es|inal\\w*)', 'police', 'rape\\w*', 'abort\\w*',
			'porn\\w*', 'breasts?', 'penis\\w*', 'vagina\\w*', 'eskimos?', 'slave\\w*', 'terror\\w*', 'corpse\\w*',
			'cancer', 'disease\\w*', 'illness\\w*', 'pain\\w*', 'suffer\\w*', 'curse\\w*', 'salvation', 'sin', 'sins',
			'lust', 'seduc\\w*', 'kiss\\w*', 'lover\\w*', 'affair\\w*', 'mistress\\w*', 'stupid\\w*', 'idiot\\w*',
			'fools?', 'ugly', 'fat', 'shit\\w*', 'fuck\\w*', 'ass', 'bitch\\w*', 'bastard\\w*', 'crap\\w*', 'urin\\w*',
			'feces', 'vomit\\w*', 'toilet\\w*', 'nazi\\w*', 'hitler', 'genghis', 'stalin', 'mao'
		].join('|') +
		')\\b',
	'i'
);

// grown-up life a kids' joke shouldn't be about
const GROWN_UP = /\b(boss|wife|husband|diet|tax(es)?|mortgage|office|coworkers?|developers?|programmers?|code|coding|syndrome|bar|bartender|dating|girlfriend|boyfriend|marri\w*|lawyers?|bank)\b/i;

/**
 * Plain text a 6-year-old's screen can show: short, no blocked topics.
 * `extra` is the author (quotes) or the punchline (jokes, which also must
 * stay off grown-up life).
 */
export function kidSafe(text: string, kind: ContentKind, extra = ''): boolean {
	const t = text.trim();
	if (t.length < (kind === 'joke' ? 8 : 15) || t.length > MAX_LENGTH[kind]) return false;
	if (kind === 'joke' && (extra.length < 2 || extra.length > MAX_LENGTH.joke || /\n/.test(extra))) return false;
	if (/https?:|www\.|[<>{}]|@/.test(t + extra)) return false;
	if (kind === 'joke' && GROWN_UP.test(t + ' ' + extra)) return false;
	return !BLOCKED.test(t) && !BLOCKED.test(extra);
}

/** A word of the day: one plain word, a short meaning and sentence, nothing blocked. */
export function wordSafe(word: string, say: string, meaning: string, sentence: string): boolean {
	if (!/^[a-z][a-z-]{2,17}$/i.test(word) || say.length < 2 || say.length > 30) return false;
	if (meaning.length < 5 || meaning.length > MAX_LENGTH.word || sentence.length < 10 || sentence.length > 110) return false;
	const all = [word, say, meaning, sentence].join(' ');
	return !/https?:|www\.|[<>{}]|@/.test(all) && !BLOCKED.test(all) && !GROWN_UP.test(all);
}

/** Any topic from the blocked list? (for longer AI-written text: stories, the briefing) */
export const hasBlockedWords = (text: string) => BLOCKED.test(text);

/** "What do you call a sleeping bull? A bulldozer!" -> question + answer (null if it isn't one) */
export function splitJoke(joke: string): { q: string; a: string } | null {
	const m = joke.trim().match(/^(.{8,}?\?)\s+(.{2,})$/s);
	return m ? { q: m[1].trim(), a: m[2].replace(/\s+/g, ' ').trim() } : null;
}

/** tidy a fetched text: straight quotes, single spaces, backticks as apostrophes */
export function cleanText(text: string): string {
	return text
		.replace(/[`´’]/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/** stable id for a text, so the same quote is never offered twice */
export function contentId(kind: ContentKind, text: string): string {
	let h = 2166136261;
	const s = `${kind}:${text.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return (h >>> 0).toString(16);
}

const STICKERS: [RegExp, string][] = [
	[/\bants?\b/, '1f41c'],
	[/\bbees?\b|\bhoney\b/, '1f41d'],
	[/\bfish\w*\b/, '1f41f'],
	[/\bocean\w*\b|\bseas?\b|\bwaves?\b/, '1f30a'],
	[/\bwhales?\b/, '1f433'],
	[/\bcats?\b/, '1f431'],
	[/\bdogs?\b/, '1f436'],
	[/\bbirds?\b|\bfly\b|\bwings?\b/, '1f426'],
	[/\bspiders?\b/, '1f577'],
	[/\bsnakes?\b/, '1f40d'],
	[/\bdinosaurs?\b|\bt\. ?rex\b/, '1f996'],
	[/\bmoon\w*\b/, '1f319'],
	[/\bstars?\b|\bspace\b|\bplanets?\b/, '1fa90'],
	[/\bsun\w*\b/, '1f31e'],
	[/\bsnow\w*\b|\bice\b|\bcold\b/, '2744'],
	[/\brain\w*\b|\bwater\b/, '1f4a7'],
	[/\btrees?\b|\bforest\w*\b/, '1f333'],
	[/\bflowers?\b|\bgarden\w*\b/, '1f33c'],
	[/\bmountain\w*\b|\bclimb\w*\b/, '26f0'],
	[/\bbooks?\b|\bread\w*\b|\bwords?\b/, '1f4da'],
	[/\bmusic\b|\bsing\w*\b|\bsongs?\b/, '1f3b5'],
	[/\bfriend\w*\b|\btogether\b/, '1f91d'],
	[/\blove\w*\b|\bkind\w*\b|\bheart\w*\b/, '2764'],
	[/\bdream\w*\b|\bimagin\w*\b/, '1f4ad'],
	[/\bbrain\w*\b|\bthink\w*\b|\blearn\w*\b|\bmind\b/, '1f9e0'],
	[/\bsmil\w*\b|\bhapp\w*\b|\blaugh\w*\b/, '1f60a'],
	[/\bpath\b|\bwalk\w*\b|\bjourney\b|\bsteps?\b/, '1f463'],
	[/\bcourag\w*\b|\bbrave\w*\b|\bstrong\b|\bstrength\b/, '1f4aa'],
	[/\bfood\b|\beat\w*\b|\bapple\w*\b/, '1f34e'],
	[/\bcars?\b|\btrain\w*\b|\bplanes?\b|\bairplane\w*\b/, '2708'],
	[/\bmoney\b|\bdollars?\b|\bcoins?\b/, '1fa99'],
	[/\bbody\b|\bbones?\b/, '1f9b4']
];

export const DEFAULT_STICKER: Record<ContentKind, string> = { quote: '1f31f', fact: '1f4a1', joke: '1f602', word: '1f4da' };

/** a sticker that matches the text (grown-ups can pick another) */
export function suggestEmoji(text: string, kind: ContentKind): string {
	const t = text.toLowerCase();
	return STICKERS.find(([re]) => re.test(t))?.[1] ?? DEFAULT_STICKER[kind];
}

/** stickers offered when keeping something */
export const STICKER_CHOICES = ['1f31f', '1f4a1', '1f602', '2b50', '1f60a', '2764', '1f4aa', '1f9e0', '1f30d', '1f43e', '1f680'];
