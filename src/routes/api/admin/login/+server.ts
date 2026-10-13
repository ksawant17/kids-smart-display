import { json, error } from '@sveltejs/kit';
import { checkPin, endSession, isAdmin, pinIsSet, savePin, startSession } from '#lib/server/admin';
import { isPin } from '#lib/utils/admin';

/** GET /api/admin/login -> { pinSet, unlocked } */
export function GET({ cookies }) {
	return json({ pinSet: pinIsSet(), unlocked: isAdmin(cookies) });
}

/**
 * POST /api/admin/login { pin }
 * The very first PIN entered becomes the grown-ups PIN; after that it must match.
 * -> { ok: true } | { ok: false, triesLeft?, waitSeconds? }
 */
export async function POST({ request, cookies }) {
	const body = await request.json().catch(() => null);
	if (!isPin(body?.pin)) error(400, 'PIN must be 4 digits');
	if (!pinIsSet()) {
		savePin(body.pin);
		startSession(cookies);
		return json({ ok: true, created: true });
	}
	const result = checkPin(body.pin);
	if (result.ok) startSession(cookies);
	return json(result);
}

/** DELETE /api/admin/login: lock the admin tab again */
export function DELETE({ cookies }) {
	endSession(cookies);
	return json({ ok: true });
}
