#!/usr/bin/env node
/**
 * Download any referenced Twemoji 14 SVG that is missing from static/emoji,
 * so the kiosk never needs the internet for icons.
 *
 *   node scripts/vendor-emoji.mjs
 *
 * Twemoji graphics: (c) Twitter, Inc and other contributors, CC-BY 4.0.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { referencedEmojiCodes } from './emoji-codes.mjs';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg';
const DIR = join(process.cwd(), 'static/emoji');

let fetched = 0;
let failed = 0;
for (const code of [...referencedEmojiCodes()].sort()) {
	const file = join(DIR, `${code}.svg`);
	if (existsSync(file)) continue;
	const res = await fetch(`${CDN}/${code}.svg`);
	const body = await res.text();
	if (!res.ok || !body.startsWith('<svg')) {
		console.error(`✗ ${code}: HTTP ${res.status} (not a twemoji code?)`);
		failed++;
		continue;
	}
	writeFileSync(file, body);
	console.log(`✓ ${code}`);
	fetched++;
}
console.log(`${fetched} downloaded, ${failed} failed`);
process.exit(failed ? 1 : 0);
