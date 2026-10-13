import { json } from '@sveltejs/kit';
import { listMessages } from '#lib/server/messages';

/** GET /api/messages -> grown-up notes for the TODAY banner (the page picks the day) */
export function GET() {
	return json(listMessages());
}
