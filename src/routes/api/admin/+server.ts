import { json, error } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/admin';
import { getConfig, updateConfig } from '#lib/server/config';
import { loadFeed } from '#lib/server/schoolFeed';
import { permissions, systemInfo, timeStatus } from '#lib/server/system';
import { pendingCount } from '#lib/server/content';
import { MAX_KIDS, isZip } from '#lib/utils/admin';
import { isBuddy } from '#lib/buddies';
import { EMOJI_CODE, HEX_COLOR, HHMM } from '#lib/config';

/** everything the admin tab can change */
function settings() {
	const c = getConfig();
	return {
		kids: c.kids,
		location: c.location,
		school: c.school,
		wardrobe: c.wardrobe,
		screen: { dimAfterMinutes: c.screen.dimAfterMinutes, offAfterMinutes: c.screen.offAfterMinutes },
		kiosk: c.kiosk,
		bedtime: c.bedtime
	};
}
export type AdminSettings = ReturnType<typeof settings>;

/** GET /api/admin -> { settings, time, system, permissions, contentPending } */
export async function GET({ cookies }) {
	requireAdmin(cookies);
	const [time, system, perms] = await Promise.all([timeStatus(), systemInfo(), permissions()]);
	return json({ settings: settings(), time, system, permissions: perms, contentPending: pendingCount() });
}

const whole = (v: unknown, min: number, max: number): v is number =>
	typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const KID_NAME = /^[\p{L}\p{M}' .-]{1,16}$/u;

/**
 * POST /api/admin with any of these sections (each replaces what it names):
 *   location { zip, name, latitude, longitude }
 *   screen   { dimAfterMinutes, offAfterMinutes }      kiosk { idleReturnSeconds, idleScreen }
 *   bedtime  { enabled, start: "HH:MM", end: "HH:MM" }
 *   kids     [{ name, avatar, color }]                  (1-4 kids)
 *   school   { icsUrl, startHour, endHour }            (the feed is downloaded and checked first)
 *   wardrobe { coldBelowF, coolUpToF, mildUpToF, rainChancePct, switchToTomorrowHour }
 * Saved into config/dashboard.json -> the new settings
 */
export async function POST({ request, cookies }) {
	requireAdmin(cookies);
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	const patch: Record<string, Record<string, unknown>> = {};
	let kids: { name: string; avatar: string; color: string }[] | null = null;

	if (body.location !== undefined) {
		const { zip, name, latitude, longitude } = body.location ?? {};
		if (!isZip(zip)) error(400, 'location.zip must be 5 digits');
		if (typeof name !== 'string' || !name.trim() || name.length > 60) error(400, 'location.name is missing');
		if (typeof latitude !== 'number' || Math.abs(latitude) > 90) error(400, 'bad latitude');
		if (typeof longitude !== 'number' || Math.abs(longitude) > 180) error(400, 'bad longitude');
		patch.location = { zip, name: name.trim(), latitude, longitude };
	}
	if (body.screen !== undefined) {
		const { dimAfterMinutes, offAfterMinutes } = body.screen ?? {};
		if (!whole(dimAfterMinutes, 0, 240) || !whole(offAfterMinutes, 0, 1440)) error(400, 'bad screen timers');
		patch.screen = { dimAfterMinutes, offAfterMinutes };
	}
	if (body.kiosk !== undefined) {
		const { idleReturnSeconds, idleScreen } = body.kiosk ?? {};
		if (!whole(idleReturnSeconds, 0, 3600)) error(400, 'bad kiosk.idleReturnSeconds');
		if (typeof idleScreen !== 'boolean') error(400, 'bad kiosk.idleScreen');
		patch.kiosk = { idleReturnSeconds, idleScreen };
	}
	if (body.bedtime !== undefined) {
		const { enabled, start, end } = body.bedtime ?? {};
		if (typeof enabled !== 'boolean' || !HHMM.test(start) || !HHMM.test(end)) error(400, 'bad bedtime');
		if (start === end) error(400, 'Bedtime and wake-up time must be different');
		patch.bedtime = { enabled, start, end };
	}
	if (body.kids !== undefined) {
		if (!Array.isArray(body.kids) || body.kids.length < 1 || body.kids.length > MAX_KIDS)
			error(400, `between 1 and ${MAX_KIDS} kids`);
		kids = body.kids.map((k: { name?: unknown; avatar?: unknown; color?: unknown }) => {
			const name = typeof k?.name === 'string' ? k.name.trim() : '';
			if (!KID_NAME.test(name)) error(400, 'Each kid needs a name (letters only, 16 at most)');
			// a buddy, or the twemoji avatar some kids already have in their config
			if (!isBuddy(k.avatar) && !(typeof k.avatar === 'string' && EMOJI_CODE.test(k.avatar)))
				error(400, 'pick a buddy for each kid');
			if (typeof k.color !== 'string' || !HEX_COLOR.test(k.color)) error(400, 'bad colour');
			return { name, avatar: k.avatar as string, color: k.color };
		});
		const names = kids!.map((k) => k.name.toLowerCase());
		if (new Set(names).size !== names.length) error(400, 'Two kids have the same name');
	}
	if (body.wardrobe !== undefined) {
		const { coldBelowF, coolUpToF, mildUpToF, rainChancePct, switchToTomorrowHour } = body.wardrobe ?? {};
		if (!whole(coldBelowF, -20, 100) || !whole(coolUpToF, -20, 110) || !whole(mildUpToF, -20, 120))
			error(400, 'bad temperatures');
		if (!(coldBelowF <= coolUpToF && coolUpToF < mildUpToF)) error(400, 'The temperatures must go up in order');
		if (!whole(rainChancePct, 0, 100) || !whole(switchToTomorrowHour, 12, 24)) error(400, 'bad wardrobe settings');
		patch.wardrobe = { coldBelowF, coolUpToF, mildUpToF, rainChancePct, switchToTomorrowHour };
	}
	if (body.school !== undefined) {
		const { icsUrl, startHour, endHour } = body.school ?? {};
		if (!whole(startHour, 5, 12) || !whole(endHour, 11, 19) || endHour <= startHour) error(400, 'bad school hours');
		let url: URL | null = null;
		try {
			url = new URL(String(icsUrl).trim().replace(/^webcal:/i, 'https:'));
		} catch {
			/* checked below */
		}
		if (!url || !/^https?:$/.test(url.protocol)) error(400, 'The calendar link should start with https://');
		if (url.href !== getConfig().school.icsUrl) {
			try {
				await loadFeed(url.href);
			} catch (err) {
				error(400, `Couldn't use that calendar: ${err instanceof Error ? err.message : err}`);
			}
		}
		patch.school = { icsUrl: url.href, startHour, endHour };
	}
	if (!Object.keys(patch).length && !kids) error(400, 'nothing to change');

	updateConfig(patch, kids ? { kids } : undefined);
	return json(settings());
}
