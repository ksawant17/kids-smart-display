import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanText, contentId, kidSafe, splitJoke, suggestEmoji } from '../src/lib/utils/content';

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

describe('jokes from the internet', () => {
	it('splits one-line dad jokes into question and answer', () => {
		expect(splitJoke("What do you call a fake noodle? An impasta!")).toEqual({ q: 'What do you call a fake noodle?', a: 'An impasta!' });
		expect(splitJoke("What's large, grey, and doesn't matter?\nAn irrelephant.")).toEqual({
			q: "What's large, grey, and doesn't matter?",
			a: 'An irrelephant.'
		});
		expect(splitJoke('I only have my shelf to blame.')).toBeNull();
	});

	it('keeps kid jokes, drops grown-up ones (sampled from JokeAPI / icanhazdadjoke)', () => {
		expect(kidSafe('Why are fish easy to weigh?', 'joke', 'Because they have their own scales.')).toBe(true);
		expect(kidSafe('Why do front end developers eat lunch alone?', 'joke', "Because they don't know how to join tables.")).toBe(false);
		expect(kidSafe('My boss told me to have a good day...', 'joke', 'so I went home.')).toBe(false);
		expect(kidSafe('How did Harry Potter get down the hill?', 'joke', 'Walking...\nJK, Rolling.')).toBe(false);
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
			if (url.includes('jokeapi'))
				return new Response(
					JSON.stringify({
						jokes: [
							{ setup: 'Why are fish easy to weigh?', delivery: 'They have their own scales.' },
							{ setup: 'How did Harry Potter get down the hill?', delivery: 'Walking...\nJK, Rolling.' }
						]
					})
				);
			if (url.includes('icanhazdadjoke'))
				return new Response(JSON.stringify({ results: [{ joke: 'What do you call a fake noodle? An impasta!' }, { joke: 'I only have my shelf to blame.' }] }));
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
		// jokes: the multi-line one and the one that isn't a question are dropped
		expect(pending.filter((p) => p.kind === 'joke').map((p) => `${p.text} ${p.answer}`).sort()).toEqual([
			'What do you call a fake noodle? An impasta!',
			'Why are fish easy to weigh? They have their own scales.'
		]);
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
		pending = c.getContent().pending.filter((p) => p.kind !== 'joke');
		expect(pending.map((p) => p.text)).toEqual(['A group of owls is called a parliament.']);

		c.removeKept(quote.id);
		expect(c.getKept().quotes).toEqual([]);
	});
});
