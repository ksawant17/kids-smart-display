/**
 * The clock announcement on the hour: a soft chime, then "It's 3 o'clock!"
 * and (if switched on) the weather, through the audio HAT. Grown-ups ->
 * Voice sets which hours. Runs on the server, so it happens whether or not
 * anybody is using the screen. Never during bedtime quiet hours, and never
 * over a kid who is asking something or a story being read.
 */
import { getConfig } from '#lib/server/config';
import { getWeather } from '#lib/server/weather';
import { getVoice, listening, say, speaking, voiceOn } from '#lib/server/voice';
import { announcement, announces } from '#lib/utils/announce';
import { inBedtime } from '#lib/screen';

let timer: ReturnType<typeof setTimeout> | null = null;

/** What would be said right now (the "Say it now" button), or on the hour. */
export async function hourlyText(now = new Date()): Promise<string> {
	const { hourly } = getVoice();
	const wx = hourly.weather ? await getWeather() : null;
	return announcement(now, wx, {
		weather: hourly.weather,
		first: now.getHours() === hourly.from,
		tomorrowFrom: getConfig().wardrobe.switchToTomorrowHour
	});
}

/** Say it now (the admin tab's test button skips the hour and quiet checks). */
export async function announceNow(): Promise<string> {
	const text = await hourlyText();
	await say(text, { sound: 'chime' });
	return text;
}

async function onTheHour() {
	const now = new Date();
	const v = getVoice();
	if (!voiceOn() || v.volume === 0 || !announces(now.getHours(), v.hourly)) return;
	if (inBedtime(now, getConfig().bedtime) || listening() || speaking()) return;
	console.log(`[hourly] ${await announceNow()}`);
}

function next() {
	const now = new Date();
	const at = new Date(now);
	at.setHours(now.getHours() + 1, 0, 0, 0);
	// a moment past the hour, so the clock on screen already shows it
	timer = setTimeout(() => {
		next();
		onTheHour().catch((err) => console.warn(`[hourly] ${err}`));
	}, at.getTime() - now.getTime() + 300);
	// never what keeps the server running (a restart must be able to finish)
	timer.unref();
}

/** At server start (hooks.server.ts). */
export function startHourly() {
	if (timer || process.env.NODE_ENV === 'test') return;
	next();
}
