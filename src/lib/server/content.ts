/**
 * Fresh quotes and facts from the internet, held for a grown-up to vet
 * (see src/lib/utils/content.ts). Kept in data/content.json (git-ignored):
 *   pending  candidates waiting for Keep / Skip
 *   kept     approved ones, shown alongside the built-in lists
 *   seen     ids already offered, so nothing comes back after a Skip
 * New candidates are fetched at most once a day (or on "Get more").
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	cleanText,
	contentId,
	kidSafe,
	type Candidate,
	type ContentKind,
	type KeptContent
} from '#lib/utils/content';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'content.json');
const ZENQUOTES = process.env.ZENQUOTES_URL ?? 'https://zenquotes.io/api/quotes';
const USELESS_FACTS = process.env.FACTS_URL ?? 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
const PER_FETCH = 6; // new candidates of each kind per fetch
const MAX_PENDING = 20; // per kind
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
			kept: { quotes: s.kept?.quotes ?? [], facts: s.kept?.facts ?? [] },
			seen: Array.isArray(s.seen) ? s.seen : []
		};
	} catch {
		return { lastFetch: 0, pending: [], kept: { quotes: [], facts: [] }, seen: [] };
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
		headers: { 'user-agent': 'kids-smart-display (https://github.com/ksawant17/kids-smart-display)' }
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

let inflight: Promise<void> | null = null;

/** Fetch new candidates now (both kinds); errors are logged, never thrown. */
export function refill(): Promise<void> {
	inflight ??= (async () => {
		const s = load();
		const known = new Set([...s.seen, ...s.pending.map((p) => p.id)]);
		for (const [kind, fetcher] of [
			['quote', fetchQuotes],
			['fact', fetchFacts]
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
		const sticker = emoji ?? (c.kind === 'quote' ? '1f31f' : '1f4a1');
		if (c.kind === 'quote') s.kept.quotes.push({ id, text: c.text, author: c.author ?? 'Unknown', emoji: sticker, source: c.source });
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
	save(s);
	return getContent();
}

export type { ContentKind };
