<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import { greetingFor, shortDate, clockTime } from '#lib/utils/time';
	import { moonPhase } from '#lib/utils/moon';
	import { now } from '#lib/clock';
	import { weather } from '#lib/weather';
	import { themeFor } from '#lib/themes';

	let { names }: { names: string } = $props();

	// Sun by day, tonight's real moon phase at night; the forecast knows
	// (is_day), the clock is the fallback.
	let isDay = $derived(
		$weather.data ? $weather.data.current.is_day === 1 : $now.getHours() >= 6 && $now.getHours() < 19
	);
	const skyIcon = $derived(isDay ? '1f31e' : moonPhase($now).emoji);

	// holidays: a greeting on the day itself, decorations around it
	const theme = $derived(themeFor($now));
</script>

<header>
	<div class="header-left" style="flex: 0 0 auto">
		{theme?.greeting ?? greetingFor($now)}, {names}!
		<Emoji code={skyIcon} size={32} alt="" shadow="2px 2px 0px rgba(0,0,0,0.15)" class="header-sun" />
		{shortDate($now)}
	</div>
	{#if theme}
		<!-- seasonal decorations in whatever room is left (hidden if there's none) -->
		<div class="decor" aria-hidden="true">
			{#each theme.decor as code, i (code)}
				<span class="decor-item" style="animation-delay:{i * 0.6}s"><Emoji {code} size={24} alt="" /></span>
			{/each}
		</div>
	{/if}
	<div class="header-right">{clockTime($now)}</div>
</header>

<style>
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
