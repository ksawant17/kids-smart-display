import { json, error } from '@sveltejs/kit';
import { requireAdmin, savePin } from '#lib/server/admin';
import { isPin } from '#lib/utils/admin';

/** POST /api/admin/pin { pin }: change the grown-ups PIN */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!isPin(body?.pin)) error(400, 'PIN must be 4 digits');
	savePin(body.pin);
	return json({ ok: true });
}
