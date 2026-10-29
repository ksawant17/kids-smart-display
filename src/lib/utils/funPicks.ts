/**
 * Today's dino, joke, word and fact: the same picks on FUN and on TODAY's fun
 * strip. Each list rotates daily from its own starting point (`salt`), and
 * "Another!" on FUN steps on from there (`n`).
 */
import facts from '#lib/data/facts.json';
import dinos from '#lib/data/dinos.json';
import jokes from '#lib/data/jokes.json';
import words from '#lib/data/words.json';
import type { Dino } from '#lib/utils/dino';
import type { KeptContent } from '#lib/utils/content';

export type Corner = 'dino' | 'joke' | 'word' | 'math' | 'fact' | 'story';
export const CORNER_IDS: Corner[] = ['dino', 'joke', 'word', 'math', 'fact', 'story'];
export const isCorner = (v: unknown): v is Corner => CORNER_IDS.includes(v as Corner);

const SALT = { dino: 0, joke: 3, word: 11, fact: 7 };
const at = <T>(list: T[], salt: number, day: number, n: number) => list[(day + salt + n) % list.length];

/** `kept`: what a grown-up kept (Grown-ups tab -> New Content), added to the built-in lists */
export function funPicks(day: number, kept: KeptContent, extra = { dino: 0, joke: 0, word: 0, fact: 0 }) {
	return {
		dino: at(dinos as Dino[], SALT.dino, day, extra.dino),
		joke: at([...jokes, ...kept.jokes], SALT.joke, day, extra.joke),
		word: at([...words, ...kept.words], SALT.word, day, extra.word),
		fact: at([...facts, ...kept.facts], SALT.fact, day, extra.fact)
	};
}
