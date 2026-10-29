/**
 * 🎤 Ask: a kid's spoken question (already turned into text on the Pi, see
 * voice.ts) answered by the AI helper in a few short, kind sentences. The
 * kiosk sends the facts it shows (weather, school, what to wear: the same as
 * the briefing) so "Do I need a jacket?" gets a real answer.
 *
 * Questions about grown-up topics (the blocked-words list) don't go to the
 * AI at all: the kid is pointed to a grown-up instead.
 */
import { KID_VOICE, aiTextOk, chat, type ChatMessage } from '#lib/server/ai';
import { getConfig } from '#lib/server/config';
import type { BriefingFacts } from '#lib/server/briefing';
import { hasBlockedWords } from '#lib/utils/content';
import { withoutEmoji } from '#lib/utils/speech';

export const ASK_A_GROWN_UP = "That's a great one to ask a grown-up! They'll know just what to say.";
const MAX_LEN = 360;
const MAX_QUESTION = 200;

/**
 * The conversation so far, so a follow-up ("why?", "what about tomorrow?")
 * makes sense. One kiosk, one conversation: it starts again when the 🎤
 * sheet is opened, or after a few quiet minutes (another kid walking up).
 */
const MAX_TURNS = 8; // questions + answers kept; older ones drop off
const FORGET_MS = 5 * 60_000;
let talk: { turns: ChatMessage[]; at: number } = { turns: [], at: 0 };

/** a new conversation (the 🎤 sheet was just opened) */
export function newConversation() {
	talk = { turns: [], at: 0 };
}

function remembered(now: number): ChatMessage[] {
	if (now - talk.at > FORGET_MS) talk.turns = [];
	return talk.turns;
}

function remember(question: string, reply: string, now: number) {
	talk.turns = [...talk.turns, { role: 'user' as const, content: question }, { role: 'assistant' as const, content: reply }].slice(
		-MAX_TURNS * 2
	);
	talk.at = now;
}

export interface Answer {
	question: string;
	answer: string;
}

/** the question as heard, tidied ('' when there's nothing to answer) */
export function readQuestion(v: unknown): string {
	if (typeof v !== 'string') return '';
	const q = v.replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
	// whisper hears these in silence or noise
	return /^[\s.,!?-]*$|^(thank you|thanks for watching|you)[.!]?$/i.test(q) ? '' : q;
}

/** the weather right now as the screen shows it, e.g. "69°F, feels like 67°F, sunny" */
export function readWeatherNow(v: unknown): string {
	return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
}

function context(f: BriefingFacts | null, now: Date, weatherNow: string): string {
	const kids = getConfig().kids.map((k) => k.name);
	const lines = [
		`The kids here are ${kids.join(' and ')}.`,
		`Right now it is ${now.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
	];
	if (weatherNow) lines.push(`The weather right now (the big number on the screen): ${weatherNow}.`);
	if (f) {
		lines.push(
			`What the screen shows about ${f.when} (${f.dayName}):`,
			`- Weather for the whole day: ${f.weather}`,
			`- School: ${f.school}`,
			`- What to wear: ${f.wear}`
		);
		if (f.note) lines.push(`- Note from a grown-up: ${f.note}`);
		if (f.festival) lines.push(`- Festival: ${f.festival}`);
	}
	return lines.join('\n');
}

/** An answer for a kid's question; null when the AI couldn't give a good one. */
export async function answer(question: string, facts: BriefingFacts | null, weatherNow = ''): Promise<string | null> {
	// a grown-up topic is neither sent nor remembered
	if (hasBlockedWords(question)) return ASK_A_GROWN_UP;
	const now = Date.now();
	const before = remembered(now);
	const system =
		`${KID_VOICE}\n\n` +
		'A child just asked you a question out loud; your answer is read aloud to them. ' +
		`Answer in 1 to 3 short sentences (under ${MAX_LEN} characters), simply and correctly, ` +
		'like a friendly teacher. For a math question, give the answer and one tiny tip. ' +
		'Only use the facts below for questions about today, the weather, school or clothes; never make up plans. ' +
		'For the weather or temperature now, give the temperature right now; the high and low are for the whole day. ' +
		"If you don't know, say so kindly. If the question is about something not right for a child, " +
		'or about their body, health, safety, or feelings that sound worrying, gently say to ask a grown-up. ' +
		'Plain words only: never use emoji or smileys like :) (they would be read out loud), no lists, no links. ' +
		'If you have already talked with the child, the new question may follow on from that ' +
		'(like "why?" or "what about tomorrow?"): answer it in that light.\n\n' +
		context(facts, new Date(), weatherNow);
	for (let attempt = 0; attempt < 2; attempt++) {
		const text = withoutEmoji(
			await chat(
				[
					{ role: 'system', content: system },
					...before,
					{ role: 'user', content: question }
				],
				{ maxTokens: 200, temperature: 0.5, timeoutMs: 30_000 }
			)
		);
		if (text.length <= MAX_LEN + 60 && aiTextOk(text)) {
			remember(question, text, now);
			return text;
		}
	}
	return null;
}
