/**
 * School key dates from the district's iCal feed (config.school.icsUrl).
 *
 * Lookup order, so the kiosk always has a calendar:
 *   1. in-memory copy (refreshed every config.school.refreshHours, in the background)
 *   2. live feed           -> saved to data/school-calendar.ics on success
 *   3. last saved feed     (data/school-calendar.ics, survives restarts/offline boots)
 *   4. bundled snapshot    (src/lib/data/school-calendar.seed.ics)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import seed from '#lib/data/school-calendar.seed.ics?raw';
import { getConfig } from './config';
import { parseIcs } from '#lib/utils/ics';
import { fromIcs, type SchoolEvent } from '#lib/utils/schoolCalendar';

const SAVED = resolve(process.env.DASHBOARD_DATA ?? 'data', 'school-calendar.ics');

let memo: { at: number; url: string; events: SchoolEvent[] } | null = null;
let inflight: Promise<SchoolEvent[]> | null = null;

function toEvents(text: string): SchoolEvent[] | null {
	if (!text.includes('BEGIN:VCALENDAR')) return null;
	const events = parseIcs(text).map(fromIcs);
	return events.length ? events : null;
}

function fromDisk(): SchoolEvent[] {
	try {
		const saved = toEvents(readFileSync(SAVED, 'utf8'));
		if (saved) return saved;
	} catch {
		/* no saved copy yet */
	}
	return toEvents(seed) ?? [];
}

async function refresh(url: string): Promise<SchoolEvent[]> {
	try {
		const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		const events = toEvents(text);
		if (!events) throw new Error('response is not an iCal feed');
		try {
			mkdirSync(dirname(SAVED), { recursive: true });
			writeFileSync(SAVED, text);
		} catch (err) {
			console.warn(`[school] could not save ${SAVED}: ${err}`);
		}
		memo = { at: Date.now(), url, events };
		return events;
	} catch (err) {
		console.warn(`[school] feed refresh failed (${err}); using saved calendar`);
		const events = memo?.url === url ? memo.events : fromDisk();
		// retry in 30 min rather than hammering the feed
		const retryAt = Date.now() - getConfig().school.refreshHours * 3600_000 + 30 * 60_000;
		memo = { at: retryAt, url, events };
		return events;
	} finally {
		inflight = null;
	}
}

export async function getSchoolEvents(): Promise<SchoolEvent[]> {
	const { icsUrl, refreshHours } = getConfig().school;
	const fresh = memo && memo.url === icsUrl && Date.now() - memo.at < refreshHours * 3600_000;
	if (fresh) return memo!.events;

	inflight ??= refresh(icsUrl);
	// Have something already? Serve it now and let the refresh finish in the background.
	if (memo?.url === icsUrl) return memo.events;
	return inflight;
}
