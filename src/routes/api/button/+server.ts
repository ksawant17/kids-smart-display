import { error } from '@sveltejs/kit';
import { isLocal } from '#lib/server/admin';
import { onButton } from '#lib/server/button';

/**
 * GET /api/button -> server-sent events, one per gesture of the top button
 * ("tap" | "hold"). The kiosk page listens (only the Pi itself may).
 */
export function GET({ getClientAddress, request }) {
	if (!isLocal(getClientAddress())) error(403, 'Only the dashboard screen can do that');
	let off = () => {};
	let ping: ReturnType<typeof setInterval>;
	const stream = new ReadableStream({
		start(controller) {
			const send = (s: string) => {
				try {
					controller.enqueue(new TextEncoder().encode(s));
				} catch {
					/* closed */
				}
			};
			const end = () => {
				off();
				clearInterval(ping);
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			};
			send('retry: 3000\n\n');
			// end() also runs when the server stops, so a restart never waits on us
			off = onButton((g) => send(`data: ${g}\n\n`), end);
			ping = setInterval(() => send(': ping\n\n'), 25_000);
			request.signal.addEventListener('abort', end);
		},
		cancel() {
			off();
			clearInterval(ping);
		}
	});
	return new Response(stream, {
		headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' }
	});
}
