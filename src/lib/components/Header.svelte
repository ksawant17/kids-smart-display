<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import { greetingFor, shortDate, clockTime } from '#lib/utils/time';
	import { now } from '#lib/clock';
	import { weather } from '#lib/weather';

	let { names }: { names: string } = $props();

	// Sun or moon: the forecast knows (is_day), the clock is the fallback.
	let isDay = $derived(
		$weather.data ? $weather.data.current.is_day === 1 : $now.getHours() >= 6 && $now.getHours() < 19
	);
</script>

<header>
	<div class="header-left">
		{greetingFor($now)}, {names}!
		<Emoji code={isDay ? '1f31e' : '1f319'} size={32} alt="" shadow="2px 2px 0px rgba(0,0,0,0.15)" class="header-sun" />
		{shortDate($now)}
	</div>
	<div class="header-right">{clockTime($now)}</div>
</header>
