import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanText, contentId, kidSafe, suggestEmoji } from '../src/lib/utils/content';

describe('kidSafe filter', () => {
	it('lets ordinary kid-friendly lines through', () => {
		expect(kidSafe('There are a million ants for every person on Earth.', 'fact')).toBe(true);
		expect(kidSafe('A path is made by walking on it.', 'quote', 'Zhuangzi')).toBe(true);
		expect(kidSafe('Honey is the only natural food that is made without destroying any kind of life.', 'fact')).toBe(true);
	});

	it('blocks what the live sources actually sent (sampled Oct 2026)', () => {
		for (const t of [
			'Nutmeg is extremely poisonous if injected intravenously.',
			'In eighteenth-century English gambling dens, there was an employee whose only job was to swallow the dice.',
			'California has issued 6 drivers licenses to people named "Jesus Christ."',
			"Eskimos have over 15 words for the English word of 'Snow'",
			'In the Philippine jungle, the yo-yo was first used as a weapon.',
			'Life is growth. If we stop growing, technically and spiritually, we are as good as dead.',
			'I defeat my enemies when I make them my friends.'
		]) {
			expect(kidSafe(t, 'fact'), t).toBe(false);
		}
		expect(kidSafe('The strength of a wall is the courage of those who defend it.', 'quote', 'Genghis Khan')).toBe(false);
	});

	it('length and links', () => {
		expect(kidSafe('Too short', 'fact')).toBe(false);
		expect(kidSafe('x '.repeat(80), 'quote')).toBe(false);
		expect(kidSafe('See https://example.com for more fun facts!', 'fact')).toBe(false);
	});
});

describe('content helpers', () => {
	it('ids ignore case and punctuation', () => {
		expect(contentId('fact', 'Ants are strong!')).toBe(contentId('fact', 'ants are strong'));
		expect(contentId('fact', 'Ants are strong!')).not.toBe(contentId('quote', 'Ants are strong!'));
	});
	it('tidies text', () => {
		expect(cleanText('Mosquito repellents don`t   repel.  ')).toBe("Mosquito repellents don't repel.");
	});
	it('suggests a matching sticker', () => {
		expect(suggestEmoji('There are a million ants for every person.', 'fact')).toBe('1f41c');
		expect(suggestEmoji('Something plain.', 'quote')).toBe('1f31f');
		expect(suggestEmoji('Something plain.', 'fact')).toBe('1f4a1');
	});
});

describe('server: fetch, keep, skip', () => {
	let dir: string;
	beforeAll(() => {
		dir = mkdtempSync(join(tmpdir(), 'kids-content-'));
		vi.stubEnv('DASHBOARD_DATA', dir);
		vi.stubEnv('FACTS_PAUSE_MS', '0');
		let n = 0;
		const facts = [
			'Octopuses have three hearts and blue blood.', // blocked ("blood")
			'A group of owls is called a parliament.',
			'Sea otters hold hands when they sleep.'
		];
		vi.stubGlobal('fetch', async (url: string) => {
			const body = url.includes('zenquotes')
				? [
						{ q: 'A path is made by walking on it.', a: 'Zhuangzi' },
						{ q: 'Love your enemies, for they tell you your faults.', a: 'Benjamin Franklin' },
						{ q: 'Too many requests. Obtain an auth key.', a: 'zenquotes.io' }
					]
				: { text: facts[n++ % facts.length] };
			return new Response(JSON.stringify(body), { status: 200 });
		});
	});
	afterAll(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		rmSync(dir, { recursive: true, force: true });
	});

	it('only safe, new candidates wait; kept ones are served; skipped never return', async () => {
		const c = await import('../src/lib/server/content');
		await c.refill();
		let { pending } = c.getContent();
		expect(pending.filter((p) => p.kind === 'quote').map((p) => p.text)).toEqual(['A path is made by walking on it.']);
		expect(pending.filter((p) => p.kind === 'fact').map((p) => p.text).sort()).toEqual([
			'A group of owls is called a parliament.',
			'Sea otters hold hands when they sleep.'
		]);

		const quote = pending.find((p) => p.kind === 'quote')!;
		const otters = pending.find((p) => p.text.startsWith('Sea otters'))!;
		c.decide(quote.id, true, '1f463');
		c.decide(otters.id, false);
		expect(c.getKept().quotes).toEqual([
			{ id: quote.id, text: quote.text, author: 'Zhuangzi', emoji: '1f463', source: 'zenquotes' }
		]);
		expect(c.getKept().facts).toEqual([]);

		await c.refill();
		pending = c.getContent().pending;
		expect(pending.map((p) => p.text)).toEqual(['A group of owls is called a parliament.']);

		c.removeKept(quote.id);
		expect(c.getKept().quotes).toEqual([]);
	});
});
