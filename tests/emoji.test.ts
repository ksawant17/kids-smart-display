import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
// plain JS helper shared with scripts/vendor-emoji.mjs
import { referencedEmojiCodes } from '../scripts/emoji-codes.mjs';

describe('icons work offline', () => {
	it('every referenced icon has a local SVG in static/emoji (run `npm run emoji` to fetch)', () => {
		const missing = [...(referencedEmojiCodes() as Set<string>)].filter(
			(code) => !existsSync(`static/emoji/${code}.svg`)
		);
		expect(missing).toEqual([]);
	});
});
