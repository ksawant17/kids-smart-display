<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import '../app.css';
	import Header from '#lib/components/Header.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import WeatherReport from '#lib/components/WeatherReport.svelte';
	import ScreenControl from '#lib/components/ScreenControl.svelte';
	import { kidNames } from '#lib/config';
	import { modeForIdle, screenPanelOpen, type ScreenMode } from '#lib/screen';
	import { now, todayKey } from '#lib/clock';
	import { closeReport } from '#lib/report';
	import { startWeather, weather } from '#lib/weather';
	import { skyPhase } from '#lib/sky';

	let { data, children } = $props();

	const names = $derived(kidNames(data.kids));

	// background follows the real sky: dawn / day / dusk / starry night
	const sky = $derived(
		skyPhase($now, $weather.data?.days[0]?.sunrise, $weather.data?.days[0]?.sunset)
	);

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
	let sentHome = false; // once per idle stretch
	$effect(() => {
		const idleMs = data.kiosk.idleReturnSeconds * 1000;
		if (!idleMs || sentHome) return;
		if ($now.getTime() - lastTouch >= idleMs) {
			sentHome = true;
			closeReport();
			screenPanelOpen.set(false);
			if (page.url.pathname !== '/') goto('/');
		}
	});

	/* ---------------- screen: dim -> off when idle, wake on touch ---------------- */
	const RANK: Record<ScreenMode, number> = { on: 0, dim: 1, off: 2 };
	let screenMode = $state<ScreenMode>('on');
	// the client owns these after load (hourly data refreshes must not undo a slider change)
	let brightness = $state(untrack(() => data.screen.brightness));
	// no real backlight (desktop browser): simulate with a dark overlay
	const simulate = untrack(() => !data.screen.available);
	// keeps the overlay up until the waking tap's click has landed on it
	let waking = $state(false);

	async function postScreen(change: { mode?: ScreenMode; brightness?: number }) {
		try {
			await fetch('/api/screen', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(change)
			});
		} catch {
			/* server unreachable: nothing to do, the next change retries */
		}
	}

	function setMode(mode: ScreenMode) {
		if (mode === screenMode) return;
		screenMode = mode;
		postScreen({ mode });
	}

	// page (re)load: make sure the screen is on at the saved brightness
	onMount(() => {
		postScreen({ mode: 'on' });
	});

	// idle: only ever go darker here; only a touch brings the screen back
	$effect(() => {
		const want = modeForIdle($now.getTime() - lastTouch, data.screenConfig);
		if (RANK[want] > RANK[screenMode]) setMode(want);
	});

	// brightness slider: update live, but send at most ~8 requests a second
	let sendTimer: ReturnType<typeof setTimeout> | null = null;
	function onBrightness(value: number) {
		brightness = value;
		sendTimer ??= setTimeout(() => {
			sendTimer = null;
			postScreen({ brightness });
		}, 120);
	}

	// Show the cursor only once a real mouse is moved around (touches never
	// count). Chromium fires a synthetic mouse event when the compositor first
	// hands it the pointer, so a single event, or a small nudge, doesn't count:
	// the pointer has to travel 60px from where it first appeared.
	let mouseOrigin: { x: number; y: number } | null = null;
	function onPointerMove(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		if (!mouseOrigin) {
			mouseOrigin = { x: e.clientX, y: e.clientY };
			return;
		}
		if (Math.hypot(e.clientX - mouseOrigin.x, e.clientY - mouseOrigin.y) > 60) {
			document.documentElement.classList.add('mouse');
		}
	}

	/* --- quick menu: pull down from the top of the screen (like a phone) --- */
	const PULL_ZONE = 64; // px from the top of the frame: the header band
	let frame: HTMLElement | undefined = $state();
	let pullFrom: number | null = null;
	function pullMove(e: PointerEvent) {
		if (pullFrom !== null && e.clientY - pullFrom > 45) {
			pullFrom = null;
			screenPanelOpen.set(true);
		}
	}

	function onTouch(e: PointerEvent) {
		const top = frame?.getBoundingClientRect().top ?? 0;
		pullFrom = !$screenPanelOpen && screenMode === 'on' && e.clientY - top < PULL_ZONE ? e.clientY : null;
		lastTouch = Date.now();
		sentHome = false;
		if (screenMode !== 'on') {
			waking = true;
			setMode('on');
			setTimeout(() => (waking = false), 400);
		}
	}

	const simOpacity = $derived(
		screenMode === 'off' ? 0.96 : screenMode === 'dim' ? 0.65 : ((100 - brightness) / 100) * 0.7
	);
</script>

<svelte:head>
	<title>{names} — Smart Dashboard</title>
</svelte:head>

<svelte:window
	onpointerdowncapture={onTouch}
	onpointermove={(e) => {
		onPointerMove(e);
		pullMove(e);
	}}
	onpointerup={() => (pullFrom = null)}
	onpointercancel={() => (pullFrom = null)}
/>

<div id="pi-screen" class="sky-{sky}" bind:this={frame}>
	<!-- grab handle: hints that the quick menu pulls down from here (tap works too) -->
	<button class="pull-handle" onclick={() => screenPanelOpen.set(true)} aria-label="Open quick menu">
		<span></span>
	</button>
	<Header {names} />
	<main>
		{@render children()}
	</main>
	<BottomNav />
	<!-- Full-frame weather report panel (opened from the TODAY tab) -->
	<WeatherReport kids={data.kids} wardrobe={data.wardrobe} />
	<ScreenControl
		{brightness}
		min={data.screenConfig.minBrightness}
		onbrightness={onBrightness}
		onoff={() => setMode('off')}
	/>
	{#if simulate && simOpacity > 0}
		<div class="screen-sim" style="opacity:{simOpacity}" aria-hidden="true"></div>
	{/if}
	{#if screenMode !== 'on' || waking}
		<!-- dimmed / off: the first touch only wakes the screen, it doesn't press anything -->
		<div class="wake-catcher" aria-hidden="true"></div>
	{/if}
</div>

<style>
	.pull-handle {
		position: absolute;
		top: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 25;
		width: 84px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.55);
		border: 2px solid rgba(17, 24, 39, 0.35);
		border-top: none;
		border-radius: 0 0 12px 12px;
		touch-action: none;
	}
	.pull-handle span {
		width: 34px;
		height: 4px;
		border-radius: 2px;
		background: rgba(17, 24, 39, 0.55);
	}
	.screen-sim {
		position: absolute;
		inset: 0;
		z-index: 50;
		background: #000;
		pointer-events: none;
		transition: opacity 1s ease;
	}
	.wake-catcher {
		position: absolute;
		inset: 0;
		z-index: 51;
	}
</style>
