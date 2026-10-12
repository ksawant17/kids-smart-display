/**
 * Finds every twemoji code the app references (quoted hex codes like '1f9e5'
 * or "1f467-1f3fd" in src/ and config/*.json), so they can be vendored into
 * static/emoji and checked by tests/emoji.test.ts.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CODE = /['"]([0-9a-f]{4,5}(?:-[0-9a-f]{4,5})*)['"]/g;
// quoted hex that is not an emoji (e.g. years in test data)
const NOT_EMOJI = /^(19|20)\d\d$/;

/** @param {string} dir @param {string[]} out @returns {string[]} */
function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(svelte|ts|json)$/.test(name)) out.push(p);
	}
	return out;
}

/** @returns {Set<string>} */
export function referencedEmojiCodes(root = process.cwd()) {
	const codes = new Set();
	for (const file of [...walk(join(root, 'src')), ...walk(join(root, 'config'))]) {
		for (const m of readFileSync(file, 'utf8').matchAll(CODE)) {
			if (!NOT_EMOJI.test(m[1])) codes.add(m[1]);
		}
	}
	return codes;
}
