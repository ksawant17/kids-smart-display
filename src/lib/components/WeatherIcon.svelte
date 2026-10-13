<script lang="ts">
	/**
	 * A big weather sticker that moves with the weather: the sun's rays turn,
	 * clouds drift, rain and snow fall, a storm flashes, the moon rocks.
	 *
	 * Kept cheap for the kiosk's software rendering: only whole layers move
	 * (transform / opacity on elements with will-change), so the sticker
	 * itself is never redrawn per frame. Used for the main icons only; the
	 * small hourly ones stay still. Animations pause while the screen is off
	 * (html.screen-off in app.css) and for prefers-reduced-motion.
	 */
	import Emoji from '#lib/components/Emoji.svelte';

	let {
		code,
		size = 54,
		alt = '',
		class: className = ''
	}: { code: string; size?: number; alt?: string; class?: string } = $props();

	const KIND: Record<string, string> = {
		'2600': 'sun',
		'1f324': 'partly',
		'26c5': 'partly',
		'2601': 'cloud',
		'1f32b': 'fog',
		'1f4a7': 'drip',
		'1f326': 'rain',
		'1f327': 'rain',
		'1f328': 'snow',
		'2747': 'flurry',
		'1f329': 'storm',
		'26a1': 'storm',
		'1f319': 'moon'
	};
	const kind = $derived(KIND[code] ?? 'still');
	// falling bits under rain / snow clouds: [left %, delay s]
	const BITS = [
		[30, 0],
		[52, 0.45],
		[72, 0.9]
	];
</script>

<span class="wx wx-{kind}" style="--s:{size}px">
	{#if kind === 'sun'}<span class="rays" aria-hidden="true"></span>{/if}
	{#if kind === 'storm'}<span class="flash" aria-hidden="true"></span>{/if}
	<span class="body"><Emoji {code} {size} {alt} class={className} /></span>
	{#if kind === 'rain' || kind === 'snow' || kind === 'flurry'}
		{#each BITS as [left, delay], i (i)}
			<span
				class={kind === 'rain' ? 'drop' : 'flake'}
				style="left:{left}%; animation-delay:{delay}s"
				aria-hidden="true"
			></span>
		{/each}
	{/if}
</span>

<style>
	.wx {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--s);
		height: var(--s);
		flex: 0 0 auto;
	}
	.body {
		position: relative;
		z-index: 1;
		display: flex;
		will-change: transform;
	}
	.rays,
	.flash,
	.drop,
	.flake {
		position: absolute;
		pointer-events: none;
		will-change: transform, opacity;
	}

	/* sunny: soft rays turning behind a gently glowing sun */
	.rays {
		inset: -18%;
		border-radius: 50%;
		background: repeating-conic-gradient(rgba(255, 222, 58, 0.55) 0deg 12deg, transparent 12deg 30deg);
		mask: radial-gradient(circle, transparent 38%, #000 40%, #000 62%, transparent 70%);
		animation: spin 14s linear infinite;
	}
	.wx-sun .body {
		animation: glow 3s ease-in-out infinite;
	}

	/* clouds drift; partly sunny drifts a little less */
	.wx-cloud .body,
	.wx-rain .body,
	.wx-snow .body,
	.wx-storm .body {
		animation: drift 5s ease-in-out infinite;
	}
	.wx-partly .body {
		animation: drift-small 6s ease-in-out infinite;
	}
	.wx-fog .body {
		animation: fog 6s ease-in-out infinite;
	}
	.wx-moon .body {
		animation: rock 5s ease-in-out infinite;
	}
	.wx-drip .body {
		animation: bob 2.4s ease-in-out infinite;
	}
	.wx-flurry .body {
		animation: rock 4s ease-in-out infinite;
	}

	/* rain: drops falling out of the bottom of the cloud */
	.drop {
		top: 68%;
		width: calc(var(--s) * 0.06);
		height: calc(var(--s) * 0.16);
		border-radius: 999px;
		background: #3b82f6;
		box-shadow: 0 0 0 1.5px rgba(30, 64, 175, 0.6);
		animation: fall 1.35s linear infinite;
		opacity: 0;
	}
	/* snow: little flakes drifting down */
	.flake {
		top: 60%;
		width: calc(var(--s) * 0.11);
		height: calc(var(--s) * 0.11);
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 0 0 1.5px rgba(51, 65, 85, 0.55);
		animation: snowfall 2.6s linear infinite;
		opacity: 0;
	}
	.wx-flurry .flake {
		top: 40%;
	}

	/* thunderstorm: a lightning flash now and then */
	.flash {
		inset: -15%;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 240, 120, 0.95), rgba(255, 222, 58, 0) 65%);
		opacity: 0;
		animation: flash 4s linear infinite;
	}
	.wx-storm .body {
		animation:
			drift 5s ease-in-out infinite,
			jolt 4s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes glow {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.06);
		}
	}
	@keyframes drift {
		0%,
		100% {
			transform: translateX(-5%);
		}
		50% {
			transform: translateX(5%);
		}
	}
	@keyframes drift-small {
		0%,
		100% {
			transform: translateX(-3%);
		}
		50% {
			transform: translateX(3%);
		}
	}
	@keyframes fog {
		0%,
		100% {
			transform: translateX(-6%);
			opacity: 1;
		}
		50% {
			transform: translateX(6%);
			opacity: 0.7;
		}
	}
	@keyframes rock {
		0%,
		100% {
			transform: rotate(-7deg);
		}
		50% {
			transform: rotate(7deg);
		}
	}
	@keyframes bob {
		0%,
		100% {
			transform: translateY(-4%);
		}
		50% {
			transform: translateY(4%);
		}
	}
	@keyframes fall {
		0% {
			transform: translateY(0);
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		80% {
			opacity: 1;
		}
		100% {
			transform: translateY(calc(var(--s) * 0.3));
			opacity: 0;
		}
	}
	@keyframes snowfall {
		0% {
			transform: translate(0, 0);
			opacity: 0;
		}
		15% {
			opacity: 1;
		}
		50% {
			transform: translate(calc(var(--s) * 0.06), calc(var(--s) * 0.22));
		}
		85% {
			opacity: 1;
		}
		100% {
			transform: translate(calc(var(--s) * -0.04), calc(var(--s) * 0.36));
			opacity: 0;
		}
	}
	@keyframes flash {
		0%,
		70%,
		76%,
		82%,
		100% {
			opacity: 0;
		}
		72%,
		79% {
			opacity: 1;
		}
	}
	@keyframes jolt {
		0%,
		70%,
		78%,
		100% {
			translate: 0 0;
		}
		72% {
			translate: -3px 0;
		}
		74% {
			translate: 3px 0;
		}
		76% {
			translate: -2px 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wx * {
			animation: none !important;
		}
	}
</style>
