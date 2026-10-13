<script lang="ts">
	/**
	 * The full weather report: a slide-down card over the whole screen.
	 * A kid's buddy "reports" the day (dressed for it), then the hours as a
	 * temperature hill with rain chances, then fun tiles for rain, wind,
	 * the sun's arc and sunscreen. Today / Tomorrow via the pills or a
	 * left/right swipe; swipe up, ✕ or a tap outside closes it.
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { reportState, closeReport } from '#lib/report';
	import { weather, loadWeather } from '#lib/weather';
	import { now } from '#lib/clock';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { clockTime, hourLabel } from '#lib/utils/time';
	import { outfitForDay, type WardrobeThresholds } from '#lib/utils/wardrobe';
	import {
		airInfo,
		alertAdvice,
		alertLevel,
		daylight,
		skyStory,
		sunProgress,
		tempColor,
		uvInfo,
		windWord
	} from '#lib/utils/forecastStory';
	import { moonPhase } from '#lib/utils/moon';
	import { parseKey } from '#lib/utils/schoolCalendar';
	import type { Kid } from '#lib/config';

	let { kids, wardrobe }: { kids: Kid[]; wardrobe: WardrobeThresholds } = $props();

	// Live, shared forecast (refreshed in the background by the root layout).
	const data = $derived($weather.data);
	let selected = $state(0); // 0 = today, 1 = tomorrow

	$effect(() => {
		if ($reportState.open) selected = $reportState.day;
	});

	const day = $derived(data?.days[selected] ?? null);
	// today: the coming hours; tomorrow: its waking day (6 AM - 10 PM)
	const hours = $derived(data && day ? (selected === 0 ? data.hourly.slice(0, 9) : day.hours) : []);
	const story = $derived(day ? skyStory(day, selected === 0 ? data!.hourly.slice(0, 9) : day.hours) : '');

	// the reporter: kids take turns (today / tomorrow), dressed for that day
	const kid = $derived(kids[selected % kids.length]);
	const outfitNames = $derived(day ? outfitForDay(day, wardrobe).items.map((i) => i.name) : []);

	// temperature hill: dot height within the shown range
	const temps = $derived(hours.map((h) => h.temp_f));
	const tMin = $derived(Math.min(...temps));
	const tMax = $derived(Math.max(...temps));
	const yPct = (t: number) => 18 + (1 - (t - tMin) / (tMax - tMin || 1)) * 64;
	const xPct = (i: number) => ((i + 0.5) / hours.length) * 100;
	const hillPath = $derived(hours.map((h, i) => `${i ? 'L' : 'M'}${xPct(i)} ${yPct(h.temp_f)}`).join(' '));

	const wind = $derived(windWord(day?.wind_mph ?? 0));
	const uv = $derived(uvInfo(day?.uv_max ?? null));
	const air = $derived(airInfo(data?.air?.aqi));
	// the moon that night (9 PM of the selected day)
	const moon = $derived.by(() => {
		if (!day) return null;
		const d = parseKey(day.date);
		d.setHours(21);
		return moonPhase(d);
	});
	const sunAt = $derived(
		selected === 0 && day?.sunrise && day?.sunset ? sunProgress($now, day.sunrise, day.sunset) : null
	);
	// point on the sun arc (semicircle, centre 40,40, radius 32)
	const sunPos = $derived(
		sunAt === null ? null : { x: 40 - 32 * Math.cos(Math.PI * sunAt), y: 40 - 32 * Math.sin(Math.PI * sunAt) }
	);

	/* ---------- gestures: swipe up closes, left/right switches day ---------- */
	let start: { x: number; y: number } | null = null;
	function onDown(e: PointerEvent) {
		start = { x: e.clientX, y: e.clientY };
	}
	function onUp(e: PointerEvent) {
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (Math.abs(dy) > Math.abs(dx) && dy < -40) closeReport();
		else if (Math.abs(dx) > 50 && data && data.days.length > 1) selected = dx < 0 ? 1 : 0;
	}
	function onScrimDown(e: PointerEvent) {
		if (e.target === e.currentTarget) closeReport();
	}
</script>

{#if $reportState.open}
	<!-- svelte-ignore a11y_no_static_element_interactions (scrim tap = close; ✕ button is the accessible path) -->
	<div class="overlay" onpointerdown={onScrimDown}>
		<div
			class="card report"
			class:has-alert={(data?.alerts.length ?? 0) > 0}
			role="dialog"
			aria-modal="true"
			aria-label="Full weather report"
			tabindex="-1"
			onpointerdown={(e) => {
				e.stopPropagation();
				onDown(e);
			}}
			onpointerup={onUp}
			onpointerleave={() => (start = null)}
		>
			<div class="report-head">
				<div class="section-title">Weather Report</div>
				<div class="day-pills" role="tablist">
					{#each ['Today', 'Tomorrow'] as label, i (label)}
						{#if !data || data.days[i]}
							<button
								class="day-pill pressable"
								class:on={selected === i}
								role="tab"
								aria-selected={selected === i}
								onclick={() => (selected = i)}
							>
								{label}
							</button>
						{/if}
					{/each}
				</div>
				<button class="close-btn pressable" onclick={closeReport} aria-label="Close weather report">
					<Emoji code="274c" size={20} alt="Close" shadow="none" />
				</button>
			</div>

			{#if !data && !$weather.error}
				<div class="loading">
					<Emoji code="2601" size={54} alt="" class="anim-float" />
					<div class="loading-text">Loading the sky…</div>
				</div>
			{:else if !data || !day}
				<div class="loading">
					<Emoji code="26c5" size={54} alt="" />
					<div class="loading-text">Could not load the weather.</div>
					<button class="retry pressable" onclick={loadWeather}>Try again</button>
				</div>
			{:else}
				{#each data.alerts as a (a.event + a.ends)}
					{@const tip = alertAdvice(a.event)}
					<div class="alert-strip alert-{alertLevel(a.severity)}">
						<Emoji code="26a0" size={22} alt="" shadow="none" />
						<div class="alert-text">
							<b>{a.event}</b>{#if a.ends}<span> · until {clockTime(new Date(a.ends))}</span>{/if}
							<div class="alert-tip">{tip.advice}</div>
						</div>
						<Emoji code={tip.emoji} size={24} alt="" shadow="none" />
					</div>
				{/each}
				<!-- hero: the day at a glance + the buddy's report -->
				<div class="hero">
					<div class="hero-wx">
						{#key selected}
							<WeatherIcon code={weatherEmoji(day.code, true)} size={data.alerts.length ? 60 : 78} class="anim-pop" />
						{/key}
						<div class="hero-text">
							<div class="hero-label">{weatherLabel(day.code, true)}</div>
							<div class="hero-temps">
								<span style="color:{tempColor(day.temp_max_f)}">{Math.round(day.temp_max_f)}°</span>
								<span class="lo">/ {Math.round(day.temp_min_f)}°</span>
							</div>
							<div class="hero-loc">
								{data.location}{#if data.stale || $weather.error}&nbsp;· updated {clockTime(new Date(data.fetched_at))}{/if}
							</div>
						</div>
					</div>

					<div class="bubble">
						<div class="bubble-who">{kid.name} says:</div>
						{#key story}<div class="bubble-text anim-pop">{story}</div>{/key}
					</div>

					<div class="reporter">
						<KidAvatar {kid} items={outfitNames} size={data.alerts.length ? 100 : 128} />
					</div>
				</div>

				<!-- hours: icons, temperature hill, rain chances -->
				<div class="hours" style="--n:{hours.length}">
					<div class="hours-row">
						{#each hours as h, i (h.time)}
							<div class="hour" class:night={!h.is_day}>
								<span class="hour-time">{selected === 0 && i === 0 ? 'Now' : hourLabel(h.time)}</span>
								<Emoji code={weatherEmoji(h.weather_code, h.is_day === 1)} size={30} alt="" />
							</div>
						{/each}
					</div>
					<div class="hill">
						<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
							<path d={hillPath} fill="none" stroke="var(--border-dark)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
						</svg>
						{#each hours as h, i (h.time)}
							<div class="dot" style="left:{xPct(i)}%; top:{yPct(h.temp_f)}%; background:{tempColor(h.temp_f)}"></div>
							<div class="dot-temp" style="left:{xPct(i)}%; top:{yPct(h.temp_f)}%">{Math.round(h.temp_f)}°</div>
						{/each}
					</div>
					<div class="hours-row">
						{#each hours as h (h.time)}
							<div class="rain" class:wet={h.pop >= 40}>
								<Emoji code="1f4a7" size={11} alt="" shadow="none" />{h.pop}%
							</div>
						{/each}
					</div>
				</div>

				<!-- fun tiles -->
				<div class="tiles">
					<div class="tile rain-tile">
						<Emoji code="2614" size={30} alt="" />
						<div class="tile-body">
							<div class="tile-big">Rain {Math.round(day.rain_max)}%</div>
							<div class="meter"><div class="meter-fill" style="width:{day.rain_max}%"></div></div>
						</div>
					</div>
					<div class="tile">
						<Emoji code={wind.emoji} size={30} alt="" />
						<div class="tile-body">
							<div class="tile-big">{wind.word}</div>
							<div class="tile-small">wind {Math.round(day.wind_mph)} mph</div>
						</div>
					</div>
					<div class="tile sun-tile">
						<svg viewBox="0 0 80 44" width="52" height="29" aria-hidden="true">
							<path d="M8 40 A32 32 0 0 1 72 40" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="4 5" stroke-linecap="round" />
							<line x1="2" y1="40" x2="78" y2="40" stroke="var(--border-dark)" stroke-width="3" stroke-linecap="round" />
							{#if sunPos}
								<circle cx={sunPos.x} cy={sunPos.y} r="7" fill="#facc15" stroke="var(--border-dark)" stroke-width="2.5" />
							{/if}
						</svg>
						<div class="tile-body">
							{#if day.sunrise && day.sunset}
								<div class="tile-big">Sun up {clockTime(new Date(day.sunrise))}</div>
								<div class="tile-small">down {clockTime(new Date(day.sunset))} · {daylight(day.sunrise, day.sunset)}</div>
							{:else}
								<div class="tile-big">Sun times —</div>
							{/if}
						</div>
					</div>
					<div class="tile uv-{uv.level}">
						<Emoji code={uv.emoji} size={30} alt="" />
						<div class="tile-body">
							<div class="tile-big">{uv.word}</div>
							<div class="tile-small">UV {day.uv_max == null ? '—' : Math.round(day.uv_max)}</div>
						</div>
					</div>
					<div class="tile air-{air.level}">
						<Emoji code={air.emoji} size={30} alt="" />
						<div class="tile-body">
							<div class="tile-big">{air.word}</div>
							<div class="tile-small">
								{data.air ? `air quality ${data.air.aqi} now` : 'no reading'}
							</div>
						</div>
					</div>
					{#if moon}
						<div class="tile moon-tile">
							<Emoji code={moon.emoji} size={30} alt="" shadow="none" />
							<div class="tile-body">
								<div class="tile-big">{moon.name}</div>
								<div class="tile-small">{selected === 0 ? 'tonight' : 'tomorrow night'} · {moon.illumination}% lit</div>
							</div>
						</div>
					{/if}
				</div>

				<div class="swipe-hint">
					<Emoji code="2b06" size={13} alt="" shadow="none" /> swipe up to close · swipe sideways for {selected === 0 ? 'tomorrow' : 'today'}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 30;
		display: flex;
		background: rgba(17, 24, 39, 0.3);
	}

	.report {
		flex: 1;
		margin: 8px;
		padding: 10px 14px 6px;
		gap: 8px;
		overflow: hidden;
		background: linear-gradient(180deg, #e0f2fe 0%, #ffffff 55%);
		animation: slide-down 0.22s ease-out both;
		touch-action: none;
	}

	/* --- header --- */
	.report-head {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.report-head .section-title {
		margin: 0;
		font-size: 17px;
	}
	.day-pills {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.day-pill {
		height: 36px;
		padding: 0 18px;
		font: 900 16px 'Nunito', sans-serif;
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		background: var(--card-white);
		box-shadow: var(--sticker-shadow-sm);
	}
	.day-pill.on {
		background: var(--yellow-banner);
	}
	.close-btn {
		width: 38px;
		height: 38px;
		border: 3px solid var(--border-dark);
		border-radius: 50%;
		background: var(--tab-red);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--sticker-shadow-sm);
		flex: 0 0 auto;
	}

	.loading {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}
	.loading-text {
		font-size: 18px;
		font-weight: 800;
		opacity: 0.7;
	}
	.retry {
		font: 900 14px 'Nunito', sans-serif;
		background: var(--yellow-banner);
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		padding: 6px 18px;
		box-shadow: var(--sticker-shadow-sm);
	}

	/* --- hero --- */
	.hero {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 0;
	}
	.hero-wx {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
	}
	.hero-label {
		font-size: 18px;
		font-weight: 900;
		line-height: 1.1;
	}
	.hero-temps {
		font-size: 40px;
		font-weight: 900;
		line-height: 1;
		-webkit-text-stroke: 1.5px var(--border-dark);
	}
	.hero-temps .lo {
		font-size: 24px;
		color: #475569;
		-webkit-text-stroke: 0;
	}
	.hero-loc {
		font-size: 13px;
		font-weight: 800;
		opacity: 0.6;
		white-space: nowrap;
	}

	/* speech bubble, tail pointing at the buddy */
	.bubble {
		flex: 1;
		position: relative;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 18px;
		padding: 8px 12px;
		box-shadow: var(--sticker-shadow-sm);
		min-width: 0;
	}
	.bubble::after {
		content: '';
		position: absolute;
		right: -13px;
		top: 50%;
		width: 18px;
		height: 18px;
		background: var(--card-white);
		border-right: 3px solid var(--border-dark);
		border-top: 3px solid var(--border-dark);
		transform: translateY(-50%) rotate(45deg) skew(10deg, 10deg);
	}
	.bubble-who {
		font-size: 13px;
		font-weight: 900;
		color: #7c3aed;
	}
	.bubble-text {
		font-size: 17px;
		font-weight: 900;
		line-height: 1.25;
	}
	.reporter {
		flex: 0 0 auto;
		margin: -6px 0 -8px;
	}

	/* --- hours strip --- */
	.hours {
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		box-shadow: var(--sticker-shadow-sm);
		overflow: hidden;
	}
	.hours-row {
		display: grid;
		grid-template-columns: repeat(var(--n), 1fr);
	}
	.hour {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 4px 0 2px;
	}
	.hour.night {
		background: #dbeafe;
	}
	.hour-time {
		font-size: 13px;
		font-weight: 900;
	}
	.hill {
		position: relative;
		height: 58px;
		background: linear-gradient(180deg, #fff7ed, #f0f9ff);
		border-top: 2px dashed #cbd5e1;
		border-bottom: 2px dashed #cbd5e1;
	}
	/* an alert strip takes ~50px: squeeze the hill a little to make room */
	.has-alert .hill {
		height: 42px;
	}
	.has-alert .hero-temps {
		font-size: 34px;
	}
	.has-alert .swipe-hint {
		display: none;
	}
	.hours,
	.tiles {
		flex-shrink: 0;
	}
	.hill svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.dot {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2.5px solid var(--border-dark);
		transform: translate(-50%, -50%);
	}
	.dot-temp {
		position: absolute;
		transform: translate(-50%, -135%);
		font-size: 13px;
		font-weight: 900;
		white-space: nowrap;
	}
	.rain {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		font-size: 12.5px;
		font-weight: 800;
		color: #64748b;
		padding: 3px 0;
	}
	.rain.wet {
		color: #1d4ed8;
		background: #dbeafe;
	}

	/* --- fun tiles --- */
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1.25fr 1fr;
		gap: 7px 10px;
	}
	.tile {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-light-blue);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		padding: 4px 10px;
		box-shadow: var(--sticker-shadow-sm);
		min-width: 0;
	}
	.tile-body {
		min-width: 0;
		flex: 1;
	}
	.tile-big {
		font-size: 16px;
		font-weight: 900;
		line-height: 1.15;
		white-space: nowrap;
	}
	.tile-small {
		font-size: 12.5px;
		font-weight: 800;
		color: #475569;
		white-space: nowrap;
	}
	.meter {
		margin-top: 4px;
		height: 10px;
		border: 2px solid var(--border-dark);
		border-radius: 999px;
		background: var(--card-white);
		overflow: hidden;
	}
	.meter-fill {
		height: 100%;
		background: #3b82f6;
	}
	.sun-tile {
		background: #fef9c3;
		gap: 4px;
	}
	.sun-tile .tile-small {
		font-size: 11.5px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.uv-high,
	.air-bad {
		background: #fee2e2;
	}
	.air-good {
		background: #dcfce7;
	}
	.moon-tile {
		background: #e0e7ff;
	}
	.alert-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		padding: 4px 10px;
		font-size: 14px;
		font-weight: 800;
		box-shadow: var(--sticker-shadow-sm);
	}
	.alert-strip b {
		font-weight: 900;
		font-size: 15px;
	}
	.alert-text {
		flex: 1;
		min-width: 0;
		line-height: 1.2;
	}
	.alert-tip {
		font-size: 13px;
	}
	.alert-red {
		background: #ef4444;
		color: #ffffff;
	}
	.alert-orange {
		background: #fb923c;
	}
	.alert-yellow {
		background: #fde047;
	}
	.uv-mid {
		background: #fef3c7;
	}

	.swipe-hint {
		margin-top: auto;
		text-align: center;
		font-size: 12.5px;
		font-weight: 800;
		opacity: 0.55;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
</style>
