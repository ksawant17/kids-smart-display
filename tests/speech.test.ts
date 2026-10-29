import { describe, expect, it } from 'vitest';
import { withoutEmoji } from '#lib/utils/speech';

describe('withoutEmoji', () => {
	it('drops emoji, with skin tones, joiners and flags', () => {
		expect(withoutEmoji('7 times 8 is 56! 😊')).toBe('7 times 8 is 56!');
		expect(withoutEmoji('Great job 👍🏽 team 👨‍👩‍👧 ❤️ 🇺🇸!')).toBe('Great job team!');
		expect(withoutEmoji('Sunny ☀️ and warm 🌈.')).toBe('Sunny and warm.');
	});

	it('drops text smileys', () => {
		expect(withoutEmoji('You did it :) Well done :-D')).toBe('You did it Well done');
		expect(withoutEmoji('Oh no :( try again ;P')).toBe('Oh no try again');
		expect(withoutEmoji('Love you <3 xD')).toBe('Love you');
		expect(withoutEmoji('Yay ^_^!')).toBe('Yay!');
	});

	it('leaves ordinary text alone', () => {
		const plain = 'It is 3:30 now, 48°F: wear a jacket (it is chilly). Ratio 8:3, x2!';
		expect(withoutEmoji(plain)).toBe(plain);
		expect(withoutEmoji('Seven times eight is fifty-six.')).toBe('Seven times eight is fifty-six.');
		expect(withoutEmoji(' Two lines\nof  text ')).toBe('Two lines of text');
	});
});
