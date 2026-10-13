import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { startUpdate, updateInfo } from '#lib/server/system';

/** GET /api/admin/update[?check=1] -> installed version, waiting changes, progress (check=1 asks GitHub) */
export async function GET({ url, cookies }) {
	requireAdmin(cookies);
	return json(await updateInfo(url.searchParams.has('check')));
}

/** POST /api/admin/update -> starts the update in the background */
export async function POST({ cookies }) {
	requireAdmin(cookies);
	const info = await updateInfo();
	if (info.localChanges) error(409, 'This copy has local changes, so it can only be updated by hand.');
	try {
		startUpdate();
	} catch (err) {
		error(409, err instanceof Error ? err.message : String(err));
	}
	return json({ ok: true });
}
