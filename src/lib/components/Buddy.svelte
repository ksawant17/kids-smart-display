<script lang="ts">
	/**
	 * A cartoon animal buddy, dressed in whatever outfit items it is given
	 * (names from utils/wardrobe: "Winter Coat", "Light Jacket", "T-Shirt",
	 * "Shorts", "Rain Boots", "Umbrella"...). Hand-drawn SVG in the sticker
	 * style: deep fills + dark ink outline + hard offset shadow.
	 */
	import type { BuddyKind } from '#lib/buddies';
	import type { BuddyHat } from '#lib/themes';
	let {
		kind = 'bear',
		items = [],
		color = '#b388ff',
		size = 140,
		label = '',
		hat = null
	}: {
		kind?: BuddyKind;
		/** outfit item names to wear */
		items?: string[];
		/** main clothes colour */
		color?: string;
		/** rendered height in px */
		size?: number;
		/** accessible name, e.g. the kid's name */
		label?: string;
		/** seasonal hat (themes.ts) */
		hat?: BuddyHat;
	} = $props();

	const INK = '#111827';

	interface Look {
		fur: string;
		light: string; // muzzle / face patch / belly
		inner: string; // inside of ears
		limbs?: string; // arms + legs fur (panda)
	}
	const LOOKS: Record<BuddyKind, Look> = {
		bear: { fur: '#b7773f', light: '#f1d2a8', inner: '#f1d2a8' },
		monkey: { fur: '#8b5a2b', light: '#f3d3a6', inner: '#f3d3a6' },
		fox: { fur: '#f28c28', light: '#fff4e6', inner: '#3b2a20' },
		bunny: { fur: '#f5f2ef', light: '#ffffff', inner: '#ffb3c7' },
		panda: { fur: '#ffffff', light: '#ffffff', inner: '#1f2937', limbs: '#1f2937' },
		cat: { fur: '#a3aab5', light: '#eef0f3', inner: '#f9a8d4' },
		dino: { fur: '#5ad570', light: '#c8f7cf', inner: '#2fa84a' }
	};
	const look = $derived(LOOKS[kind] ?? LOOKS.bear);
	const limbFur = $derived(look.limbs ?? look.fur);

	const has = (name: string) => items.includes(name);
	const top = $derived(
		has('Winter Coat') ? 'coat' : has('Light Jacket') ? 'hoodie' : has('Long-Sleeve Shirt') ? 'longsleeve' : has('T-Shirt') ? 'tee' : 'none'
	);
	const legs = $derived(has('Pants') ? 'pants' : has('Shorts') ? 'shorts' : 'none');
	const feet = $derived(has('Rain Boots') ? 'boots' : has('Sneakers') ? 'sneakers' : 'none');
	const scarf = $derived(has('Scarf'));
	const gloves = $derived(has('Gloves'));
	const umbrella = $derived(has('Umbrella'));

	const sleeve = $derived(top === 'none' ? limbFur : color);
	const shortSleeve = $derived(top === 'tee');
	const pants = '#3d6fd6';
	const shorts = '#e0a458';

	// the right arm goes up to hold the umbrella
	const rHand = $derived(umbrella ? { x: 94, y: 92 } : { x: 92, y: 110 });
	const lHand = { x: 28, y: 110 };

	// 140 x 182 viewBox (room above the head for bunny ears / the umbrella)
	const width = $derived(Math.round((size * 140) / 182));
</script>

{#snippet limb(x1: number, y1: number, x2: number, y2: number, fill: string, w = 11)}
	<line {x1} {y1} {x2} {y2} stroke={INK} stroke-width={w + 6} stroke-linecap="round" />
	<line {x1} {y1} {x2} {y2} stroke={fill} stroke-width={w} stroke-linecap="round" />
{/snippet}

{#snippet arm(sx: number, sy: number, hx: number, hy: number)}
	{#if shortSleeve}
		{@render limb(sx, sy, hx, hy, limbFur)}
		{@render limb(sx, sy, sx + (hx - sx) * 0.38, sy + (hy - sy) * 0.38, color, 13)}
	{:else}
		{@render limb(sx, sy, hx, hy, sleeve)}
	{/if}
	<circle cx={hx} cy={hy} r={gloves ? 8 : 6.5} fill={gloves ? '#ef4444' : limbFur} stroke={INK} stroke-width="3" />
{/snippet}

<svg
	viewBox="-10 -20 140 182"
	width={width}
	height={size}
	role="img"
	aria-label={label || `${kind} buddy`}
	style="filter: drop-shadow(3px 4px 0 rgba(0,0,0,0.15)); overflow: visible"
>
	<!-- umbrella handle (behind the head) -->
	{#if umbrella}
		<line x1="84" y1="2" x2={rHand.x} y2={rHand.y} stroke={INK} stroke-width="4" />
	{/if}

	<!-- legs -->
	{#if legs === 'shorts'}
		{@render limb(51, 112, 50, 140, limbFur)}
		{@render limb(69, 112, 70, 140, limbFur)}
	{:else}
		{@render limb(51, 112, 50, 140, legs === 'pants' ? pants : limbFur)}
		{@render limb(69, 112, 70, 140, legs === 'pants' ? pants : limbFur)}
	{/if}

	<!-- feet -->
	{#if feet === 'boots'}
		{#each [50, 70] as x (x)}
			<path d="M{x - 8} 126 h16 v16 q0 5 -5 5 h-14 q-5 0 -5 -5 q0 -4 5 -4 h3 z" fill="#facc15" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		{/each}
	{:else if feet === 'sneakers'}
		{#each [[46, 1], [74, -1]] as [x, dir] (x)}
			<path d="M{x - 11} 146 q0 -10 9 -10 h4 q10 0 10 7 v3 z" transform={dir < 0 ? `translate(${2 * x} 0) scale(-1 1)` : ''} fill="#ef4444" stroke={INK} stroke-width="3" stroke-linejoin="round" />
			<line x1={x - 10} y1="143" x2={x + 10} y2="143" stroke="#ffffff" stroke-width="3" />
		{/each}
	{:else}
		<ellipse cx="46" cy="143" rx="9" ry="5" fill={limbFur} stroke={INK} stroke-width="3" />
		<ellipse cx="74" cy="143" rx="9" ry="5" fill={limbFur} stroke={INK} stroke-width="3" />
	{/if}

	<!-- body / top -->
	{#if top === 'coat'}
		<rect x="35" y="72" width="50" height="54" rx="16" fill={color} stroke={INK} stroke-width="3" />
		<path d="M38 92 h44 M37 108 h46" stroke={INK} stroke-width="2.5" stroke-linecap="round" opacity="0.5" />
		<line x1="60" y1="74" x2="60" y2="124" stroke={INK} stroke-width="2.5" />
	{:else if top === 'none'}
		<rect x="39" y="72" width="42" height="44" rx="15" fill={look.fur} stroke={INK} stroke-width="3" />
		<ellipse cx="60" cy="96" rx="13" ry="14" fill={look.light} />
	{:else}
		<rect x="38" y="72" width="44" height="46" rx="14" fill={color} stroke={INK} stroke-width="3" />
		{#if top === 'longsleeve'}
			<path d="M40 88 h40 M40 102 h40" stroke="#ffffff" stroke-width="5" opacity="0.85" />
		{:else if top === 'tee'}
			<path d="M60 84 l3.5 7 7.5 1 -5.5 5 1.5 7.5 -7 -3.8 -7 3.8 1.5 -7.5 -5.5 -5 7.5 -1 z" fill="#facc15" stroke={INK} stroke-width="2" stroke-linejoin="round" />
		{:else if top === 'hoodie'}
			<rect x="47" y="98" width="26" height="12" rx="5" fill="none" stroke={INK} stroke-width="2.5" opacity="0.55" />
			<path d="M55 76 v10 M65 76 v10" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
		{/if}
	{/if}

	<!-- shorts over the shirt hem, fur legs below -->
	{#if legs === 'shorts'}
		<path d="M39 108 h42 l2 18 h-19 l-4 -8 l-4 8 h-19 z" fill={shorts} stroke={INK} stroke-width="3" stroke-linejoin="round" />
	{/if}

	<!-- arms -->
	{@render arm(41, 82, lHand.x, lHand.y)}
	{@render arm(79, 82, rHand.x, rHand.y)}

	<!-- hood behind the head -->
	{#if top === 'hoodie'}
		<ellipse cx="60" cy="50" rx="36" ry="33" fill={color} stroke={INK} stroke-width="3" />
	{/if}

	<!-- ears -->
	{#if kind === 'bear' || kind === 'panda'}
		{#each [34, 86] as x (x)}
			<circle cx={x} cy="22" r="11" fill={kind === 'panda' ? look.inner : look.fur} stroke={INK} stroke-width="3" />
			{#if kind === 'bear'}<circle cx={x} cy="22" r="5.5" fill={look.inner} />{/if}
		{/each}
	{:else if kind === 'monkey'}
		{#each [28, 92] as x (x)}
			<circle cx={x} cy="48" r="11" fill={look.fur} stroke={INK} stroke-width="3" />
			<circle cx={x} cy="48" r="6" fill={look.inner} />
		{/each}
	{:else if kind === 'fox' || kind === 'cat'}
		<path d="M33 34 L36 4 L56 22 Z" fill={look.fur} stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M87 34 L84 4 L64 22 Z" fill={look.fur} stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M38 26 L39 12 L49 21 Z M82 26 L81 12 L71 21 Z" fill={look.inner} />
	{:else if kind === 'bunny'}
		{#each [[47, -8], [73, 8]] as [x, tilt] (x)}
			<ellipse cx={x} cy="0" rx="9" ry="24" transform="rotate({tilt} {x} 0)" fill={look.fur} stroke={INK} stroke-width="3" />
			<ellipse cx={x} cy="2" rx="4.5" ry="16" transform="rotate({tilt} {x} 2)" fill={look.inner} />
		{/each}
	{:else if kind === 'dino'}
		<path d="M40 26 l6 -14 6 12 6 -16 6 16 6 -12 6 14" fill={look.inner} stroke={INK} stroke-width="3" stroke-linejoin="round" />
	{/if}

	<!-- head -->
	<circle cx="60" cy="48" r="30" fill={look.fur} stroke={INK} stroke-width="3" />

	<!-- face -->
	{#if kind === 'monkey'}
		<path d="M60 40 c-6 -10 -24 -8 -22 6 c-6 8 -2 24 22 24 c24 0 28 -16 22 -24 c2 -14 -16 -16 -22 -6 z" fill={look.light} />
	{:else if kind === 'panda'}
		<ellipse cx="49" cy="46" rx="8" ry="10" transform="rotate(-25 49 46)" fill={look.inner} />
		<ellipse cx="71" cy="46" rx="8" ry="10" transform="rotate(25 71 46)" fill={look.inner} />
	{:else if kind === 'fox'}
		<path d="M32 52 q14 4 28 18 q14 -14 28 -18 q-6 22 -28 24 q-22 -2 -28 -24 z" fill={look.light} />
	{/if}
	{#if kind === 'bear' || kind === 'bunny' || kind === 'cat' || kind === 'dino'}
		<ellipse cx="60" cy="59" rx="12" ry="9" fill={look.light} />
	{/if}

	<!-- eyes (white glints on the panda patches) -->
	<ellipse cx="50" cy="46" rx="4" ry="5" fill={kind === 'panda' ? '#ffffff' : INK} />
	<ellipse cx="70" cy="46" rx="4" ry="5" fill={kind === 'panda' ? '#ffffff' : INK} />
	<circle cx="51.5" cy="44" r="1.6" fill={kind === 'panda' ? INK : '#ffffff'} />
	<circle cx="71.5" cy="44" r="1.6" fill={kind === 'panda' ? INK : '#ffffff'} />

	<!-- nose + smile + cheeks -->
	<ellipse cx="60" cy="55" rx="4" ry="3" fill={INK} />
	<path d="M53 60 q7 7 14 0" fill="none" stroke={INK} stroke-width="2.5" stroke-linecap="round" />
	<circle cx="42" cy="58" r="4.5" fill="#fb7185" opacity="0.55" />
	<circle cx="78" cy="58" r="4.5" fill="#fb7185" opacity="0.55" />
	{#if kind === 'cat'}
		<path d="M30 54 h10 M30 60 l10 -2 M90 54 h-10 M90 60 l-10 -2" stroke={INK} stroke-width="2" stroke-linecap="round" />
	{/if}

	<!-- seasonal hat -->
	{#if hat === 'witch'}
		<path d="M41 22 Q50 2 58 -22 Q64 -4 80 22 Z" fill="#6d28d9" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M45 16 h31" stroke="#facc15" stroke-width="6" />
		<ellipse cx="60" cy="22" rx="36" ry="7" fill="#6d28d9" stroke={INK} stroke-width="3" />
	{:else if hat === 'winter'}
		<path d="M31 32 Q32 2 60 2 Q88 2 89 32 Z" fill="#ef4444" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<rect x="28" y="24" width="64" height="12" rx="6" fill="#ffffff" stroke={INK} stroke-width="3" />
		<circle cx="60" cy="0" r="8" fill="#ffffff" stroke={INK} stroke-width="3" />
	{:else if hat === 'party'}
		<path d="M46 22 L60 -16 L74 22 Z" fill="#38bdf8" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M51 9 L69 9 M55 -2 L65 -2" stroke="#facc15" stroke-width="4" />
		<circle cx="60" cy="-17" r="5" fill="#f472b6" stroke={INK} stroke-width="2.5" />
	{/if}

	<!-- scarf -->
	{#if scarf}
		<rect x="36" y="70" width="48" height="11" rx="5.5" fill="#ef4444" stroke={INK} stroke-width="3" />
		<path d="M70 78 l4 22 h-10 l-2 -20 z" fill="#ef4444" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M46 71 v9 M58 71 v9" stroke="#ffffff" stroke-width="3" />
	{/if}

	<!-- umbrella canopy -->
	{#if umbrella}
		<path d="M54 4 q30 -36 60 0 q-5 -5 -10 0 q-5 -5 -10 0 q-5 -5 -10 0 q-5 -5 -10 0 q-5 -5 -10 0 q-5 -5 -10 0 z" fill="#38bdf8" stroke={INK} stroke-width="3" stroke-linejoin="round" />
		<path d="M84 -14 v4" stroke={INK} stroke-width="3" stroke-linecap="round" />
	{/if}
</svg>
