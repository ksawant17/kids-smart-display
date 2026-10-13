import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { lookupZip } from '#lib/server/geocode';
import { isZip } from '#lib/utils/admin';

/** GET /api/admin/zip?zip=22030 -> { zip, name, latitude, longitude, timezone } (not saved) */
export async function GET({ url, cookies }) {
	requireAdmin(cookies);
	const zip = url.searchParams.get('zip');
	if (!isZip(zip)) error(400, 'A ZIP code has 5 digits');
	let place;
	try {
		place = await lookupZip(zip);
	} catch (err) {
		console.warn(`[admin] ZIP lookup failed: ${err}`);
		error(502, "Couldn't look that up. Is the Wi-Fi working?");
	}
	if (!place) error(404, `No place found for ZIP ${zip}`);
	return json(place);
}
