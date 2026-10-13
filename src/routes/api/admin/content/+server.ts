import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { decide, getContent, refill, removeKept } from '#lib/server/content';

const EMOJI_CODE = /^[0-9a-f]{4,5}(-[0-9a-f]{4,5})*$/;

/** GET /api/admin/content -> { pending, kept, lastFetch } (fetches first if nothing is waiting and it's been an hour) */
export async function GET({ cookies }) {
	requireAdmin(cookies);
	const c = getContent();
	if (!c.pending.length && Date.now() - c.lastFetch > 3600_000) await refill();
	return json(getContent());
}

/**
 * POST /api/admin/content, one of:
 *   { action: "keep", id, emoji }   { action: "skip", id }
 *   { action: "remove", id }        (a kept one)
 *   { action: "fetch" }             (get more now)
 */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	const id = typeof body?.id === 'string' ? body.id : '';
	switch (body?.action) {
		case 'keep':
			if (typeof body.emoji !== 'string' || !EMOJI_CODE.test(body.emoji)) error(400, 'bad sticker');
			return json(decide(id, true, body.emoji));
		case 'skip':
			return json(decide(id, false));
		case 'remove':
			return json(removeKept(id));
		case 'fetch':
			await refill();
			return json(getContent());
		default:
			error(400, 'unknown action');
	}
}
