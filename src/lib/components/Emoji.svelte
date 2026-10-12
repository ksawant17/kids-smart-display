<script lang="ts">
	/**
	 * Every icon is an <img> sticker served from /emoji (static/emoji) so the
	 * kiosk works with no internet — never a text emoji.
	 *
	 * Sun / cloud-family weather icons use CUSTOM comic SVGs (deep fills +
	 * built-in ink outline): Twemoji's versions are drawn in pale wash colors
	 * that vanish on white cards. Everything else is a vendored Twemoji 14
	 * SVG (static/emoji/<code>.svg, see scripts/vendor-emoji.mjs) drawn with
	 * a dark outline filter.
	 *
	 * IMPORTANT: CSS drop-shadow() accepts exactly ONE shadow —
	 * a comma list must be split into several drop-shadow() calls.
	 */

	/** Custom comic stickers (code -> file in static/emoji). */
	const CUSTOM: Record<string, string> = {
		'2600': 'sun', // sunny
		'1f31e': 'sun',
		'1f324': 'sun-cloud', // mostly sunny
		'26c5': 'sun-cloud', // partly sunny
		'1f32b': 'cloud', // fog
		'2601': 'cloud', // cloudy
		'1f326': 'rain-cloud', // showers
		'1f327': 'rain-cloud', // rain
		'1f328': 'snow-cloud', // snow / freezing rain
		'2747': 'flake', // flurries
		'1f329': 'storm',
		'26a1': 'storm'
	};

	const INK = 'rgba(51, 65, 85, 0.9)';
	/** dark outline (4 sides) + sticker offset shadow, for Twemoji icons */
	const OUTLINE = [
		`1.5px 0 0 ${INK}`,
		`-1.5px 0 0 ${INK}`,
		`0 1.5px 0 ${INK}`,
		`0 -1.5px 0 ${INK}`,
		`2.5px 3px 0 rgba(51, 65, 85, 0.35)`
	].join(', ');

	/** Split a box-shadow-style list into individual drop-shadow() calls. */
	const toFilter = (shadow: string): string | undefined => {
		if (shadow === 'none') return undefined;
		const parts: string[] = [];
		let depth = 0;
		let cur = '';
		for (const ch of shadow) {
			if (ch === '(') depth += 1;
			else if (ch === ')') depth -= 1;
			if (ch === ',' && depth === 0) {
				parts.push(cur.trim());
				cur = '';
			} else {
				cur += ch;
			}
		}
		if (cur.trim()) parts.push(cur.trim());
		return parts.map((p) => `drop-shadow(${p})`).join(' ');
	};

	let {
		code,
		size = 32,
		alt = '',
		// 'auto' = custom sticker → offset shadow only (it has its own ink);
		//         Twemoji        → dark outline + offset shadow
		shadow = 'auto',
		class: className = ''
	}: {
		code: string;
		size?: number;
		alt?: string;
		shadow?: string;
		class?: string;
	} = $props();

	let custom = $derived(CUSTOM[code] != null);
	let src = $derived(`/emoji/${CUSTOM[code] ?? code}.svg`);
	let filter = $derived(
		toFilter(shadow === 'auto' ? (custom ? '3px 4px 0 rgba(51, 65, 85, 0.25)' : OUTLINE) : shadow)
	);
</script>

<img
	{src}
	{alt}
	draggable="false"
	class={className}
	style="width:{size}px; height:{size}px; object-fit:contain;{filter ? ' filter:' + filter + ';' : ''}"
/>
