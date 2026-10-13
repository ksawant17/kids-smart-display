import { json, error } from '@sveltejs/kit';
import { isLocal } from '#lib/server/admin';
import { powerAllowed } from '#lib/server/button';
import { permissions, power } from '#lib/server/system';

/**
 * POST /api/button/power { action: "reboot" | "poweroff" }: from the power
 * menu the top button opened. No PIN (someone is at the screen holding the
 * button), but only from the kiosk itself and within a minute of the hold.
 */
export async function POST({ request, getClientAddress }) {
	if (!isLocal(getClientAddress()) || !powerAllowed()) error(403, 'Hold the top button to use the power menu');
	const action = (await request.json().catch(() => null))?.action;
	if (action !== 'reboot' && action !== 'poweroff') error(400, 'action must be reboot or poweroff');
	if (!(await permissions()).power) error(403, 'The Pi needs a one-time setup first (see README: "Admin tab").');
	console.log(`[button] ${action} from the power menu`);
	power(action);
	return json({ ok: true });
}
