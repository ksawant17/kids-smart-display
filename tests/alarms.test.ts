import { describe, expect, it } from 'vitest';
import { dayKey, dayWord, nextRing, readAlarm, repeatLabel, timeLabel, wakeText, type Alarm } from '../src/lib/utils/alarms';

// Friday, Oct 30 2026, 8 PM
const fri = new Date(2026, 9, 30, 20, 0);
const alarm = (o: Partial<Alarm> = {}): Alarm => ({
	id: 'a',
	time: '06:45',
	label: '',
	repeat: 'daily',
	days: [],
	on: true,
	skip: null,
	...o
});
const key = (d: Date | null) => (d ? `${dayKey(d)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : null);

describe('nextRing', () => {
	it('follows the repeat rule', () => {
		expect(key(nextRing(alarm(), fri))).toBe('2026-10-31 6:45');
		expect(key(nextRing(alarm({ repeat: 'weekdays' }), fri))).toBe('2026-11-02 6:45');
		expect(key(nextRing(alarm({ repeat: 'weekends' }), fri))).toBe('2026-10-31 6:45');
		expect(key(nextRing(alarm({ repeat: 'days', days: [3] }), fri))).toBe('2026-11-04 6:45');
		expect(key(nextRing(alarm({ repeat: 'once', time: '21:00' }), fri))).toBe('2026-10-30 21:00');
		expect(nextRing(alarm({ on: false }), fri)).toBeNull();
	});
	it('skips days without school', () => {
		const noSchoolMonday = (k: string) => k !== '2026-11-02';
		expect(key(nextRing(alarm({ repeat: 'school' }), fri, noSchoolMonday))).toBe('2026-11-03 6:45');
	});
	it('leaves out a skipped morning', () => {
		expect(key(nextRing(alarm({ repeat: 'weekdays', skip: '2026-11-02' }), fri))).toBe('2026-11-03 6:45');
	});
	it('stays at 6:45 when the clocks go back (Nov 1)', () => {
		const sat = new Date(2026, 9, 31, 20, 0);
		const d = nextRing(alarm(), sat)!;
		expect([d.getHours(), d.getMinutes(), d.getDate()]).toEqual([6, 45, 1]);
	});
});

describe('readAlarm', () => {
	it('keeps a good one and tidies it', () => {
		expect(readAlarm({ id: 'x', time: '07:00', repeat: 'days', days: [5, 1, 1, 9], label: '  School  wake-up ' })).toEqual({
			id: 'x',
			time: '07:00',
			label: 'School wake-up',
			repeat: 'days',
			days: [1, 5],
			on: true,
			skip: null
		});
	});
	it('turns down a broken one', () => {
		expect(readAlarm({ id: 'x', time: '7am', repeat: 'daily' })).toBeNull();
		expect(readAlarm({ id: 'x', time: '07:00', repeat: 'sometimes' })).toBeNull();
		expect(readAlarm({ id: 'x', time: '07:00', repeat: 'days', days: [] })).toBeNull();
	});
});

describe('words', () => {
	it('label times, days and repeats', () => {
		expect(timeLabel('06:45')).toBe('6:45 AM');
		expect(timeLabel('00:05')).toBe('12:05 AM');
		expect(dayWord(new Date(2026, 9, 31, 6, 45), fri)).toBe('tomorrow');
		expect(dayWord(new Date(2026, 10, 2, 6, 45), fri)).toBe('Monday');
		expect(repeatLabel({ repeat: 'days', days: [1, 3, 5] })).toBe('Mon, Wed, Fri');
		expect(repeatLabel({ repeat: 'school', days: [] })).toBe('School days');
	});
	it('say good morning', () => {
		expect(wakeText(new Date(2026, 10, 2, 6, 45), "It's 48 degrees and cloudy.", "It's a school day.")).toBe(
			"Good morning! It's 6:45. It's 48 degrees and cloudy. It's a school day."
		);
		expect(wakeText(new Date(2026, 10, 2, 6, 45), '', "There's no school today.")).toBe(
			"Good morning! It's 6:45. There's no school today."
		);
	});
});
