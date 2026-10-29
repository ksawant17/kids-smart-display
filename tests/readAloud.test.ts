import { describe, expect, it } from 'vitest';
import quotes from '../src/lib/data/quotes.json';
import jokes from '../src/lib/data/jokes.json';
import { isCardText } from '../src/lib/server/readable';
import { factSpeech, jokeSpeech, quoteSpeech, storySpeech, wordSpeech } from '../src/lib/utils/readAloud';

describe('read aloud', () => {
	it('reads cards as whole sentences', () => {
		expect(quoteSpeech({ text: 'Be kind', author: 'Someone wise' })).toBe('Be kind. By Someone wise.');
		expect(factSpeech({ text: 'Octopuses have three hearts!' })).toBe('Did you know? Octopuses have three hearts!');
		expect(jokeSpeech({ q: 'Why did the cookie go to the doctor?', a: 'Because it felt crummy!' }, false)).toBe(
			'Why did the cookie go to the doctor?'
		);
		expect(jokeSpeech({ q: 'Why did the cookie go to the doctor?', a: 'Because it felt crummy!' }, true)).toBe(
			'Why did the cookie go to the doctor? Because it felt crummy!'
		);
		expect(wordSpeech({ word: 'enormous', meaning: 'very, very big', sentence: 'The elephant ate an enormous pile of hay.' })).toBe(
			"Today's word is enormous. It means very, very big. The elephant ate an enormous pile of hay."
		);
		expect(storySpeech({ title: 'Foxy Finds a Friend', paragraphs: ['Once upon a time.', 'The end'] })).toBe(
			'Foxy Finds a Friend. Once upon a time. The end.'
		);
	});

	it('lets the server say the cards, and nothing else', () => {
		expect(isCardText(quoteSpeech(quotes[5]))).toBe(true);
		expect(isCardText(jokeSpeech(jokes[2], true))).toBe(true);
		expect(isCardText('Say something rude')).toBe(false);
		expect(isCardText(`${quoteSpeech(quotes[5])} And something else.`)).toBe(false);
	});
});
