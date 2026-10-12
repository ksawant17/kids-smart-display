<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import '../app.css';
	import Header from '#lib/components/Header.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import WeatherReport from '#lib/components/WeatherReport.svelte';
	import { kidNames, inTimeWindow } from '#lib/config';
	import { now, todayKey } from '#lib/clock';
	import { closeReport } from '#lib/report';
	import { startWeather } from '#lib/weather';

	let { data, children } = $props();

	const names = $derived(kidNames(data.kids));

	// One shared weather feed for every page, refreshed in the background.
	onMount(() => startWeather(data.weatherRefreshMinutes));

	// Every hour (and so at midnight): re-run server loads to pick up config
	// edits and school-calendar updates. The kiosk page itself is never reloaded.
	let lastHour = `${$todayKey}T${$now.getHours()}`;
	$effect(() => {
		const hour = `${$todayKey}T${$now.getHours()}`;
		if (hour !== lastHour) {
			lastHour = hour;
			invalidateAll();
		}
	});

	// Idle: after a while without touches, close overlays and go back to TODAY.
	let lastTouch = $state(Date.now());
	$effect(() => {
		const idleMs = data.kiosk.idleReturnSeconds * 1000;
		if (!idleMs) return;
		if ($now.getTime() - lastTouch >= idleMs) {
			lastTouch = Date.now();
			closeReport();
			if (page.url.pathname !== '/') goto('/');
		}
	});

	// Overnight: dim the screen; a touch brightens it for 2 minutes (the window
	// pointerdown handler below sees the tap even though the overlay swallows it).
	let wakeUntil = $state(0);
	const dimmed = $derived(
		!!data.kiosk.nightDim &&
			$now.getTime() > wakeUntil &&
			inTimeWindow($now, data.kiosk.nightDim.from, data.kiosk.nightDim.to)
	);

	function onTouch() {
		lastTouch = Date.now();
		// remove the overlay only after this tap's click has landed on it
		if (dimmed) setTimeout(() => (wakeUntil = Date.now() + 2 * 60_000), 400);
	}
</script>

<svelte:head>
	<title>{names} — Smart Dashboard</title>
</svelte:head>

<svelte:window onpointerdown={onTouch} />

<div id="pi-screen">
	<Header {names} />
	<main>
		{@render children()}
	</main>
	<BottomNav />
	<!-- Full-frame weather report panel (opened from the TODAY tab) -->
	<WeatherReport />
	{#if dimmed}
		<!-- catches the waking tap so it doesn't also press whatever is underneath -->
		<div class="night-dim" style="opacity:{data.kiosk.nightDim?.opacity}" aria-hidden="true"></div>
	{/if}
</div>

<style>
	.night-dim {
		position: absolute;
		inset: 0;
		z-index: 50;
		background: #000;
		transition: opacity 1s ease;
	}
</style>
