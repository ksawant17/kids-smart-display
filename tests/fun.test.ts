import { describe, expect, it } from 'vitest';
import { mathPuzzle } from '../src/lib/utils/mathPuzzle';
import jokes from '../src/lib/data/jokes.json';
import words from '../src/lib/data/words.json';

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

describe('joke + word data', () => {
	it('jokes have a question, an answer and an icon', () => {
		expect(jokes.length).toBeGreaterThanOrEqual(30);
		for (const j of jokes) expect(j.q.endsWith('?') && j.a.length > 2 && j.emoji).toBeTruthy();
	});

	it('words have everything the card shows, and the sentence uses the word', () => {
		expect(words.length).toBeGreaterThanOrEqual(30);
		for (const w of words) {
			expect(w.word && w.say && w.emoji && w.meaning).toBeTruthy();
			expect(w.sentence.toLowerCase()).toContain(w.word.slice(0, 5).toLowerCase());
		}
	});
});
