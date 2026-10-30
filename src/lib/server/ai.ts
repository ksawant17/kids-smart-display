/**
 * The AI helper: an OpenAI-style chat server (a local llama.cpp / Ollama /
 * LM Studio box on the home network, or any compatible service).
 *
 * Settings live in data/ai.json (git-ignored, readable by this user only):
 * the server address, its key and model, and which features may use it.
 * The key never leaves the server: the admin tab only sees its last 4 letters.
 *
 * Everything the AI writes is checked by the same blocked-words filter as the
 * fetched content (utils/content.ts) before a kid can see it.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { hasBlockedWords } from '#lib/utils/content';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'ai.json');

export interface AiFeatures {
	/** a short friendly summary of the day on TODAY */
	briefing: boolean;
	/** bedtime stories on FUN */
	stories: boolean;
	/** new jokes, facts and words for the New Content queue */
	content: boolean;
	/** 🎤 Ask: answers to the kids' spoken questions (needs the audio HAT) */
	ask: boolean;
}

export interface AiSettings {
	enabled: boolean;
	/** base address, e.g. http://192.168.1.20:8080 (".../v1" is added) */
	url: string;
	key: string;
	model: string;
	features: AiFeatures;
	/**
	 * optional voice server (ai-box/voice-server.py) for listening and
	 * speaking, e.g. http://192.168.1.20:8090; '' keeps it all on the Pi
	 */
	voiceUrl: string;
	voiceKey: string;
}

const DEFAULTS: AiSettings = {
	enabled: false,
	url: '',
	key: '',
	model: '',
	features: { briefing: true, stories: true, content: true, ask: true },
	voiceUrl: '',
	voiceKey: ''
};

export function getAi(): AiSettings {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		return {
			enabled: s.enabled === true,
			url: typeof s.url === 'string' ? s.url : '',
			key: typeof s.key === 'string' ? s.key : '',
			model: typeof s.model === 'string' ? s.model : '',
			features: { ...DEFAULTS.features, ...s.features },
			voiceUrl: typeof s.voiceUrl === 'string' ? s.voiceUrl : '',
			voiceKey: typeof s.voiceKey === 'string' ? s.voiceKey : ''
		};
	} catch {
		return structuredClone(DEFAULTS);
	}
}

export function saveAi(patch: Partial<AiSettings>): AiSettings {
	const s = { ...getAi(), ...patch };
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify(s, null, '\t') + '\n', { mode: 0o600 });
	renameSync(`${FILE}.tmp`, FILE);
	return s;
}

const hint = (key: string) => (key ? `…${key.slice(-4)}` : '');

/** what the admin tab may see (no keys) */
export function publicAi() {
	const s = getAi();
	return { ...s, key: undefined, keyHint: hint(s.key), voiceKey: undefined, voiceKeyHint: hint(s.voiceKey) };
}

/** Is this feature switched on (and the helper set up)? */
export function aiOn(feature: keyof AiFeatures): boolean {
	const s = getAi();
	return s.enabled && !!s.url && !!s.model && s.features[feature];
}

const api = (url: string) => `${url.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1`;
const headers = (key: string) => ({
	'content-type': 'application/json',
	...(key ? { authorization: `Bearer ${key}` } : {})
});

/** model names the server offers */
export async function listModels(url: string, key: string): Promise<string[]> {
	const res = await fetch(`${api(url)}/models`, { headers: headers(key), signal: AbortSignal.timeout(8000) });
	if (res.status === 401 || res.status === 403) throw new Error('The server said the key is wrong');
	if (!res.ok) throw new Error(`The server answered ${res.status}`);
	const body = (await res.json()) as { data?: { id?: unknown }[] };
	return (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string');
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

// one request at a time: the AI box is shared, and the Pi doesn't need a queue of answers
let busy: Promise<unknown> = Promise.resolve();

/**
 * One chat turn -> the reply text. Throws when the helper is off, the server
 * is unreachable, or it takes longer than `timeoutMs`.
 */
export function chat(
	messages: ChatMessage[],
	opts: { maxTokens?: number; temperature?: number; timeoutMs?: number; settings?: AiSettings } = {}
): Promise<string> {
	const run = async () => {
		const s = opts.settings ?? getAi();
		if (!s.url || !s.model) throw new Error('The AI helper is not set up');
		const body = {
			model: s.model,
			messages,
			max_tokens: opts.maxTokens ?? 400,
			temperature: opts.temperature ?? 0.8,
			// Qwen-style models "think" first; a kids' screen wants the quick answer
			chat_template_kwargs: { enable_thinking: false }
		};
		const res = await fetch(`${api(s.url)}/chat/completions`, {
			method: 'POST',
			headers: headers(s.key),
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000)
		});
		if (res.status === 401 || res.status === 403) throw new Error('The server said the key is wrong');
		if (!res.ok) throw new Error(`The AI server answered ${res.status}`);
		const reply = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
		const text = reply.choices?.[0]?.message?.content;
		if (typeof text !== 'string' || !text.trim()) throw new Error('The AI gave an empty answer');
		// some models still wrap a few thoughts in <think> tags
		return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
	};
	const next = busy.then(run, run);
	busy = next.catch(() => {});
	return next;
}

/** The JSON inside a reply (models like to add ``` fences or a sentence around it). */
export function parseJson<T>(text: string): T {
	const body = text.replace(/^[\s\S]*?```(?:json)?\s*([\s\S]*?)```[\s\S]*$/, '$1');
	const start = body.search(/[[{]/);
	const end = Math.max(body.lastIndexOf(']'), body.lastIndexOf('}'));
	if (start < 0 || end < start) throw new Error('The AI did not answer in JSON');
	return JSON.parse(body.slice(start, end + 1)) as T;
}

/** Shared voice for everything a kid sees. */
export const KID_VOICE =
	'You write for a family smart display read by children aged 5 to 10. ' +
	'Use short, simple, cheerful words. Keep everything gentle and kind: no scary things, ' +
	'no violence, no grown-up topics, no brands, no religion beyond naming a festival. ' +
	'Never ask the reader for personal information.';

/** a kid-safe check for AI text: no blocked words, no links */
export const aiTextOk = (text: string) => !hasBlockedWords(text) && !/https?:|www\.|[<>{}]/.test(text);
