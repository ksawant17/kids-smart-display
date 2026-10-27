/**
 * Fresh quotes and facts from the internet, held for a grown-up to vet
 * (see src/lib/utils/content.ts). Kept in data/content.json (git-ignored):
 *   pending  candidates waiting for Keep / Skip
 *   kept     approved ones, shown alongside the built-in lists
 *   seen     ids already offered, so nothing comes back after a Skip
 * New candidates are fetched at most once a day (or on "Get more").
 * Sources: ZenQuotes (quotes), Useless Facts (facts), JokeAPI and
 * icanhazdadjoke (jokes), and the AI helper when it's on (jokes, facts and
 * words; see server/ai.ts).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { KID_VOICE, aiOn, chat, parseJson } from '#lib/server/ai';
import {
	DEFAULT_STICKER,
	cleanText,
	contentId,
	kidSafe,
	splitJoke,
	wordSafe,
	type Candidate,
	type ContentKind,
	type KeptContent
} from '#lib/utils/content';
import builtinFacts from '#lib/data/facts.json';
import builtinJokes from '#lib/data/jokes.json';
import builtinWords from '#lib/data/words.json';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'content.json');
const ZENQUOTES = process.env.ZENQUOTES_URL ?? 'https://zenquotes.io/api/quotes';
const USELESS_FACTS = process.env.FACTS_URL ?? 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
// JokeAPI's "safe mode", two-part jokes only, every flag that could be iffy
const JOKEAPI =
	process.env.JOKEAPI_URL ??
	'https://v2.jokeapi.dev/joke/Pun,Misc?safe-mode&type=twopart&blacklistFlags=nsfw,religious,political,racist,sexist,explicit&amount=10';
const DADJOKES = process.env.DADJOKES_URL ?? 'https://icanhazdadjoke.com/search?limit=30';
const PER_FETCH = 6; // new candidates of each kind per fetch
const MAX_PENDING = 30; // per kind: about a month of new ones
const DAY_MS = 24 * 3600_000;

interface Store {
	lastFetch: number;
	pending: Candidate[];
	kept: KeptContent;
	seen: string[];
}

function load(): Store {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		return {
			lastFetch: Number(s.lastFetch) || 0,
			pending: Array.isArray(s.pending) ? s.pending : [],
			kept: {
				quotes: s.kept?.quotes ?? [],
				facts: s.kept?.facts ?? [],
				jokes: s.kept?.jokes ?? [],
				words: s.kept?.words ?? []
			},
			seen: Array.isArray(s.seen) ? s.seen : []
		};
	} catch {
		return { lastFetch: 0, pending: [], kept: { quotes: [], facts: [], jokes: [], words: [] }, seen: [] };
	}
}

function save(s: Store) {
	s.seen = s.seen.slice(-3000);
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify(s, null, '\t') + '\n');
	renameSync(`${FILE}.tmp`, FILE);
}

async function getJson(url: string): Promise<unknown> {
	const res = await fetch(url, {
		signal: AbortSignal.timeout(10_000),
		headers: {
			accept: 'application/json',
			'user-agent': 'kids-smart-display (https://github.com/ksawant17/kids-smart-display)'
		}
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
}

async function fetchQuotes(): Promise<Candidate[]> {
	const list = (await getJson(ZENQUOTES)) as { q?: string; a?: string }[];
	return (Array.isArray(list) ? list : [])
		.filter((x) => typeof x.q === 'string' && typeof x.a === 'string' && x.a !== 'zenquotes.io')
		.map((x) => ({ text: cleanText(x.q!), author: cleanText(x.a!) }))
		.filter((x) => kidSafe(x.text, 'quote', x.author))
		.map((x) => ({ id: contentId('quote', x.text), kind: 'quote' as const, ...x, source: 'zenquotes' }));
}

async function fetchJokes(): Promise<Candidate[]> {
	const pairs: { q: string; a: string; source: string }[] = [];
	try {
		const r = (await getJson(JOKEAPI)) as { jokes?: { setup?: string; delivery?: string }[] };
		for (const j of r.jokes ?? [])
			if (typeof j.setup === 'string' && typeof j.delivery === 'string')
				pairs.push({ q: j.setup, a: j.delivery, source: 'jokeapi' });
	} catch (err) {
		console.warn(`[content] JokeAPI: ${err}`);
	}
	try {
		// a random page of dad jokes; only the question-and-answer ones fit the joke corner
		const page = 1 + Math.floor(Math.random() * 25);
		const r = (await getJson(`${DADJOKES}&page=${page}`)) as { results?: { joke?: string }[] };
		for (const j of r.results ?? []) {
			const qa = typeof j.joke === 'string' ? splitJoke(j.joke) : null;
			if (qa) pairs.push({ ...qa, source: 'icanhazdadjoke' });
		}
	} catch (err) {
		console.warn(`[content] icanhazdadjoke: ${err}`);
	}
	if (!pairs.length) throw new Error('no joke source answered');
	return pairs
		// check the raw text first: tidying would hide line breaks the filter looks for
		.filter((p) => kidSafe(p.q, 'joke', p.a))
		.map((p) => ({ ...p, q: cleanText(p.q), a: cleanText(p.a) }))
		.filter((p) => kidSafe(p.q, 'joke', p.a))
		.sort(() => Math.random() - 0.5)
		.map((p) => ({ id: contentId('joke', p.q), kind: 'joke' as const, text: p.q, answer: p.a, source: p.source }));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchFacts(): Promise<Candidate[]> {
	const out: Candidate[] = [];
	let failures = 0;
	// one fact per request, politely spaced; a hiccup skips one, not the batch
	for (let i = 0; i < PER_FETCH * 3 && out.length < PER_FETCH * 2 && failures < 4; i++) {
		if (i) await pause(Number(process.env.FACTS_PAUSE_MS ?? 400));
		try {
			const f = (await getJson(USELESS_FACTS)) as { text?: string };
			if (typeof f.text !== 'string') continue;
			const text = cleanText(f.text);
			if (kidSafe(text, 'fact')) out.push({ id: contentId('fact', text), kind: 'fact', text, source: 'uselessfacts' });
		} catch (err) {
			if (++failures >= 4 && !out.length) throw err;
		}
	}
	return out;
}

/* ---- the AI helper writes jokes, facts and words (server/ai.ts) ---- */

// a different topic each time, so the AI doesn't keep telling the same few
const TOPICS = [
	'animals', 'the ocean', 'space', 'dinosaurs', 'food', 'weather', 'bugs', 'birds', 'the human body', 'plants',
	'music', 'sports', 'school', 'trains and planes', 'India', 'the seasons', 'colors', 'numbers', 'castles', 'the farm'
];
const pickTopic = () => TOPICS[Math.floor(Math.random() * TOPICS.length)];

// the built-in lists, so the AI's offers are new ones
const BUILTIN = new Set([
	...builtinFacts.map((f) => contentId('fact', f.text)),
	...builtinJokes.map((j) => contentId('joke', j.q)),
	...builtinWords.map((w) => contentId('word', w.word))
]);

const ASK: Record<'joke' | 'fact' | 'word', (topic: string) => string> = {
	joke: (t) =>
		`Write 8 different kid-friendly question-and-answer jokes about ${t} (puns are great). ` +
		'Answer with JSON only: [{"q": "question?", "a": "punchline"}]',
	fact: (t) =>
		`Write 8 different true, surprising facts about ${t} that a 7-year-old would love, ` +
		'each one sentence of at most 140 characters. Only facts you are sure are true. ' +
		'Answer with JSON only: ["fact", ...]',
	word: (t) =>
		`Pick 8 different interesting words connected to ${t}, one word each, a step up from everyday words ` +
		'for ages 6 to 10 (like "enormous", "curious", "glimmer"). ' +
		'For each give how to say it (like "ih-NOR-mus"), a short meaning a kid understands, and a short example sentence. ' +
		'Answer with JSON only: [{"word": "...", "say": "...", "meaning": "...", "sentence": "..."}]'
};

async function aiCandidates(kind: 'joke' | 'fact' | 'word'): Promise<Candidate[]> {
	const reply = await chat(
		[
			{ role: 'system', content: KID_VOICE },
			{ role: 'user', content: ASK[kind](pickTopic()) }
		],
		{ maxTokens: 900, temperature: 1, timeoutMs: 90_000 }
	);
	const list = parseJson<unknown[]>(reply);
	if (!Array.isArray(list)) throw new Error('not a list');
	const out: Candidate[] = [];
	for (const x of list) {
		const o = (x ?? {}) as Record<string, unknown>;
		const str = (v: unknown) => (typeof v === 'string' ? cleanText(v) : '');
		if (kind === 'fact') {
			const text = str(x);
			if (kidSafe(text, 'fact')) out.push({ id: contentId('fact', text), kind, text, source: 'ai' });
		} else if (kind === 'joke') {
			const q = str(o.q);
			const a = str(o.a);
			if (kidSafe(q, 'joke', a)) out.push({ id: contentId('joke', q), kind, text: q, answer: a, source: 'ai' });
		} else {
			const word = str(o.word).toLowerCase();
			const [say, meaning, sentence] = [str(o.say), str(o.meaning), str(o.sentence)];
			if (wordSafe(word, say, meaning, sentence))
				out.push({ id: contentId('word', word), kind, text: word, answer: meaning, say, sentence, source: 'ai' });
		}
	}
	return out.filter((c) => !BUILTIN.has(c.id));
}

let inflight: Promise<void> | null = null;

/** Fetch new candidates now (every kind); errors are logged, never thrown. */
export function refill(): Promise<void> {
	inflight ??= (async () => {
		const s = load();
		const known = new Set([...s.seen, ...s.pending.map((p) => p.id)]);
		const ai = aiOn('content');
		for (const [kind, fetcher] of [
			['quote', fetchQuotes],
			['fact', fetchFacts],
			['joke', fetchJokes],
			...(ai
				? ([
						['joke', () => aiCandidates('joke')],
						['fact', () => aiCandidates('fact')],
						['word', () => aiCandidates('word')]
					] as const)
				: [])
		] as const) {
			try {
				let room = Math.min(PER_FETCH, MAX_PENDING - s.pending.filter((p) => p.kind === kind).length);
				for (const c of await fetcher()) {
					if (room <= 0) break;
					if (known.has(c.id)) continue; // already offered, or a repeat in this batch
					known.add(c.id);
					s.pending.push(c);
					room--;
				}
			} catch (err) {
				console.warn(`[content] fetching ${kind}s failed: ${err}`);
			}
		}
		s.lastFetch = Date.now();
		save(s);
	})().finally(() => (inflight = null));
	return inflight;
}

/** Called on page loads: fetch in the background once a day. */
export function refillIfDue() {
	if (Date.now() - load().lastFetch > DAY_MS) refill();
}

export function getKept(): KeptContent {
	return load().kept;
}

export function getContent() {
	const s = load();
	return { pending: s.pending, kept: s.kept, lastFetch: s.lastFetch };
}

export const pendingCount = () => load().pending.length;

/** Keep a candidate (with its sticker) or skip it. */
export function decide(id: string, keep: boolean, emoji?: string) {
	const s = load();
	const c = s.pending.find((p) => p.id === id);
	if (!c) return getContent();
	s.pending = s.pending.filter((p) => p.id !== id);
	s.seen.push(id);
	if (keep) {
		const sticker = emoji ?? DEFAULT_STICKER[c.kind];
		if (c.kind === 'quote') s.kept.quotes.push({ id, text: c.text, author: c.author ?? 'Unknown', emoji: sticker, source: c.source });
		else if (c.kind === 'joke') s.kept.jokes.push({ id, q: c.text, a: c.answer ?? '', emoji: sticker, source: c.source });
		else if (c.kind === 'word')
			s.kept.words.push({
				id,
				word: c.text,
				say: c.say ?? '',
				emoji: sticker,
				meaning: c.answer ?? '',
				sentence: c.sentence ?? '',
				source: c.source
			});
		else s.kept.facts.push({ id, text: c.text, emoji: [sticker], source: c.source });
	}
	save(s);
	return getContent();
}

/** Take a kept one off the screen again (it won't be offered again). */
export function removeKept(id: string) {
	const s = load();
	s.kept.quotes = s.kept.quotes.filter((q) => q.id !== id);
	s.kept.facts = s.kept.facts.filter((f) => f.id !== id);
	s.kept.jokes = s.kept.jokes.filter((j) => j.id !== id);
	s.kept.words = s.kept.words.filter((w) => w.id !== id);
	save(s);
	return getContent();
}

export type { ContentKind };
