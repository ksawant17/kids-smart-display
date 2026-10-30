/**
 * The top push button (config.button; wiring in README "Top button").
 *
 * `gpiomon` (libgpiod) watches the GPIO line with the Pi's internal pull-up,
 * active-low (pressed = pulled to GND), debounced. Gestures (utils/button.ts)
 * go to the kiosk page over /api/button (server-sent events):
 *   tap   -> the page wakes onto the idle screen, or turns the screen off
 *   hold  -> the page opens the power menu
 *   reset -> this server restarts the kiosk browser (escape hatch)
 * With no kiosk page listening, a tap switches the backlight here instead.
 * While a timer or reminder is going off, a tap stops it (interceptTap).
 * The same stream tells the kiosk when something else changed (notifyKiosk).
 * The button needs no PIN: pressing it means being at the screen. Restart /
 * power off from the menu are allowed for a minute after a hold.
 *
 * On SIGTERM (restart, update) the watcher and the open event streams are
 * closed straight away: either would otherwise keep the server alive forever.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { getConfig } from './config';
import { getScreen, setScreen } from './screen';
import { restartKiosk } from './system';
import { ButtonGestures, type Gesture } from '#lib/utils/button';

const RETRY_MS = 60_000;
const POWER_WINDOW_MS = 60_000;
const listeners = new Set<(event: string) => void>();
const taps: (() => boolean)[] = [];
const closers = new Set<() => void>();

let child: ChildProcess | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let started = false;
let stopping = false;
let lastHold = 0;
let warned = false;

function emit(g: Gesture) {
	console.log(`[button] ${g}`);
	if (g === 'hold') lastHold = Date.now();
	if (g === 'reset') {
		restartKiosk();
		return;
	}
	if (g === 'tap' && taps.some((fn) => fn())) return;
	if (listeners.size) listeners.forEach((fn) => fn(g));
	else if (g === 'tap') setScreen({ mode: getScreen().mode === 'on' ? 'off' : 'on' });
}

/** Something else for the kiosk page ("reminders": the timers changed). */
export function notifyKiosk(event: string) {
	listeners.forEach((fn) => fn(event));
}

/** A tap goes here first; returning true means it was used up (not passed on). */
export function interceptTap(fn: () => boolean) {
	taps.push(fn);
}

/** Listen for gestures (and notifyKiosk events); `close` ends the listener's stream when the server stops. */
export function onButton(fn: (event: string) => void, close: () => void): () => void {
	listeners.add(fn);
	closers.add(close);
	return () => {
		listeners.delete(fn);
		closers.delete(close);
	};
}

/** a power action from the on-screen power menu, right after a hold */
export const powerAllowed = () => Date.now() - lastHold < POWER_WINDOW_MS;

function watch() {
	const { enabled, gpio, holdSeconds } = getConfig().button;
	if (!enabled || stopping) return;
	const gestures = new ButtonGestures(emit, { holdMs: holdSeconds * 1000, resetMs: 10_000 });
	const cmd = process.env.BUTTON_MONITOR ?? 'gpiomon';
	child = spawn(
		cmd,
		['-c', 'gpiochip0', '-b', 'pull-up', '-l', '-p', '30ms', '-C', 'kids-dashboard-button', '-F', '%e', String(gpio)],
		{ stdio: ['ignore', 'pipe', 'pipe'] }
	);
	let buf = '';
	child.stdout!.on('data', (d: Buffer) => {
		buf += d.toString();
		let i;
		while ((i = buf.indexOf('\n')) >= 0) {
			const line = buf.slice(0, i).trim();
			buf = buf.slice(i + 1);
			// active-low: rising (1) = pressed, falling (2) = let go
			if (line === '1') gestures.press();
			else if (line === '2') gestures.release();
		}
	});
	let err = '';
	child.stderr!.on('data', (d: Buffer) => (err += d.toString()));
	child.on('error', (e) => (err ||= String(e)));
	child.on('close', (code) => {
		child = null;
		if (stopping) return;
		if (!warned) {
			console.warn(`[button] GPIO${gpio} watcher stopped (${code ?? ''} ${err.trim()}); retrying every minute`);
			warned = true;
		}
		retry = setTimeout(watch, RETRY_MS);
		retry.unref();
	});
	console.log(`[button] watching GPIO${gpio} (tap: idle screen / off, hold ${holdSeconds}s: power menu, hold 10s: restart screen)`);
}

/** Start once, when the server starts (hooks.server.ts). */
export function startButton() {
	if (started || process.env.NODE_ENV === 'test') return;
	started = true;
	watch();
	process.once('SIGTERM', stop);
	process.once('SIGINT', stop);
	process.once('exit', stop);
}

function stop() {
	stopping = true;
	if (retry) clearTimeout(retry);
	child?.kill();
	closers.forEach((close) => close());
	closers.clear();
	listeners.clear();
}
