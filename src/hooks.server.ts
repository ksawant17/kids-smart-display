/**
 * Server start: watch the top push button (GPIO).
 * Every response: basic security headers (the dashboard is also reachable
 * from the home network). Admin API replies (IP address, Wi-Fi name...) are
 * never cached.
 */
import { building } from '$app/env';
import type { Handle } from '@sveltejs/kit/hooks';
import { startButton } from '#lib/server/button';

if (!building) startButton();

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
