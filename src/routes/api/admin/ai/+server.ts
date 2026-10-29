import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { KID_VOICE, chat, getAi, listModels, publicAi, saveAi, type AiSettings } from '#lib/server/ai';

/** GET /api/admin/ai -> the AI helper's settings (the key only as "…abcd") */
export function GET({ cookies }) {
	requireAdmin(cookies);
	return json(publicAi());
}

/**
 * POST /api/admin/ai, one of:
 *   { action: "save", enabled?, url?, key?, model?, features?, voiceUrl?, voiceKey? }  -> settings
 *   { action: "test", url?, key? }  -> { models, reply } (unsaved url/key are tried as typed)
 *   { action: "test-voice", voiceUrl?, voiceKey? }  -> { stt, tts } (the voice server says a word)
 */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	const saved = getAi();
	const url = typeof body?.url === 'string' ? body.url.trim() : saved.url;
	const key = typeof body?.key === 'string' ? body.key.trim() : saved.key;
	if (url && !/^https?:\/\/[^\s/]+/i.test(url)) error(400, 'The address should start with http://');
	const voiceUrl = typeof body?.voiceUrl === 'string' ? body.voiceUrl.trim() : saved.voiceUrl;
	const voiceKey = typeof body?.voiceKey === 'string' ? body.voiceKey.trim() : saved.voiceKey;
	if (voiceUrl && !/^https?:\/\/[^\s/]+/i.test(voiceUrl))
		error(400, 'The voice server address should start with http://');

	if (body?.action === 'test-voice') {
		if (!voiceUrl) error(400, 'Type the voice server address first');
		const base = voiceUrl.replace(/\/+$/, '');
		try {
			const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
			if (!health.ok) throw new Error(`it answered ${health.status}`);
			const info = (await health.json()) as { stt?: string; tts?: string };
			// saying a word checks the key too
			const res = await fetch(`${base}/tts`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...(voiceKey ? { authorization: `Bearer ${voiceKey}` } : {}) },
				body: JSON.stringify({ text: 'Hello!' }),
				signal: AbortSignal.timeout(8000)
			});
			if (res.status === 401) throw new Error('the key is wrong');
			if (!res.ok) throw new Error(`it answered ${res.status}`);
			return json({ stt: info.stt ?? '', tts: info.tts ?? '' });
		} catch (err) {
			error(502, `Couldn't reach the voice server: ${err instanceof Error ? err.message : err}`);
		}
	}

	if (body?.action === 'test') {
		if (!url) error(400, 'Type the AI server address first');
		try {
			const models = await listModels(url, key);
			const model = typeof body.model === 'string' && body.model ? body.model : saved.model || models[0];
			const reply = model
				? await chat(
						[
							{ role: 'system', content: KID_VOICE },
							{ role: 'user', content: 'Say hello to the kids in five words or fewer.' }
						],
						{ maxTokens: 30, timeoutMs: 30_000, settings: { ...saved, url, key, model } }
					)
				: '';
			return json({ models, reply });
		} catch (err) {
			error(502, `Couldn't reach the AI: ${err instanceof Error ? err.message : err}`);
		}
	}
	if (body?.action !== 'save') error(400, 'unknown action');

	const patch: Partial<AiSettings> = { url, key, voiceUrl, voiceKey };
	if (body.enabled !== undefined) {
		if (typeof body.enabled !== 'boolean') error(400, 'bad enabled');
		patch.enabled = body.enabled;
	}
	if (body.model !== undefined) {
		if (typeof body.model !== 'string' || body.model.length > 200) error(400, 'bad model');
		patch.model = body.model.trim();
	}
	if (body.features !== undefined) {
		const f = body.features ?? {};
		for (const k of ['briefing', 'stories', 'content', 'ask'])
			if (typeof f[k] !== 'boolean') error(400, `bad features.${k}`);
		patch.features = { briefing: f.briefing, stories: f.stories, content: f.content, ask: f.ask };
	}
	if (patch.enabled && (!url || !(patch.model ?? saved.model))) error(400, 'Test the server and pick a model first');
	saveAi(patch);
	return json(publicAi());
}
