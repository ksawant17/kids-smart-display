/**
 * Server start: watch the top push button (GPIO), get the voice ready, start
 * the clock announcement on the hour.
 * Every response: basic security headers (the dashboard is also reachable
 * from the home network). Admin API replies (IP address, Wi-Fi name...) are
 * never cached.
 */
import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { startButton } from '#lib/server/button';
import { startVoice } from '#lib/server/voice';
import { startHourly } from '#lib/server/announce';

if (!building) {
	startButton();
	startVoice();
	startHourly();
}

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const h = response.headers;
	h.set('X-Content-Type-Options', 'nosniff');
	h.set('X-Frame-Options', 'DENY'); // no clickjacking the Grown-ups tab
	h.set('Referrer-Policy', 'same-origin');
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	if (event.url.pathname.startsWith('/api/admin')) h.set('Cache-Control', 'no-store');
	return response;
};
