/**
 * Timers and reminders (utils/reminders.ts): kept in data/reminders.json so a
 * restart doesn't lose them, and rung here on the server, so they go off
 * whether or not anybody is using the screen.
 *
 * Going off: the alarm tune and the words ("Time's up for teeth brushing!"),
 * up to three times while nobody stops it, and a banner on the screen with
 * Stop / 5 more minutes. A tap on the top button stops it too. During bedtime
 * quiet hours it only shows on the screen (no sound, the screen stays dark).
 *
 * Wake-up alarms (alarms.ts) go off here too, but differently: through
 * bedtime, at their own volume, a soft tune that swells, then the good
 * morning, again and again for up to 5 minutes. The tune needs no voice
 * helper, so it rings even when the AI box is down.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getConfig } from '#lib/server/config';
import { interceptTap, notifyKiosk } from '#lib/server/button';
import { getVoice, listening, playTone, say, speaking, stopSpeaking, voiceInstalled, voiceOn } from '#lib/server/voice';
import { inBedtime } from '#lib/screen';
import {
	MAX_ACTIVE,
	MAX_TIMER_MINUTES,
	clockTime,
	TODAY_ONLY,
	ringText,
	type Reminder,
	type ReminderKind
} from '#lib/utils/reminders';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'reminders.json');
const RINGS = 3; // times the tune + words are played
const RING_GAP_MS = 20_000;
const SHOW_MS = 15 * 60_000; // the banner goes away by itself after this
const ALARM_MS = 5 * 60_000; // a wake-up alarm gives up after this
const ALARM_GAP_MS = 20_000;
const LATE_MS = 10 * 60_000; // missed while the server was down: still rung if this recent
export const SNOOZE_MINUTES = 5;

let upcoming: Reminder[] = [];
const ringing = new Map<string, { r: Reminder; since: number; timer: ReturnType<typeof setTimeout>; said: Set<string> }>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function load(): Reminder[] {
	try {
		const list = JSON.parse(readFileSync(FILE, 'utf8')).upcoming;
		return Array.isArray(list)
			? list.filter(
					(r) =>
						r &&
						typeof r.id === 'string' &&
						(r.kind === 'timer' || r.kind === 'reminder') &&
						Number.isFinite(r.at) &&
						typeof r.label === 'string'
				)
			: [];
	} catch {
		return [];
	}
}

function save() {
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify({ upcoming }, null, '\t') + '\n');
	renameSync(`${FILE}.tmp`, FILE);
}

/** what the screen shows: what's coming (soonest first) and what's going off */
export function reminderState() {
	return {
		upcoming: [...upcoming].sort((a, b) => a.at - b.at),
		ringing: [...ringing.values()].map((x) => x.r)
	};
}

function changed() {
	save();
	arm();
	notifyKiosk('reminders');
}

/**
 * Set one. `kid`: asked for with 🎤 (a timer up to 3 hours, a reminder later
 * today, not at bedtime). Returns the reminder, or why not (said to the kid).
 */
export function addReminder(
	kind: ReminderKind,
	at: number,
	label: string,
	{ kid = true } = {}
): { ok: true; reminder: Reminder } | { ok: false; why: string } {
	const now = Date.now();
	if (upcoming.length >= MAX_ACTIVE) return { ok: false, why: `There are already ${MAX_ACTIVE} timers and reminders. Let's wait for one to finish first.` };
	if (at <= now + 5_000)
		return { ok: false, why: kind === 'timer' ? "That's too short for a timer. Try at least 10 seconds." : 'That time has already gone by today.' };
	if (kind === 'timer' && at - now > MAX_TIMER_MINUTES * 60_000 + 1000)
		return { ok: false, why: "That's a very long timer! The longest I can do is 3 hours." };
	if (kid && kind === 'reminder') {
		if (new Date(at).toDateString() !== new Date(now).toDateString())
			return { ok: false, why: TODAY_ONLY };
		if (inBedtime(new Date(at), getConfig().bedtime)) return { ok: false, why: "That's during bedtime, when I keep quiet." };
	}
	const reminder: Reminder = { id: randomUUID().slice(0, 8), kind, at, label, made: now };
	upcoming.push(reminder);
	changed();
	console.log(`[reminders] set ${kind} for ${clockTime(at)}${label ? ` (${label})` : ''}`);
	return { ok: true, reminder };
}

/** Is a timer, reminder or alarm going off right now? */
export const isRinging = () => ringing.size > 0;

/** Take one off the list (not yet gone off). */
export function cancelReminder(id: string): Reminder | null {
	const r = upcoming.find((x) => x.id === id);
	if (!r) return null;
	upcoming = upcoming.filter((x) => x !== r);
	changed();
	return r;
}

/** Stop one going off (all of them with no id). */
export function stopRinging(id = '') {
	for (const [key, x] of ringing) {
		if (id && key !== id) continue;
		clearTimeout(x.timer);
		ringing.delete(key);
		const now = speaking();
		if (now && (x.said.has(now) || now.startsWith('tone:'))) stopSpeaking();
	}
	notifyKiosk('reminders');
}

/** "5 more minutes": stop it, and go off again in a little while. */
export function snooze(id: string): boolean {
	const x = ringing.get(id);
	if (!x) return false;
	stopRinging(id);
	upcoming.push({ ...x.r, id: randomUUID().slice(0, 8), at: Date.now() + SNOOZE_MINUTES * 60_000, made: Date.now() });
	changed();
	return true;
}

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms).unref());

/**
 * A wake-up alarm going off: `hello` is the first time's words (the good
 * morning, made by alarms.ts); after that it's "Time to wake up!".
 */
export async function ringAlarm(r: Reminder, hello: () => Promise<string> = async () => ringText(r)) {
	if (ringing.has(r.id)) return;
	const t = setTimeout(() => stopRinging(r.id), ALARM_MS);
	t.unref();
	const said = new Set<string>();
	ringing.set(r.id, { r, since: Date.now(), timer: t, said });
	notifyKiosk('reminders');
	console.log(`[alarms] ${r.label || 'alarm'} at ${clockTime(r.at)}`);
	for (let i = 0; ringing.has(r.id); i++) {
		if (i) await wait(ALARM_GAP_MS);
		if (!ringing.has(r.id) || !voiceInstalled()) return;
		// the first time a little softer
		const full = getVoice().alarmVolume;
		const volume = i ? full : Math.round(full * 0.75);
		await playTone('wake', volume).catch((err) => console.warn(`[alarms] ${err}`));
		if (!ringing.has(r.id)) return;
		const text = i ? ringText(r) : await hello().catch(() => ringText(r));
		said.add(text);
		await say(text, { volume }).catch((err) => console.warn(`[alarms] ${err}`));
	}
}

async function ring(r: Reminder) {
	if (r.kind === 'alarm') return ringAlarm(r);
	const quietNow = () => inBedtime(new Date(), getConfig().bedtime);
	const t = setTimeout(() => stopRinging(r.id), SHOW_MS);
	t.unref();
	const said = new Set([ringText(r)]);
	ringing.set(r.id, { r, since: Date.now(), timer: t, said });
	notifyKiosk('reminders');
	console.log(`[reminders] ${ringText(r)}${quietNow() ? ' (bedtime: no sound)' : ''}`);
	for (let i = 0; i < RINGS && ringing.has(r.id); i++) {
		if (i) await wait(RING_GAP_MS);
		// a kid in the middle of asking something: let them finish
		for (let n = 0; n < 6 && listening(); n++) await wait(5_000);
		if (!ringing.has(r.id) || quietNow() || !voiceOn() || getVoice().volume === 0) return;
		await say(ringText(r), { sound: 'alarm' }).catch((err) => console.warn(`[reminders] ${err}`));
	}
}

function tick() {
	const now = Date.now();
	const due = upcoming.filter((r) => r.at <= now);
	if (due.length) {
		upcoming = upcoming.filter((r) => r.at > now);
		save();
		for (const r of due) ring(r).catch((err) => console.warn(`[reminders] ${err}`));
	}
	arm();
}

/** wake up at the next one (at least once a minute, so a clock change is noticed) */
function arm() {
	if (!started) return;
	if (timer) clearTimeout(timer);
	const next = Math.min(...upcoming.map((r) => r.at), Date.now() + 60_000);
	timer = setTimeout(tick, Math.max(0, next - Date.now()));
	// never what keeps the server running (a restart must be able to finish)
	timer.unref();
}

/** At server start (hooks.server.ts). */
export function startReminders() {
	if (started || process.env.NODE_ENV === 'test') return;
	started = true;
	const now = Date.now();
	upcoming = load();
	// gone by while the server was off: a recent one still goes off, older ones are dropped
	const missed = upcoming.filter((r) => r.at < now - LATE_MS);
	if (missed.length) {
		console.warn(`[reminders] missed while off: ${missed.map((r) => ringText(r)).join(' ')}`);
		upcoming = upcoming.filter((r) => !missed.includes(r));
		save();
	}
	// a tap on the top button while one is going off stops it
	interceptTap(() => {
		if (!ringing.size) return false;
		stopRinging();
		return true;
	});
	tick();
}
