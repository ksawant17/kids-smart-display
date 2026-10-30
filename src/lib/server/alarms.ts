/**
 * Wake-up alarms (utils/alarms.ts), kept in data/alarms.json and set in the
 * Grown-ups tab. Checked every 20 seconds on the server; one that comes due
 * goes off through reminders.ts (the banner, Stop / snooze, the top button).
 *
 * The good morning: "Good morning! It's 6:45. It's 48 degrees and cloudy.
 * Today's high is 60. It's a school day." (weather from the same forecast
 * as the hourly announcement, school from the school calendar).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { notifyKiosk } from '#lib/server/button';
import { ringAlarm } from '#lib/server/reminders';
import { getSchoolEvents } from '#lib/server/schoolFeed';
import { getWeather } from '#lib/server/weather';
import { getVoice, playTone, say } from '#lib/server/voice';
import { weatherNews } from '#lib/utils/announce';
import { dayStatus } from '#lib/utils/schoolCalendar';
import { MAX_ALARMS, dayKey, nextRing, readAlarm, schoolLine, wakeText, type Alarm } from '#lib/utils/alarms';

const FILE = resolve(process.env.DASHBOARD_DATA ?? 'data', 'alarms.json');
const CHECK_MS = 20_000;
const LATE_MS = 10 * 60_000; // missed while the server was down: still rung if this recent

interface Saved {
	alarms: Alarm[];
	/** alarm id -> the time it last went off (ms), so it never goes off twice */
	rang: Record<string, number>;
}

let timer: ReturnType<typeof setInterval> | null = null;
let checkedTo = 0;

function load(): Saved {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		const alarms = Array.isArray(s.alarms) ? s.alarms.map(readAlarm).filter((a: Alarm | null): a is Alarm => !!a) : [];
		const rang = s.rang && typeof s.rang === 'object' ? s.rang : {};
		return { alarms, rang };
	} catch {
		return { alarms: [], rang: {} };
	}
}

function save(s: Saved) {
	mkdirSync(dirname(FILE), { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify(s, null, '\t') + '\n');
	renameSync(`${FILE}.tmp`, FILE);
	notifyKiosk('reminders');
}

/** Is there school that day? (school-days alarms) */
async function schoolDays(): Promise<(key: string) => boolean> {
	const events = await getSchoolEvents().catch(() => []);
	return (key) => ['regular', 'early', 'special'].includes(dayStatus(events, key).kind);
}

/** every alarm with when it next goes off (ms; null: off) */
export async function listAlarms(now = new Date()): Promise<(Alarm & { next: number | null })[]> {
	const school = await schoolDays();
	return load().alarms.map((a) => ({ ...a, next: nextRing(a, now, school)?.getTime() ?? null }));
}

/** the next one to go off, for the idle screen ("⏰ 6:45 tomorrow") */
export async function nextAlarm(now = new Date()): Promise<{ at: number; label: string } | null> {
	const list = (await listAlarms(now)).filter((a) => a.next !== null).sort((a, b) => a.next! - b.next!);
	return list.length ? { at: list[0].next!, label: list[0].label } : null;
}

/** Add or change one (no id: a new one). Throws a message for the admin tab. */
export function saveAlarm(v: unknown): Alarm {
	const s = load();
	const raw = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
	const isNew = !raw.id;
	const alarm = readAlarm({ ...raw, id: isNew ? randomUUID().slice(0, 8) : raw.id });
	if (!alarm) throw new Error('That alarm is missing its time or days');
	if (isNew) {
		if (s.alarms.length >= MAX_ALARMS) throw new Error(`Up to ${MAX_ALARMS} alarms`);
		s.alarms.push(alarm);
	} else {
		const i = s.alarms.findIndex((a) => a.id === alarm.id);
		if (i < 0) throw new Error('That alarm is gone');
		s.alarms[i] = alarm;
	}
	// it only goes off from now on: 6:45 set at 6:45:10 waits for tomorrow
	s.rang[alarm.id] = Date.now();
	save(s);
	return alarm;
}

export function removeAlarm(id: string) {
	const s = load();
	s.alarms = s.alarms.filter((a) => a.id !== id);
	delete s.rang[id];
	save(s);
}

/** Leave out its next morning (or stop leaving it out). */
export async function skipNext(id: string, skip: boolean) {
	const school = await schoolDays();
	const s = load();
	const a = s.alarms.find((x) => x.id === id);
	if (!a) throw new Error('That alarm is gone');
	if (!skip) a.skip = null;
	else {
		const next = nextRing({ ...a, skip: null }, new Date(), school);
		a.skip = next ? dayKey(next) : null;
	}
	save(s);
}

/** "Good morning! It's 6:45. It's 48 degrees and cloudy. ... It's a school day." */
async function goodMorning(): Promise<string> {
	const now = new Date();
	const wx = await getWeather().catch(() => null);
	const weather = weatherNews(now, wx, { first: true, tomorrowFrom: -1 }).join(' ');
	const status = dayStatus(await getSchoolEvents().catch(() => []), dayKey(now)).kind;
	return wakeText(now, weather, schoolLine(['regular', 'early', 'special'].includes(status), status === 'weekend'));
}

/** The admin tab's "Try it": the tune and the good morning, at the alarm volume. */
export async function tryAlarm(): Promise<string> {
	const volume = getVoice().alarmVolume;
	await playTone('wake', volume);
	const text = await goodMorning();
	await say(text, { volume });
	return text;
}

async function check() {
	const now = Date.now();
	const from = new Date(checkedTo || now - LATE_MS);
	checkedTo = now;
	// read the file only after the wait: nothing can change it between here and save()
	const school = await schoolDays();
	const s = load();
	if (!s.alarms.some((a) => a.on)) return;
	let changed = false;
	for (const a of s.alarms) {
		const at = nextRing(a, from, school)?.getTime();
		if (!at || at > now || (s.rang[a.id] ?? 0) >= at) continue;
		s.rang[a.id] = at;
		if (a.repeat === 'once') a.on = false;
		changed = true;
		ringAlarm({ id: `${a.id}-${at}`, kind: 'alarm', at, label: a.label, made: now }, goodMorning).catch((err) =>
			console.warn(`[alarms] ${err}`)
		);
	}
	// a skipped morning that has gone by is forgotten
	const today = dayKey(new Date(now));
	for (const a of s.alarms) {
		if (a.skip && a.skip < today) {
			a.skip = null;
			changed = true;
		}
	}
	if (changed) save(s);
}

/** At server start (hooks.server.ts). */
export function startAlarms() {
	if (timer || process.env.NODE_ENV === 'test') return;
	const run = () => check().catch((err) => console.warn(`[alarms] ${err}`));
	run();
	timer = setInterval(run, CHECK_MS);
	// never what keeps the server running (a restart must be able to finish)
	timer.unref();
}

