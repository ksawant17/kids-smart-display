import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/lib/server/ai';

const sent: ChatMessage[][] = [];
vi.mock('#lib/server/ai', async (real) => ({
	...(await real<typeof import('../src/lib/server/ai')>()),
	chat: async (messages: ChatMessage[]) => {
		sent.push(messages);
		return `Answer ${sent.length}.`;
	}
}));
vi.mock('#lib/server/config', () => ({ getConfig: () => ({ kids: [{ name: 'Reya' }, { name: 'Neel' }] }) }));

const { answer, newConversation } = await import('../src/lib/server/ask');
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

	it('neither sends nor remembers a grown-up topic', async () => {
		await answer('Why is the sky blue?', null);
		const blocked = 'what is a gun';
		expect(await answer(blocked, null)).toMatch(/grown-up/);
		await answer('Why?', null);
		expect(sent).toHaveLength(2);
		expect(past(1)).not.toContain(blocked);
	});
});
