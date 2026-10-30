import { describe, expect, it } from 'vitest';
import {
	aboutReminders,
	cleanLabel,
	confirmation,
	duration,
	listText,
	pickToCancel,
	quickTimer,
	readIntent,
	ringText,
	type Reminder
} from '../src/lib/utils/reminders';

const now = new Date(2026, 9, 30, 15, 0, 0);
const r = (kind: Reminder['kind'], minutes: number, label = ''): Reminder => ({
	id: label || kind,
	kind,
	at: now.getTime() + minutes * 60_000,
	label,
	made: now.getTime()
});

describe('aboutReminders', () => {
	it('spots timer and reminder talk only', () => {
		expect(aboutReminders('Set a timer for 10 minutes')).toBe(true);
		expect(aboutReminders('remind me at 4 to feed the fish')).toBe(true);
		expect(aboutReminders('How long is left?')).toBe(true);
		expect(aboutReminders('Why is the sky blue?')).toBe(false);
		expect(aboutReminders('What time is it?')).toBe(false);
	});
});

describe('quickTimer', () => {
	it('understands the usual ways of asking', () => {
		expect(quickTimer('Set a timer for 10 minutes.')).toEqual({ seconds: 600, label: '' });
		expect(quickTimer('a 5 minute timer')).toEqual({ seconds: 300, label: '' });
		expect(quickTimer('Timer for one hour')).toEqual({ seconds: 3600, label: '' });
		expect(quickTimer('set a timer for half an hour')).toEqual({ seconds: 1800, label: '' });
		expect(quickTimer('timer for 30 seconds')).toEqual({ seconds: 30, label: '' });
		expect(quickTimer('Set a timer for two minutes for teeth brushing')).toEqual({ seconds: 120, label: 'teeth brushing' });
	});
	it('leaves the rest to the AI', () => {
		expect(quickTimer('cancel the timer')).toBeNull();
		expect(quickTimer('how long is left on the timer')).toBeNull();
		expect(quickTimer('remind me in 10 minutes')).toBeNull();
		expect(quickTimer('set a timer')).toBeNull();
	});
});

describe('readIntent', () => {
	it('takes a good answer', () => {
		expect(readIntent({ action: 'timer', minutes: 2.5, label: 'eggs' }, now)).toEqual({ action: 'timer', seconds: 150, label: 'eggs' });
		const rem = readIntent({ action: 'reminder', time: '16:30', label: 'feed the fish' }, now);
		expect(rem).toEqual({ action: 'reminder', at: new Date(2026, 9, 30, 16, 30).getTime(), label: 'feed the fish' });
		expect(readIntent({ action: 'reminder', minutes: 20, label: 'drink water' }, now)).toEqual({
			action: 'reminder',
			at: new Date(2026, 9, 30, 15, 20).getTime(),
			label: 'drink water'
		});
		expect(readIntent({ action: 'list' }, now)).toEqual({ action: 'list' });
	});
	it('turns anything odd into none', () => {
		expect(readIntent(null, now)).toEqual({ action: 'none' });
		expect(readIntent({ action: 'timer', minutes: -3 }, now)).toEqual({ action: 'none' });
		expect(readIntent({ action: 'reminder', time: '25:00' }, now)).toEqual({ action: 'none' });
		expect(readIntent({ action: 'reboot' }, now)).toEqual({ action: 'none' });
	});
});

describe('labels', () => {
	it('are tidied and kept short', () => {
		expect(cleanLabel('  to feed the fish!! 🐟 ')).toBe('feed the fish!!');
		expect(cleanLabel('<b>x</b>')).toBe('b x b');
		expect(cleanLabel(42)).toBe('');
		expect(cleanLabel('a'.repeat(100))).toHaveLength(60);
	});
});

describe('words', () => {
	it('say durations', () => {
		expect(duration(30)).toBe('30 seconds');
		expect(duration(60)).toBe('1 minute');
		expect(duration(3900)).toBe('1 hour and 5 minutes');
		expect(duration(7200)).toBe('2 hours');
	});
	it('confirm, ring and list', () => {
		expect(confirmation(r('timer', 10, 'teeth brushing'), now.getTime())).toBe('OK! 10 minutes for teeth brushing, starting now.');
		expect(confirmation(r('reminder', 90, 'feed the fish'), now.getTime())).toBe("OK! I'll remind you at 4:30 PM to feed the fish.");
		expect(ringText(r('timer', 0))).toBe("Time's up!");
		expect(ringText(r('reminder', 0, 'feed the fish'))).toBe('Reminder: time to feed the fish!');
		expect(listText([], now.getTime())).toBe("There aren't any timers or reminders right now.");
		expect(listText([r('timer', 4, 'eggs'), r('reminder', 60, 'call grandma')], now.getTime())).toBe(
			'The eggs timer has 4 minutes left. The reminder to call grandma is at 4:00 PM.'
		);
	});
});

describe('pickToCancel', () => {
	const list = [r('timer', 4, 'eggs'), r('reminder', 60, 'feed the fish')];
	it('finds the one meant', () => {
		expect(pickToCancel([list[0]], '')).toBe(list[0]);
		expect(pickToCancel(list, 'the fish one')).toBe(list[1]);
		expect(pickToCancel(list, '')).toBeNull();
		expect(pickToCancel(list, 'pizza')).toBeNull();
	});
});
