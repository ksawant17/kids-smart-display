import { describe, expect, it } from 'vitest';
import { sentences } from '#lib/utils/sentences';

describe('sentences', () => {
	it('splits on sentence ends', () => {
		expect(sentences('The sky is blue because air scatters light. Blue light scatters the most! Neat, right?')).toEqual([
			'The sky is blue because air scatters light.',
			'Blue light scatters the most! Neat, right?'
		]);
	});
	it('keeps short pieces with the next sentence', () => {
		expect(sentences('Hi! Good morning Reya and Neel, it is sunny today.')).toEqual([
			'Hi! Good morning Reya and Neel, it is sunny today.'
		]);
	});
	it('keeps decimals and closing quotes together', () => {
		expect(sentences('It is 48.5 degrees outside right now. She said “wear a jacket.” Then off to school we go!')).toEqual([
			'It is 48.5 degrees outside right now.',
			'She said “wear a jacket.”',
			'Then off to school we go!'
		]);
	});
	it('handles text with no ending, and empty text', () => {
		expect(sentences('Seven times eight is fifty six')).toEqual(['Seven times eight is fifty six']);
		expect(sentences('   ')).toEqual([]);
	});
});
