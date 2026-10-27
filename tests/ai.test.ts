import { describe, expect, it } from 'vitest';
import { aiTextOk, parseJson } from '#lib/server/ai';
import { readFacts } from '#lib/server/briefing';
import { wordSafe } from '#lib/utils/content';
import { isStoryPlace, isStoryTheme } from '#lib/utils/story';

describe('parseJson', () => {
	it('reads plain JSON, fenced JSON and JSON with chatter around it', () => {
		expect(parseJson('[{"q":"a?","a":"b"}]')).toEqual([{ q: 'a?', a: 'b' }]);
		expect(parseJson('```json\n["x", "y"]\n```')).toEqual(['x', 'y']);
		expect(parseJson('Sure! Here it is: {"title": "T", "paragraphs": ["p"]} Enjoy!')).toEqual({
			title: 'T',
			paragraphs: ['p']
		});
	});
	it('throws when there is no JSON', () => {
		expect(() => parseJson('no json here')).toThrow();
	});
});

describe('aiTextOk', () => {
	it('lets gentle text through and stops blocked words and links', () => {
		expect(aiTextOk('Bring a jacket today, it will be chilly at recess!')).toBe(true);
		expect(aiTextOk('The dragon wanted to kill the knight.')).toBe(false);
		expect(aiTextOk('Visit https://example.com for more')).toBe(false);
	});
});

describe('wordSafe', () => {
	it('takes one plain word with a short meaning and sentence', () => {
		expect(wordSafe('glimmer', 'GLIM-er', 'a faint, wavy light', 'A glimmer of light came from the cave.')).toBe(true);
	});
	it('refuses phrases, long meanings and blocked words', () => {
		expect(wordSafe('ice cream', 'ICE kreem', 'a cold treat', 'We ate ice cream at the park.')).toBe(false);
		expect(wordSafe('vast', 'VAST', 'x'.repeat(90), 'The ocean is vast and deep and blue.')).toBe(false);
		expect(wordSafe('deadly', 'DED-lee', 'able to cause harm', 'Some snakes are deadly to mice.')).toBe(false);
	});
});

describe('readFacts', () => {
	it('tidies and caps the facts the kiosk sends', () => {
		const f = readFacts({ when: 'today', dayName: 'Monday', weather: ' Sunny,   high 70 ', school: 'School day', wear: 'T-shirt' });
		expect(f).toMatchObject({ when: 'today', weather: 'Sunny, high 70', note: undefined });
		expect(readFacts({ when: 'today', weather: 'x'.repeat(500) })!.weather.length).toBe(160);
	});
	it('refuses a body without a day or weather', () => {
		expect(readFacts({ when: 'someday', weather: 'Sunny' })).toBeNull();
		expect(readFacts({ when: 'today' })).toBeNull();
		expect(readFacts(null)).toBeNull();
	});
});

describe('story choices', () => {
	it('only accepts the listed places and themes', () => {
		expect(isStoryPlace('space')).toBe(true);
		expect(isStoryPlace('a scary basement')).toBe(false);
		expect(isStoryTheme('brave')).toBe(true);
		expect(isStoryTheme('anything')).toBe(false);
	});
});
