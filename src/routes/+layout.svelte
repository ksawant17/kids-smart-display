<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page, updated } from '$app/state';
	import '../app.css';
	import Header from '#lib/components/Header.svelte';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import WeatherReport from '#lib/components/WeatherReport.svelte';
	import ScreenControl from '#lib/components/ScreenControl.svelte';
	import PowerMenu from '#lib/components/PowerMenu.svelte';
	import IdleScreen from '#lib/components/IdleScreen.svelte';
	import AskSheet from '#lib/components/AskSheet.svelte';
	import { kidNames } from '#lib/config';
	import {
		READING_GRACE_MS,
		askOpen,
		awakeMode,
		inBedtime,
		modeForIdle,
		reading,
		screenPanelOpen,
		type ScreenMode
	} from '#lib/screen';
	import { messages, startMessages } from '#lib/messages';
	import { briefing, briefingFacts } from '#lib/briefing';
	import { now, todayKey } from '#lib/clock';
	import { closeReport } from '#lib/report';
	import { startWeather, weather } from '#lib/weather';
	import { skyPhase } from '#lib/sky';
	import { place } from '#lib/place';

	let { data, children } = $props();

	const names = $derived(kidNames(data.kids));
	$effect(() => place.set(data.place));

	// background follows the real sky: dawn / day / dusk / starry night
	const sky = $derived(
		skyPhase($now, $weather.data?.days[0]?.sunrise, $weather.data?.days[0]?.sunset)
	);

	// One shared weather feed for every page, refreshed in the background.
	onMount(() => startWeather(data.weatherRefreshMinutes));
	// grown-up notes for the TODAY banner
	onMount(() => startMessages());

	// The AI briefing for TODAY and the idle screen: asked for again only when
	// the facts on screen change (the server keeps the answer for the same facts)
	const facts = $derived(
		data.ai.briefing
			? briefingFacts({
					wx: $weather.data,
					now: $now,
					todayKey: $todayKey,
					wardrobe: data.wardrobe,
					schoolEvents: data.schoolEvents,
					messages: $messages,
					place: data.place
				})
			: ''
	);
	$effect(() => {
		const body = facts;
		if (!body) return void briefing.set(null);
		const when = JSON.parse(body).when;
		let live = true;
		fetch('/api/briefing', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
			.then((r) => (r.ok ? r.json() : null))
			.then((r) => live && briefing.set(r?.text ? { text: r.text, when } : null))
			.catch(() => {});
		return () => (live = false);
	});

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

	// Idle: after a while without touches, close overlays and go back to TODAY,
	// with the idle screen (big clock + weather) on top when it is turned on.
	let lastTouch = $state(Date.now());
	let sentHome = false; // once per idle stretch
	let idleScreen = $state(false);
	// time since the last touch, less a grace while a story is being read
	const idleFor = (t: number) => Math.max(0, t - lastTouch - ($reading ? READING_GRACE_MS : 0));
	onMount(() => {
		// kiosk debugging aid: /?idle shows the idle screen straight away
		if (new URL(location.href).searchParams.has('idle')) idleScreen = true;
	});
	$effect(() => {
		// read the clock and lastTouch first, every run: an early return before
		// them would drop the effect's dependencies and stop it for good
		const idle = idleFor($now.getTime());
		const idleMs = data.kiosk.idleReturnSeconds * 1000;
		if (!idleMs || sentHome || idle < idleMs) return;
		sentHome = true;
		closeReport();
		screenPanelOpen.set(false);
		powerMenu = false;
		if (data.kiosk.idleScreen) idleScreen = true;
		// a failed navigation (server busy restarting) tries again on the next tick
		if (page.url.pathname !== '/') goto('/').catch(() => (sentHome = false));
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

	// screen off: pause every CSS animation (software rendering repaints them
	// all night otherwise, for nobody)
	$effect(() => {
		document.documentElement.classList.toggle('screen-off', screenMode === 'off');
	});

	// bedtime (quiet hours): dim while in use, off a minute after the last touch
	const bedtime = $derived(inBedtime($now, data.bedtime));
	const awake = $derived(awakeMode(bedtime));

	// idle: only ever go darker here; only a touch brings the screen back
	$effect(() => {
		const want = modeForIdle(idleFor($now.getTime()), data.screenConfig, bedtime);
		if (RANK[want] > RANK[screenMode]) setMode(want);
	});

	// ...except in the morning: when bedtime ends, the screen wakes up by itself
	let wasBedtime = untrack(() => bedtime);
	$effect(() => {
		if (wasBedtime && !bedtime) {
			lastTouch = Date.now();
			setMode('on');
		}
		wasBedtime = bedtime;
	});

	/* ---- the top push button (GPIO, see src/lib/server/button.ts) ----
	   tap: screen off <-> idle screen (from a tab: the idle screen first)
	   hold: power menu */
	let powerMenu = $state(false);
	function wake() {
		lastTouch = Date.now();
		sentHome = false;
		setMode(awake);
	}
	// the button's way back: the idle screen over TODAY, like after a quiet spell
	function showIdle() {
		wake();
		closeReport();
		screenPanelOpen.set(false);
		idleScreen = true;
		if (page.url.pathname !== '/') goto('/').catch(() => {});
	}
	function onButton(gesture: string) {
		if (gesture === 'hold') {
			wake();
			screenPanelOpen.set(false);
			powerMenu = true;
		} else if (gesture === 'tap') {
			if (powerMenu) powerMenu = false;
			else if (RANK[screenMode] > RANK[awake] || !idleScreen) showIdle();
			else setMode('off');
		}
	}
	onMount(() => {
		// only the kiosk browser on the Pi itself listens (not a phone)
		if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
		const events = new EventSource('/api/button');
		events.onmessage = (e) => onButton(e.data);
		return () => events.close();
	});

	// A new version was installed (admin tab "Update", or a rebuild): reload
	// the kiosk page once nobody has touched it for a little while.
	$effect(() => {
		if (updated.current && $now.getTime() - lastTouch > 20_000) location.reload();
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

	// the audio HAT's volume + mic switch (quick menu): the slider is saved,
	// with a spoken "This loud!", when it's let go
	let volume = $state(untrack(() => data.voice.volume));
	let mic = $state(untrack(() => data.voice.mic));
	function postVoice(change: { volume?: number; mic?: boolean; sample?: boolean }) {
		fetch('/api/voice', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(change)
		}).catch(() => {});
	}
	function onVolume(value: number, done: boolean) {
		volume = value;
		if (done) postVoice({ volume, sample: true });
	}
	function onMic(on: boolean) {
		mic = on;
		postVoice({ mic });
	}
	// 🎤 Ask: the audio HAT's mic is on and the AI helper may answer
	const canAsk = $derived(data.ai.ask && data.voice.listen && mic);

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
		pullFrom = !idleScreen && !$screenPanelOpen && screenMode === awake && e.clientY - top < PULL_ZONE ? e.clientY : null;
		lastTouch = Date.now();
		sentHome = false;
		if (RANK[screenMode] > RANK[awake]) {
			waking = true;
			setMode(awake);
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
	<Header {names} ask={canAsk} />
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
		voice={data.voice.installed ? { volume, mic } : null}
		onvolume={onVolume}
		onmic={onMic}
		onoff={() => setMode('off')}
	/>
	{#if idleScreen}
		<!-- a tap closes it onto TODAY (the tap itself doesn't press anything) -->
		<IdleScreen
			{names}
			schoolEvents={data.schoolEvents}
			switchToTomorrowHour={data.wardrobe.switchToTomorrowHour}
			readAloud={data.voice.installed && data.voice.enabled}
			ask={canAsk}
			onclose={() => (idleScreen = false)}
		/>
	{/if}
	{#if $askOpen && canAsk}
		<AskSheet {facts} />
	{/if}
	{#if powerMenu}
		<PowerMenu
			onclose={() => (powerMenu = false)}
			onscreenoff={() => {
				powerMenu = false;
				setMode('off');
			}}
		/>
	{/if}
	{#if simulate && simOpacity > 0}
		<div class="screen-sim" style="opacity:{simOpacity}" aria-hidden="true"></div>
	{/if}
	{#if RANK[screenMode] > RANK[awake] || waking}
		<!-- dimmed / off: the first touch only wakes the screen, it doesn't press anything -->
		<div class="wake-catcher" aria-hidden="true"></div>
	{/if}
</div>

<style>
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
