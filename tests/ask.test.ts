import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/lib/server/ai';

const sent: ChatMessage[][] = [];
vi.mock('#lib/server/ai', async (real) => ({
	...(await real<typeof import('../src/lib/server/ai')>()),
	chat: async (messages: ChatMessage[]) => {
		// the timer / reminder helper: one action as JSON
		if (messages[0].content.startsWith('You turn what a child said')) return '{"action":"list"}';
		sent.push(messages);
		return `Answer ${sent.length}.`;
	}
}));
vi.mock('#lib/server/config', () => ({ getConfig: () => ({ kids: [{ name: 'Alex' }, { name: 'Sam' }] }) }));
const added: { kind: string; at: number; label: string }[] = [];
vi.mock('#lib/server/reminders', () => ({
	addReminder: (kind: 'timer' | 'reminder', at: number, label: string) => {
		added.push({ kind, at, label });
		return { ok: true, reminder: { id: 'r1', kind, at, label, made: Date.now() } };
	},
	cancelReminder: () => null,
	reminderState: () => ({ upcoming: [], ringing: [] })
}));

const { answer, newConversation, reminderAnswer } = await import('../src/lib/server/ask');
const past = (i: number) => sent[i].filter((m) => m.role !== 'system').map((m) => m.content);

describe('Ask: the conversation', () => {
	beforeEach(() => {
		sent.length = 0;
		newConversation();
		vi.useRealTimers();
	});

	it('sends what was said before with a follow-up', async () => {
		await answer('Why is the sky blue?', null);
		await answer('Why?', null);
		expect(past(1)).toEqual(['Why is the sky blue?', 'Answer 1.', 'Why?']);
	});

	it('starts again for a new conversation', async () => {
		await answer('Why is the sky blue?', null);
		newConversation();
		await answer('What is 7 times 8?', null);
		expect(past(1)).toEqual(['What is 7 times 8?']);
	});

	it('keeps only the last 8 questions and answers', async () => {
		for (let i = 0; i < 10; i++) await answer(`Question ${i}?`, null);
		const before = past(10 - 1).slice(0, -1);
		expect(before).toHaveLength(16);
		expect(before[0]).toBe('Question 1?');
	});

	it('forgets after a few quiet minutes', async () => {
		vi.useFakeTimers();
		await answer('Why is the sky blue?', null);
		vi.advanceTimersByTime(6 * 60_000);
		await answer('Why?', null);
		expect(past(1)).toEqual(['Why?']);
	});

	it('tells the AI the weather right now, apart from the day', async () => {
		await answer("What's the weather?", null, '69°F, feels like 67°F, sunny, wind 5 mph');
		expect(sent[0][0].content).toContain('The weather right now (the big number on the screen): 69°F, feels like 67°F');
	});

	it('neither sends nor remembers a grown-up topic', async () => {
		await answer('Why is the sky blue?', null);
		const blocked = 'what is a gun';
		expect(await answer(blocked, null)).toMatch(/grown-up/);
		await answer('Why?', null);
		expect(sent).toHaveLength(2);
		expect(past(1)).not.toContain(blocked);
	});
});

describe('Ask: timers and reminders', () => {
	it('sets a plain timer without asking the AI', async () => {
		const before = sent.length;
		const r = await reminderAnswer('Set a timer for 10 minutes');
		expect(sent.length).toBe(before);
		expect(r?.undo).toBe('r1');
		expect(r?.answer).toBe('OK! A timer for 10 minutes, starting now.');
		expect(added.at(-1)?.kind).toBe('timer');
	});
	it('answers "how long is left" from the list', async () => {
		expect(await reminderAnswer('how long is left on my timer?')).toEqual({ answer: "There aren't any timers or reminders right now." });
	});
	it('leaves other questions alone', async () => {
		expect(await reminderAnswer('Why is the sky blue?')).toBeNull();
	});
});
