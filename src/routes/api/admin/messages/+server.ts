import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { EMOJI_CODE } from '#lib/config';
import { addMessage, removeMessage } from '#lib/server/messages';
import { cleanMessage, isDayKey } from '#lib/utils/messages';

/** POST /api/admin/messages { text, emoji, from: "YYYY-MM-DD", until: "YYYY-MM-DD" | null } -> all messages */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	const text = cleanMessage(body?.text);
	if (!text) error(400, 'The note needs some words (70 letters at most)');
	if (typeof body.emoji !== 'string' || !EMOJI_CODE.test(body.emoji)) error(400, 'bad emoji');
	if (!isDayKey(body.from)) error(400, 'bad start day');
	if (body.until !== null && (!isDayKey(body.until) || body.until < body.from)) error(400, 'bad end day');
	return json(addMessage({ text, emoji: body.emoji, from: body.from, until: body.until }));
}

/** DELETE /api/admin/messages?id=... -> all messages */
export function DELETE({ url, cookies }) {
	requireAdmin(cookies);
	const id = url.searchParams.get('id');
	if (!id) error(400, 'id missing');
	return json(removeMessage(id));
}
