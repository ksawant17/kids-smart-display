import { describe, expect, it } from 'vitest';
import { mathPuzzle } from '../src/lib/utils/mathPuzzle';
import jokes from '../src/lib/data/jokes.json';
import words from '../src/lib/data/words.json';
import facts from '../src/lib/data/facts.json';
import quotes from '../src/lib/data/quotes.json';

describe('mathPuzzle', () => {
	it('is the same for the same seed (whole family gets one puzzle a day)', () => {
		expect(mathPuzzle(20737, 'easy')).toEqual(mathPuzzle(20737, 'easy'));
	});

	it('always has 3 different, non-negative choices including the answer', () => {
		for (let seed = 0; seed < 300; seed++) {
			for (const level of ['easy', 'tricky'] as const) {
				const p = mathPuzzle(seed, level);
				expect(p.choices).toHaveLength(3);
				expect(new Set(p.choices).size).toBe(3);
				expect(p.choices).toContain(p.answer);
				expect(p.choices.every((c) => c >= 0)).toBe(true);
			}
		}
	});

	it('answers are actually right', () => {
		for (let seed = 0; seed < 300; seed++) {
			for (const level of ['easy', 'tricky'] as const) {
				const { question, answer } = mathPuzzle(seed, level);
				const expr = question.replace('×', '*').replace('−', '-');
				if (expr.startsWith('?')) {
					const [, a, total] = expr.match(/\? \+ (\d+) = (\d+)/)!.map(Number);
					expect(answer + a).toBe(total);
				} else {
					// eslint-disable-next-line no-new-func
					expect(Function(`return ${expr.replace('= ?', '')}`)()).toBe(answer);
				}
			}
		}
	});

	it('easy stays within 20', () => {
		for (let seed = 0; seed < 300; seed++) expect(mathPuzzle(seed, 'easy').answer).toBeLessThanOrEqual(20);
	});
});

describe('built-in lists: big enough, no repeats, everything the cards show', () => {
	const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
	const unique = (xs: string[]) => new Set(xs.map(norm)).size === xs.length;

	it('no duplicates', () => {
		expect(unique(jokes.map((j) => j.q))).toBe(true);
		expect(unique(words.map((w) => w.word))).toBe(true);
		expect(unique(facts.map((f) => f.text))).toBe(true);
		expect(unique(quotes.map((q) => q.text))).toBe(true);
	});

	it('facts and quotes', () => {
		expect(facts.length).toBeGreaterThanOrEqual(140);
		for (const f of facts) expect(f.text.length > 10 && f.emoji.length >= 1).toBe(true);
		expect(quotes.length).toBeGreaterThanOrEqual(100);
		for (const q of quotes) expect(q.text.length > 5 && q.author.length > 2 && !!q.emoji).toBe(true);
	});
});

describe('joke + word data', () => {
	it('jokes have a question, an answer and an icon', () => {
		expect(jokes.length).toBeGreaterThanOrEqual(140);
		for (const j of jokes) expect(j.q.endsWith('?') && j.a.length > 2 && j.emoji).toBeTruthy();
	});

	it('words have everything the card shows, and the sentence uses the word', () => {
		expect(words.length).toBeGreaterThanOrEqual(100);
		for (const w of words) {
			expect(w.word && w.say && w.emoji && w.meaning).toBeTruthy();
			expect(w.sentence.toLowerCase()).toContain(w.word.slice(0, 5).toLowerCase());
		}
	});
});
