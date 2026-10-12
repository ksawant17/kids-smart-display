/**
 * Minimal iCalendar (RFC 5545) VEVENT reader — just what the school key-dates
 * feed needs: DTSTART / DTEND / SUMMARY. All-day events only care about the
 * date, so times are reduced to their YYYY-MM-DD part.
 */

export interface IcsEvent {
	/** YYYY-MM-DD */
	start: string;
	/** YYYY-MM-DD, INCLUSIVE last day (iCal DTEND for all-day events is exclusive) */
	end: string;
	summary: string;
}

/** Undo RFC 5545 line folding (CRLF + space/tab continues the previous line). */
function unfold(text: string): string[] {
	return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function unescapeText(v: string): string {
	return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** "20260824" or "20260824T080000Z" -> "2026-08-24" */
function toKey(v: string): string | null {
	const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
	return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function addDays(key: string, days: number): string {
	const [y, m, d] = key.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d + days));
	return dt.toISOString().slice(0, 10);
}

export function parseIcs(text: string): IcsEvent[] {
	const events: IcsEvent[] = [];
	let cur: { start?: string; end?: string; endIsDate?: boolean; summary?: string } | null = null;

	for (const line of unfold(text)) {
		if (line === 'BEGIN:VEVENT') {
			cur = {};
			continue;
		}
		if (line === 'END:VEVENT') {
			if (cur?.start && cur.summary) {
				let end = cur.start;
				if (cur.end) {
					// all-day DTEND is exclusive; a timed DTEND is the actual end
					end = cur.endIsDate ? addDays(cur.end, -1) : cur.end;
					if (end < cur.start) end = cur.start;
				}
				events.push({ start: cur.start, end, summary: cur.summary });
			}
			cur = null;
			continue;
		}
		if (!cur) continue;

		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const [name, ...params] = line.slice(0, colon).split(';');
		const value = line.slice(colon + 1);
		const isDate = params.some((p) => p.toUpperCase() === 'VALUE=DATE') || /^\d{8}$/.test(value.trim());

		switch (name.toUpperCase()) {
			case 'DTSTART':
				cur.start = toKey(value) ?? undefined;
				break;
			case 'DTEND':
				cur.end = toKey(value) ?? undefined;
				cur.endIsDate = isDate;
				break;
			case 'SUMMARY':
				cur.summary = unescapeText(value);
				break;
		}
	}
	return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}
