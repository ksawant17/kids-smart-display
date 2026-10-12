/**
 * Backlight control for the Pi's DSI panel via /sys/class/backlight/<dev>.
 * `brightness` there is writable by the `video` group (the `pi` user is a
 * member), so no root is needed. Writing 0 switches the backlight off; the
 * touch layer keeps working, so a touch can wake it again.
 *
 * The user's chosen brightness is saved to data/screen.json and survives
 * restarts. Without a backlight (desktop / dev machine) everything still
 * works; the kiosk page then simulates dimming with a dark overlay.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getConfig } from './config';
import { rawLevel, targetPercent, type ScreenMode, type ScreenStatus } from '#lib/screen';

const BACKLIGHT_ROOT = process.env.BACKLIGHT_DIR ?? '/sys/class/backlight';
const SAVED = resolve(process.env.DASHBOARD_DATA ?? 'data', 'screen.json');

function findDevice(): string | null {
	try {
		const name = readdirSync(BACKLIGHT_ROOT).sort()[0];
		return name ? join(BACKLIGHT_ROOT, name) : null;
	} catch {
		return null;
	}
}

const device = findDevice();
const max = (() => {
	try {
		return device ? Number(readFileSync(join(device, 'max_brightness'), 'utf8')) || 255 : 255;
	} catch {
		return 255;
	}
})();

let mode: ScreenMode = 'on';
let brightness = loadBrightness();
let current: number | null = null; // raw level last written
let fade: ReturnType<typeof setInterval> | null = null;
let warned = false;

function loadBrightness(): number {
	const { brightness: fallback, minBrightness } = getConfig().screen;
	try {
		const saved = JSON.parse(readFileSync(SAVED, 'utf8')).brightness;
		if (typeof saved === 'number') return Math.max(minBrightness, Math.min(100, saved));
	} catch {
		/* nothing saved yet */
	}
	return fallback;
}

function saveBrightness() {
	try {
		mkdirSync(dirname(SAVED), { recursive: true });
		writeFileSync(SAVED, JSON.stringify({ brightness }) + '\n');
	} catch (err) {
		console.warn(`[screen] could not save ${SAVED}: ${err}`);
	}
}

function writeRaw(level: number) {
	if (!device) return;
	try {
		writeFileSync(join(device, 'brightness'), String(level));
		current = level;
	} catch (err) {
		if (!warned) {
			console.warn(`[screen] cannot write ${device}/brightness (is the user in the "video" group?): ${err}`);
			warned = true;
		}
	}
}

/** Set the backlight, fading over `ms` (instant when ms = 0). */
function apply(ms: number) {
	const target = rawLevel(targetPercent(mode, brightness, getConfig().screen.dimBrightness), max);
	if (fade) clearInterval(fade);
	fade = null;
	const from = current ?? target;
	const steps = Math.max(1, Math.round(ms / 40));
	if (ms <= 0 || from === target) return writeRaw(target);
	let i = 0;
	fade = setInterval(() => {
		i++;
		writeRaw(i >= steps ? target : Math.round(from + ((target - from) * i) / steps));
		if (i >= steps && fade) {
			clearInterval(fade);
			fade = null;
		}
	}, ms / steps);
}

export function getScreen(): ScreenStatus {
	return { available: !!device, brightness, mode };
}

/** Change power mode and/or brightness. Waking is instant; dimming fades. */
export function setScreen(change: { mode?: ScreenMode; brightness?: number }): ScreenStatus {
	const { minBrightness } = getConfig().screen;
	let fadeMs = 0;
	if (change.brightness !== undefined) {
		brightness = Math.round(Math.max(minBrightness, Math.min(100, change.brightness)));
		saveBrightness();
	}
	if (change.mode && change.mode !== mode) {
		fadeMs = change.mode === 'on' ? 0 : 1500;
		mode = change.mode;
	}
	apply(fadeMs);
	return getScreen();
}
