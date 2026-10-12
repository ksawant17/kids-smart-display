import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
	agendaItem,
	covers,
	eventOn,
	fromIcs,
	monthMarks,
	todayStatus,
	upNext,
	type SchoolEvent
} from '../src/lib/utils/schoolCalendar';
import { parseIcs } from '../src/lib/utils/ics';

const events: SchoolEvent[] = [
	{ date: '2026-08-24', title: 'First Day of School', subtitle: 'Welcome back!', type: 'first_day' },
	{ date: '2026-10-12', title: 'Staff Development Day', subtitle: 'No School', type: 'no_school' },
	{ date: '2026-10-30', title: '2-Hour Early Release', subtitle: 'End of First Quarter', type: 'early_release' },
	{ date: '2026-11-25', endDate: '2026-11-27', title: 'Thanksgiving Break', subtitle: 'No School', type: 'no_school' },
	{ date: '2026-12-21', endDate: '2027-01-01', title: 'Winter Break', subtitle: 'No School', type: 'no_school' },
	{ date: '2027-06-16', title: 'Last Day of School', subtitle: 'Early release — summer starts!', type: 'last_day', early: true }
];

describe('fromIcs (feed summary -> kid-friendly event)', () => {
	const ev = (summary: string, start = '2026-10-12', end = start) => fromIcs({ start, end, summary });

	it('uses the specific holiday name in parentheses', () => {
		expect(ev('Holiday (Yom Kippur)')).toMatchObject({ title: 'Yom Kippur', type: 'no_school' });
		expect(ev('Student Holiday (Teacher Workday)')).toMatchObject({ title: 'Teacher Workday', type: 'no_school' });
	});

	it('keeps the outer name when the parentheses are generic', () => {
		expect(ev('Labor Day Break (Holiday)', '2026-09-04', '2026-09-07')).toMatchObject({
			title: 'Labor Day Break',
			endDate: '2026-09-07',
			type: 'no_school'
		});
		expect(ev('Holidays (Winter Break)')).toMatchObject({ title: 'Winter Break' });
	});

	it('maps early releases with the reason as subtitle', () => {
		expect(ev('End of First Quarter - Two-Hour Early Release')).toMatchObject({
			title: '2-Hour Early Release',
			subtitle: 'End of First Quarter',
			type: 'early_release'
		});
	});

	it('maps first / last day (last day is also an early release)', () => {
		expect(ev('First Day of School').type).toBe('first_day');
		expect(ev('Last Day of School (Early Release)')).toMatchObject({ type: 'last_day', early: true });
	});

	it('treats a standalone teacher workday as no school', () => {
		expect(ev('Teacher Workday').type).toBe('no_school');
	});

	it('maps the bundled district snapshot: Yom Kippur and Eid are days off', () => {
		const text = readFileSync('src/lib/data/school-calendar.seed.ics', 'utf8');
		const all = parseIcs(text).map(fromIcs);
		expect(all.length).toBeGreaterThan(10);
		expect(eventOn(all, '2026-09-21')?.type).toBe('no_school'); // Yom Kippur
		expect(eventOn(all, '2027-03-09')?.type).toBe('no_school'); // Eid al-Fitr
		expect(all.find((e) => e.type === 'first_day')?.date).toBe('2026-08-24');
		expect(all.every((e) => e.title.length > 0)).toBe(true);
	});
});

describe('covers / eventOn', () => {
	it('matches multi-day ranges inclusively', () => {
		expect(covers(events[3], '2026-11-25')).toBe(true);
		expect(covers(events[3], '2026-11-27')).toBe(true);
		expect(covers(events[3], '2026-11-28')).toBe(false);
	});

	it('prefers no-school over other events on the same day', () => {
		const extra: SchoolEvent = { date: '2026-11-26', title: 'Bake Sale', subtitle: '', type: 'event' };
		expect(eventOn([extra, ...events], '2026-11-26')?.title).toBe('Thanksgiving Break');
	});
});

describe('monthMarks', () => {
	it('marks no-school red, early release yellow, first day green', () => {
		const oct = monthMarks(events, 2026, 9);
		expect(oct.get('2026-10-12')).toBe('holiday');
		expect(oct.get('2026-10-30')).toBe('early');
		expect(oct.get('2026-10-07')).toBeUndefined();
		expect(monthMarks(events, 2026, 7).get('2026-08-24')).toBe('milestone');
		expect(monthMarks(events, 2027, 5).get('2027-06-16')).toBe('early');
	});
});

describe('agendaItem', () => {
	it('single no-school day -> "No School" with the reason as subtitle', () => {
		expect(agendaItem(events[1])).toMatchObject({ title: 'No School', subtitle: 'Staff Development Day', kind: 'no-school' });
	});

	it('multi-day break shows its date range', () => {
		expect(agendaItem(events[3])).toMatchObject({ kind: 'break', subtitle: 'Nov 25 - Nov 27', ongoing: false });
	});

	it('a break that is already happening says when it ends', () => {
		expect(agendaItem(events[4], '2026-12-28')).toMatchObject({ ongoing: true, subtitle: 'Now — back after Jan 1' });
	});
});

describe('upNext', () => {
	it('returns upcoming events sorted and capped', () => {
		expect(upNext(events, '2026-10-07', 3).map((n) => n.date)).toEqual(['2026-10-12', '2026-10-30', '2026-11-25']);
	});

	it('keeps a break that is still going (regression: it used to vanish)', () => {
		const next = upNext(events, '2026-12-28', 2);
		expect(next[0]).toMatchObject({ title: 'Winter Break', ongoing: true });
	});

	it('excludes finished events', () => {
		expect(upNext(events, '2027-06-17', 4)).toHaveLength(0);
	});
});

describe('todayStatus', () => {
	it('a normal weekday is a school day, with the next day off', () => {
		const s = todayStatus(events, '2026-10-07'); // Wednesday
		expect(s.kind).toBe('regular');
		expect(s.subtitle).toBe('Next day off: Mon, Oct 12');
	});

	it('weekends are not school days (regression)', () => {
		expect(todayStatus(events, '2026-10-10').kind).toBe('weekend'); // Saturday
		expect(todayStatus(events, '2026-10-11').kind).toBe('weekend'); // Sunday
	});

	it('reports no-school and early-release days', () => {
		expect(todayStatus(events, '2026-10-12')).toMatchObject({ kind: 'no-school', subtitle: 'Staff Development Day' });
		expect(todayStatus(events, '2026-10-30')).toMatchObject({ kind: 'early', title: 'Early Release!' });
	});

	it('a break covering a weekend shows the break', () => {
		expect(todayStatus(events, '2026-12-26')).toMatchObject({ kind: 'no-school', subtitle: 'Winter Break' }); // Saturday
	});

	it('summer: before the first day and after the last day', () => {
		expect(todayStatus(events, '2026-08-10')).toMatchObject({ kind: 'summer', subtitle: 'Back to school Mon, Aug 24' });
		expect(todayStatus(events, '2027-07-01')).toMatchObject({ kind: 'summer', subtitle: 'Have a great summer!' });
	});

	it('last day of school', () => {
		expect(todayStatus(events, '2027-06-16')).toMatchObject({ kind: 'early', title: 'Last Day of School!' });
	});
});
