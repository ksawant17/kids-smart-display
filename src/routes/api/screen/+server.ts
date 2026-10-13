import { json, error } from '@sveltejs/kit';
import { getScreen, setScreen } from '#lib/server/screen';
import { isAdmin, isLocal } from '#lib/server/admin';
import type { ScreenMode } from '#lib/screen';

const MODES: ScreenMode[] = ['on', 'dim', 'off'];

/** GET /api/screen -> { available, brightness, mode } */
export function GET() {
	return json(getScreen());
}

/**
 * POST /api/screen  { mode?: "on" | "dim" | "off", brightness?: 1-100 }
 * Called by the kiosk page (idle dim/off, wake on touch) and the brightness slider.
 * Only the kiosk itself (or an unlocked Grown-ups tab) may switch the screen:
 * the server also answers on the home network.
 */
export async function POST({ request, cookies, getClientAddress }) {
	if (!isLocal(getClientAddress()) && !isAdmin(cookies)) error(403, 'Only the dashboard screen can do that');
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') error(400, 'expected a JSON object');
	const change: { mode?: ScreenMode; brightness?: number } = {};
	if (body.mode !== undefined) {
		if (!MODES.includes(body.mode)) error(400, 'mode must be on, dim or off');
		change.mode = body.mode;
	}
	if (body.brightness !== undefined) {
		if (typeof body.brightness !== 'number' || !Number.isFinite(body.brightness)) error(400, 'brightness must be a number');
		change.brightness = body.brightness;
	}
	return json(setScreen(change));
}
