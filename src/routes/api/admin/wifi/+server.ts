import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { connectWifi, permissions, wifiNetworks } from '#lib/server/system';

/** GET /api/admin/wifi[?rescan=1] -> nearby networks, the one in use first */
export async function GET({ url, cookies }) {
	requireAdmin(cookies);
	return json(await wifiNetworks(url.searchParams.has('rescan')));
}

/** POST /api/admin/wifi { ssid, password? } -> join it (takes up to ~30 s) */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	const ssid = body?.ssid;
	const password = body?.password;
	if (typeof ssid !== 'string' || !ssid || ssid.length > 32) error(400, 'pick a network');
	if (password !== undefined && (typeof password !== 'string' || password.length < 8 || password.length > 63))
		error(400, 'Wi-Fi passwords are 8 to 63 characters');
	if (!(await permissions()).wifi) error(403, 'The Pi needs a one-time setup first (see README: "Admin tab").');
	try {
		await connectWifi(ssid, password);
	} catch (err) {
		error(502, err instanceof Error ? err.message : String(err));
	}
	return json(await wifiNetworks());
}
