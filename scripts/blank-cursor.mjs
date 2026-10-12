#!/usr/bin/env node
/**
 * Hide cage's mouse cursor on the touch kiosk.
 *
 * An arrow sits in the middle of the touch-only screen: cage parks the
 * pointer there and Chromium draws its arrow once (from the "Adwaita" or
 * "default" cursor theme) and never updates it, because no mouse ever moves,
 * so CSS `cursor: none` can't take effect. Cursor themes are searched in
 * ~/.local/share/icons first, so blank (1x1, fully transparent) copies of
 * every cursor name there win over the system themes, with no root needed.
 * Run as the kiosk user, then restart the kiosk:
 *
 *   node scripts/blank-cursor.mjs            # install
 *   node scripts/blank-cursor.mjs --remove   # bring the arrow back
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ICONS = join(homedir(), '.local/share/icons');
const THEMES = ['default', 'Adwaita'];
const SYSTEM = '/usr/share/icons/Adwaita/cursors';
// every cursor name the system theme has (plus the basics if it's missing)
const NAMES = [
	...new Set([
		'left_ptr', 'default', 'arrow', 'top_left_arrow', 'pointer', 'hand1', 'hand2', 'text', 'xterm',
		...(existsSync(SYSTEM) ? readdirSync(SYSTEM) : [])
	])
];

if (process.argv.includes('--remove')) {
	for (const t of THEMES) rmSync(join(ICONS, t), { recursive: true, force: true });
	console.log(`removed blank cursor themes from ${ICONS}`);
	process.exit(0);
}

// Xcursor file: header + 1 table-of-contents entry + one 1x1 transparent ARGB image
const IMAGE = 0xfffd0002;
const SIZE = 24; // nominal size cage asks for
const buf = Buffer.alloc(16 + 12 + 36 + 4);
let o = 0;
const u32 = (v) => {
	buf.writeUInt32LE(v >>> 0, o);
	o += 4;
};
buf.write('Xcur', 0, 'latin1');
o = 4;
u32(16); // header size
u32(0x10000); // version
u32(1); // toc entries
u32(IMAGE);
u32(SIZE);
u32(28); // image chunk position
u32(36); // chunk header size
u32(IMAGE);
u32(SIZE);
u32(1); // chunk version
u32(1); // width
u32(1); // height
u32(0); // xhot
u32(0); // yhot
u32(0); // delay
u32(0); // the one pixel: fully transparent

for (const t of THEMES) {
	const dir = join(ICONS, t, 'cursors');
	mkdirSync(dir, { recursive: true });
	for (const n of NAMES) writeFileSync(join(dir, n), buf);
}
console.log(`installed ${NAMES.length} blank cursors for ${THEMES.join(' + ')} in ${ICONS}; restart the kiosk to apply`);
