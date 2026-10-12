import { describe, expect, it } from 'vitest';
import { parseIcs } from '../src/lib/utils/ics';

const FEED = [
	'BEGIN:VCALENDAR',
	'BEGIN:VEVENT',
	'DTSTART;VALUE=DATE:20261125',
	'DTEND;VALUE=DATE:20261128',
	'SUMMARY:Holidays (Thanksgiving Break)',
	'URL;VALUE=URI:https://example.com/?t',
	' ype=key_date',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'DTSTART;VALUE=DATE:20270618',
	'DTEND;VALUE=DATE:20270619',
	'SUMMARY:Holiday (Juneteenth\\, Observed)',
	'END:VEVENT',
	'BEGIN:VEVENT',
	'DTSTART:20261030T120000Z',
	'DTEND:20261030T140000Z',
	'SUMMARY:Timed ev',
	' ent',
	'END:VEVENT',
	'END:VCALENDAR'
].join('\r\n');

describe('parseIcs', () => {
	const evs = parseIcs(FEED);

	it('reads every VEVENT, sorted by start', () => {
		expect(evs.map((e) => e.start)).toEqual(['2026-10-30', '2026-11-25', '2027-06-18']);
	});

	it('turns the exclusive all-day DTEND into an inclusive last day', () => {
		expect(evs[1]).toMatchObject({ start: '2026-11-25', end: '2026-11-27' });
		expect(evs[2]).toMatchObject({ start: '2027-06-18', end: '2027-06-18' });
	});

	it('unescapes text and unfolds long lines', () => {
		expect(evs[2].summary).toBe('Holiday (Juneteenth, Observed)');
		expect(evs[0].summary).toBe('Timed event');
	});

	it('ignores non-calendar text', () => {
		expect(parseIcs('<!DOCTYPE html><html></html>')).toEqual([]);
	});
});
