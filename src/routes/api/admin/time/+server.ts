import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { permissions, restartKiosk, setNtp, setTime, setTimezone, timeStatus } from '#lib/server/system';
import { isLocalDateTime, isTimezone } from '#lib/utils/admin';

/**
 * POST /api/admin/time, one of:
 *   { timezone: "America/Chicago" }   (the kiosk browser restarts to pick it up)
 *   { ntp: true | false }             (automatic time from the internet)
 *   { time: "2026-10-12 21:30" }      (only while automatic time is off)
 * -> the new time status
 */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	if (!(await permissions()).clock) error(403, 'The Pi needs a one-time setup first (see README: "Admin tab").');
	let restarting = false;
	try {
		if (body.timezone !== undefined) {
			if (!isTimezone(body.timezone)) error(400, 'unknown time zone');
			const before = (await timeStatus()).timezone;
			await setTimezone(body.timezone);
			if (before !== body.timezone) {
				restarting = true;
				setTimeout(restartKiosk, 1500);
			}
		} else if (typeof body.ntp === 'boolean') {
			await setNtp(body.ntp);
		} else if (body.time !== undefined) {
			if (!isLocalDateTime(body.time)) error(400, 'time must look like "2026-10-12 21:30"');
			if ((await timeStatus()).ntp) error(409, 'Turn off automatic time first');
			await setTime(body.time);
		} else {
			error(400, 'nothing to change');
		}
	} catch (err) {
		if ((err as { status?: number }).status) throw err;
		error(500, err instanceof Error ? err.message : String(err));
	}
	return json({ ...(await timeStatus()), restarting });
}
