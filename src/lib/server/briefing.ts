/**
 * The day's briefing for TODAY: the kiosk sends the facts it already shows
 * (weather, school, what to wear, a grown-up's note, a festival) and the AI
 * turns them into two friendly sentences. The same facts give the same
 * briefing, so it is only rewritten when something on screen changes.
 */
import { KID_VOICE, aiTextOk, chat } from '#lib/server/ai';
import { getConfig } from '#lib/server/config';

export interface BriefingFacts {
	/** "today" in the morning, "tomorrow" from the evening switch on */
	when: 'today' | 'tomorrow';
	dayName: string;
	weather: string;
	school: string;
	wear: string;
	note?: string;
	festival?: string;
}

const MAX_LEN = 170;
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const field = (v: unknown, max = 160) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** the facts from a request body, tidied (null if they don't look right) */
export function readFacts(body: unknown): BriefingFacts | null {
	const b = (body ?? {}) as Record<string, unknown>;
	const when = b.when === 'tomorrow' ? 'tomorrow' : b.when === 'today' ? 'today' : null;
	const facts = {
		when,
		dayName: field(b.dayName, 40),
		weather: field(b.weather),
		school: field(b.school),
		wear: field(b.wear),
		note: field(b.note) || undefined,
		festival: field(b.festival, 60) || undefined
	};
	return when && facts.weather ? (facts as BriefingFacts) : null;
}

function prompt(f: BriefingFacts): string {
	const kids = getConfig().kids.map((k) => k.name);
	const lines = [
		`Write the ${f.when === 'today' ? 'morning' : 'evening'} briefing for ${kids.join(' and ')} about ${f.when} (${f.dayName}).`,
		`Weather: ${f.weather}`,
		`School: ${f.school}`,
		`What to wear: ${f.wear}`,
		f.note ? `Note from a grown-up: ${f.note}` : null,
		f.festival ? `Festival: ${f.festival}` : null,
		'',
		`Two short sentences, ${MAX_LEN} characters at most in total. ` +
			'Lead with the most useful thing (the weather and what to wear, or a note). ' +
			'Only use the facts above; do not invent plans or events. ' +
			"Use only plain text: no emoji, no lists, no quotes. Don't start with the date."
	];
	return lines.filter((l) => l !== null).join('\n');
}

async function write(f: BriefingFacts): Promise<string | null> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const text = (await chat(
			[
				{ role: 'system', content: KID_VOICE },
				{ role: 'user', content: prompt(f) }
			],
			{ maxTokens: 120, temperature: 0.7, timeoutMs: 30_000 }
		))
			.replace(/^["“]|["”]$/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		if (text.length <= MAX_LEN + 40 && aiTextOk(text)) return text;
	}
	return null;
}

/** Did the briefing say exactly this? (only its own words may be read aloud) */
export const isBriefingText = (text: string) => !!text && [...cache.values()].includes(text);

/** The briefing for these facts (cached), or null if the AI couldn't write a good one. */
export function briefing(f: BriefingFacts): Promise<string | null> {
	const key = JSON.stringify(f);
	const hit = cache.get(key);
	if (hit) return Promise.resolve(hit);
	let p = inflight.get(key);
	if (!p) {
		p = write(f)
			.then((text) => {
				if (text) {
					cache.set(key, text);
					// a day's worth of versions is plenty
					if (cache.size > 30) cache.delete(cache.keys().next().value!);
				}
				return text;
			})
			.finally(() => inflight.delete(key));
		inflight.set(key, p);
	}
	return p;
}
