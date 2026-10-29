<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import { greetingFor, shortDate, clockTime } from '#lib/utils/time';
	import { moonPhase } from '#lib/utils/moon';
	import { now } from '#lib/clock';
	import { weather } from '#lib/weather';
	import { themeFor } from '#lib/themes';
	import { place } from '#lib/place';
	import MicButton from '#lib/components/MicButton.svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	/** ask: show the 🎤 Ask button (audio HAT + AI helper) */
	let { names, ask = false }: { names: string; ask?: boolean } = $props();

	// Sun by day, tonight's real moon phase at night; the forecast knows
	// (is_day), the clock is the fallback.
	let isDay = $derived(
		$weather.data ? $weather.data.current.is_day === 1 : $now.getHours() >= 6 && $now.getHours() < 19
	);
	const skyIcon = $derived(isDay ? '1f31e' : moonPhase($now).emoji);

	// holidays: a greeting on the day itself, decorations around it
	const theme = $derived(themeFor($now, $place));

	// there is no tab bar: every page but TODAY gets a 🏠 button and its name
	const TITLES: Record<string, string> = {
		'/calendar': 'Calendar',
		'/wardrobe': 'What to Wear',
		'/quote': 'Quote of the Day',
		'/fun': 'Fun',
		'/admin': 'Grown-ups'
	};
	const home = $derived(page.url.pathname === '/');
	const title = $derived(TITLES[page.url.pathname] ?? '');
</script>

<header>
	{#if home}
		<div class="header-left" style="flex: 0 0 auto">
			{theme?.greeting ?? greetingFor($now)}, {names}!
			<Emoji code={skyIcon} size={32} alt="" shadow="2px 2px 0px rgba(0,0,0,0.15)" class="header-sun" />
			{shortDate($now)}
		</div>
	{:else}
		<div class="header-left" style="flex: 0 0 auto">
			<button class="home pressable" onclick={() => goto('/')} aria-label="Back to TODAY">
				<Emoji code="1f3e0" size={28} alt="" shadow="none" /> Home
			</button>
			{title}
			<Emoji code={skyIcon} size={32} alt="" shadow="2px 2px 0px rgba(0,0,0,0.15)" class="header-sun" />
			{shortDate($now)}
		</div>
	{/if}
	{#if theme}
		<!-- seasonal decorations in whatever room is left (hidden if there's none) -->
		<div class="decor" aria-hidden="true">
			{#each theme.decor as code, i (code)}
				<span class="decor-item" style="animation-delay:{i * 0.6}s"><Emoji {code} size={24} alt="" /></span>
			{/each}
		</div>
	{/if}
	{#if ask}
		<MicButton look="small" />
	{/if}
	<div class="header-right">{clockTime($now)}</div>
</header>

<style>
	.home {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 42px;
		margin-right: 12px;
		padding: 0 16px 0 10px;
		font: 900 21px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		cursor: pointer;
	}
	/* takes only the leftover room; icons that don't fully fit wrap onto a
	   hidden second line instead of overlapping the date or the clock */
	.decor {
		flex: 1 1 0;
		min-width: 0;
		margin: 0 6px;
		overflow: hidden;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 40px 2px; /* a wrapped icon lands well below the clipped area */
		height: 30px;
		padding-top: 3px;
	}
	.decor-item {
		flex: 0 0 auto;
		display: flex;
		animation: float 3s ease-in-out infinite;
	}
</style>
