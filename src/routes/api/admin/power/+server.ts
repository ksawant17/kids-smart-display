import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { permissions, power } from '#lib/server/system';

/** POST /api/admin/power { action: "reboot" | "poweroff" } (happens ~1.5 s later) */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	const action = body?.action;
	if (action !== 'reboot' && action !== 'poweroff') error(400, 'action must be reboot or poweroff');
	if (!(await permissions()).power) error(403, 'The Pi needs a one-time setup first (see README: "Admin tab").');
	console.log(`[admin] ${action} requested`);
	power(action);
	return json({ ok: true });
}
