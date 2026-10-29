<script lang="ts">
	/**
	 * Idle screen: comes up when nobody has touched the kiosk for a while
	 * (Grown-ups tab -> Screen). The whole frame becomes the sky outside:
	 * sunny blue, drifting clouds, rain, snow, a storm flash, or stars at
	 * night, following the live forecast as it changes. On top: a big clock,
	 * the weather now, school today/tomorrow, a grown-up's note, and in
	 * festival season a banner ("Diwali in 3 sleeps!") with a festive garland.
	 * A tap anywhere closes it (onto TODAY).
	 *
	 * Only transform / opacity animate, on a handful of layers, so it stays
	 * cheap for the kiosk's software rendering (and pauses when the screen
	 * is off, see app.css).
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import FestiveTrim from '#lib/components/FestiveTrim.svelte';
	import ReadAloud from '#lib/components/ReadAloud.svelte';
	import { briefing } from '#lib/briefing';
	import { askOpen } from '#lib/screen';
	import { now, todayKey } from '#lib/clock';
	import { weather } from '#lib/weather';
	import { messages } from '#lib/messages';
	import { messagesOn } from '#lib/utils/messages';
	import { festivalBanner, themeFor } from '#lib/themes';
	import { place } from '#lib/place';
	import { weatherEmoji, weatherInfo, weatherLabel } from '#lib/utils/weatherCodes';
	import { greetingFor, hourLabel } from '#lib/utils/time';
	import { moonLitPath, moonPhase } from '#lib/utils/moon';
	import { STATUS_EMOJI, keyOf, parseKey, todayStatus, tomorrowStatus, type SchoolEvent } from '#lib/utils/schoolCalendar';

	let {
		names,
		schoolEvents,
		switchToTomorrowHour,
		readAloud,
		ask,
		onclose
	}: {
		names: string;
		schoolEvents: SchoolEvent[];
		/** from this hour on, school + weather talk about tomorrow (as on TODAY) */
		switchToTomorrowHour: number;
		/** the audio HAT is there: offer to read the day's briefing aloud */
		readAloud: boolean;
		/** offer the 🎤 Ask button */
		ask: boolean;
		onclose: () => void;
	} = $props();

	const wx = $derived($weather.data);
	const isDay = $derived(wx ? wx.current.is_day === 1 : $now.getHours() >= 7 && $now.getHours() < 19);
	const code = $derived(wx ? weatherEmoji(wx.current.weather_code, isDay) : null);

	// the sky behind everything follows the weather right now
	const scene = $derived.by(() => {
		const cat = wx ? weatherInfo(wx.current.weather_code).category : 'sunny';
		const kind =
			cat === 'sunny' || cat === 'partly' ? 'clear' : cat === 'drizzle' ? 'rain' : cat === 'fog' ? 'cloudy' : cat;
		return { kind, night: !isDay, clouds: cat !== 'sunny' && cat !== 'snow', fog: cat === 'fog' };
	});

	// ---- time ----
	const clock = $derived($now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).split(' '));
	const longDate = $derived($now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
	const theme = $derived(themeFor($now, $place));
	const hello = $derived(`${theme?.greeting ?? greetingFor($now)}, ${names}!`);
	const banner = $derived(theme ? festivalBanner(theme, $now) : null);

	// ---- school + the little chips ----
	const evening = $derived($now.getHours() >= switchToTomorrowHour);
	const tomorrowKey = $derived.by(() => {
		const d = parseKey($todayKey);
		d.setDate(d.getDate() + 1);
		return keyOf(d);
	});
	const school = $derived(
		evening ? tomorrowStatus(schoolEvents, tomorrowKey) : todayStatus(schoolEvents, $todayKey)
	);
	const note = $derived(messagesOn($messages, evening ? tomorrowKey : $todayKey)[0] ?? null);
	const tomorrow = $derived(evening ? (wx?.days[1] ?? null) : null);
	// daytime: the next wet hour today, if rain is likely
	const rainAt = $derived(evening || !wx ? null : (wx.hourly.slice(1, 12).find((h) => h.pop >= 50) ?? null));
	const moon = $derived(moonPhase($now));
	// 🔊 Read me: the AI briefing, shown as a caption while it's being said
	let talking = $state(false);
	// tonight's real moon up in the corner (clouds drift over it; hidden in rain / snow)
	const MOON_R = 38;
	const CRATERS = [[0.65, 0.74, 0.2], [1.3, 1.35, 0.15], [1.22, 0.52, 0.1], [0.6, 1.43, 0.11]]; // × radius
	const skyMoon = $derived(
		scene.night && moon.illumination > 3 && (scene.kind === 'clear' || scene.kind === 'cloudy')
			? moonLitPath(moon.fraction, MOON_R) : null
	);

	// ---- scenery bits: [left %, delay s, duration s] ----
	const DROPS = Array.from({ length: 18 }, (_, i) => [(i * 37) % 100, -((i * 0.53) % 1.4), 1 + (i % 4) * 0.12]);
	const FLAKES = Array.from({ length: 16 }, (_, i) => [(i * 41 + 7) % 100, -((i * 1.7) % 9), 7 + (i % 5)]);
	const STARS = [
		[6, 8], [18, 22], [31, 6], [44, 17], [57, 5], [69, 20], [82, 9], [94, 25], [12, 40], [88, 44]
	];
	const CLOUDS = [
		[6, 230, -10, 80],
		[30, 170, -55, 100],
		[52, 260, -30, 120]
	]; // [top %, size px, delay s, duration s]
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	class="idle scene-{scene.kind}"
	class:night={scene.night}
	class:diwali={theme?.id === 'diwali'}
	onclick={onclose}
	role="button"
	tabindex="-1"
	aria-label="Tap to start"
>
	<!-- ---------------- the sky ---------------- -->
	<div class="sky" aria-hidden="true">
		{#if scene.night}
			{#each STARS as [x, y], i (i)}
				<span class="star" style="left:{x}%; top:{y}%; animation-delay:{-i * 0.7}s"></span>
			{/each}
		{:else if scene.kind === 'clear'}
			<span class="sunglow"></span>
		{/if}
		{#if skyMoon}
			<svg class="moon" viewBox="-14 -14 {MOON_R * 2 + 28} {MOON_R * 2 + 28}" width={MOON_R * 2 + 28}>
				<defs>
					<radialGradient id="moon-halo">
						<stop offset=".55" stop-color="#FEF3C7" stop-opacity=".35" />
						<stop offset="1" stop-color="#FEF3C7" stop-opacity="0" />
					</radialGradient>
					<clipPath id="moon-lit"><path d={skyMoon} /></clipPath>
				</defs>
				<circle cx={MOON_R} cy={MOON_R} r={MOON_R + 14} fill="url(#moon-halo)" />
				<!-- the dark side, just visible -->
				<circle cx={MOON_R} cy={MOON_R} r={MOON_R} fill="#fff" fill-opacity=".1" stroke="#fff" stroke-opacity=".2" stroke-width="1.5" />
				<path d={skyMoon} fill="#FEF3C7" />
				<g clip-path="url(#moon-lit)" fill="#FDE68A">
					{#each CRATERS as [x, y, r], i (i)}<circle cx={x * MOON_R} cy={y * MOON_R} r={r * MOON_R} />{/each}
				</g>
			</svg>
		{/if}
		{#if scene.clouds}
			{#each CLOUDS as [top, size, delay, dur], i (i)}
				<span class="cloud" style="top:{top}%; animation-delay:{delay}s; animation-duration:{dur}s">
					<Emoji code="2601" {size} alt="" shadow="none" />
				</span>
			{/each}
		{/if}
		{#if scene.fog}
			<span class="fogband" style="top:38%"></span>
			<span class="fogband" style="top:66%; animation-delay:-6s"></span>
		{/if}
		{#if scene.kind === 'rain' || scene.kind === 'storm'}
			{#each DROPS as [x, delay, dur], i (i)}
				<span class="drop" style="left:{x}%; animation-delay:{delay}s; animation-duration:{dur}s"></span>
			{/each}
		{/if}
		{#if scene.kind === 'snow'}
			{#each FLAKES as [x, delay, dur], i (i)}
				<span class="flake" style="left:{x}%; animation-delay:{delay}s; animation-duration:{dur}s"></span>
			{/each}
		{/if}
		{#if scene.kind === 'storm'}<span class="flash"></span>{/if}
	</div>

	{#if theme}<FestiveTrim id={theme.id} festiveDay={theme.greeting !== null} />{/if}

	<!-- festive garland along the bottom -->
	{#if theme}
		<div class="garland" aria-hidden="true">
			{#each Array.from({ length: 9 }, (_, i) => theme.decor[i % theme.decor.length]) as decor, i (i)}
				<span class="garland-item" style="animation-delay:{-i * 0.45}s"><Emoji code={decor} size={40} alt="" /></span>
			{/each}
		</div>
	{/if}

	<!-- ---------------- what to know ---------------- -->
	<div class="content">
		{#if banner && theme}
			<div class="banner anim-pop">
				<Emoji code={theme.decor[0]} size={30} alt="" />
				<span>{banner}</span>
				<Emoji code={theme.decor[1]} size={30} alt="" />
			</div>
			{#if theme.mr}<div class="banner-mr anim-pop">{theme.mr}</div>{/if}
		{/if}

		<div class="main">
			<div class="time-side">
				<div class="clock">{clock[0]}<span class="ampm">{clock[1]}</span></div>
				<div class="date">{longDate}</div>
				<div class="hello">{hello}</div>
			</div>
			{#if wx && code}
				<div class="wx-card">
					<WeatherIcon {code} size={110} />
					<div class="wx-text">
						<div class="temp">{Math.round(wx.current.temp_f)}°</div>
						<div class="cond">{weatherLabel(wx.current.weather_code, isDay)}</div>
						{#if wx.days[0]}
							<div class="hilo">H {Math.round(wx.days[0].temp_max_f)}° · L {Math.round(wx.days[0].temp_min_f)}°</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<div class="chips">
			<div class="chip">
				<Emoji code={STATUS_EMOJI[school.kind]} size={28} alt="" />
				<span>{school.title}</span>
			</div>
			{#if tomorrow}
				<div class="chip">
					<span>Tomorrow</span>
					<Emoji code={weatherEmoji(tomorrow.code, true)} size={28} alt="" />
					<span>{Math.round(tomorrow.temp_max_f)}° / {Math.round(tomorrow.temp_min_f)}°</span>
				</div>
			{:else if rainAt}
				<div class="chip">
					<Emoji code="2614" size={28} alt="" />
					<span>Rain around {hourLabel(rainAt.time)}</span>
				</div>
			{:else if wx && Math.abs(wx.current.feels_f - wx.current.temp_f) >= 3}
				<div class="chip">
					<Emoji code="1f321" size={28} alt="" />
					<span>Feels like {Math.round(wx.current.feels_f)}°</span>
				</div>
			{/if}
			{#if scene.night}
				<div class="chip">
					<Emoji code={moon.emoji} size={28} alt="" />
					<span>{moon.name}</span>
				</div>
			{/if}
			{#if note}
				<div class="chip note">
					<Emoji code={note.emoji} size={28} alt="" />
					<span>{note.text}</span>
				</div>
			{/if}
		</div>
		{#if talking && $briefing}
			<div class="caption anim-pop">{$briefing.text}</div>
		{/if}
		<div class="foot">
			{#if readAloud && $briefing}
				<ReadAloud text={$briefing.text} label={$briefing.when === 'tomorrow' ? 'Read tomorrow' : 'Read me'} bind:talking />
			{/if}
			{#if ask}
				<button
					class="ask pressable"
					onclick={(e) => {
						e.stopPropagation();
						askOpen.set(true);
					}}
				>
					<Emoji code="1f3a4" size={30} alt="" shadow="none" /> Ask me
				</button>
			{/if}
			<div class="hint">Tap anywhere to start</div>
		</div>
	</div>
</div>

<style>
	.idle {
		position: absolute;
		inset: 0;
		z-index: 45;
		overflow: hidden;
		color: #fff;
		--ink: #1e293b;
		/* day, clear: a deep summer blue (a pale sky washes out white letters) */
		background: linear-gradient(180deg, #0369a1 0%, #0284c7 55%, #0ea5e9 100%);
		transition: background 2s ease;
	}
	.scene-cloudy {
		background: linear-gradient(180deg, #475569 0%, #64748b 55%, #94a3b8 100%);
	}
	.scene-rain {
		background: linear-gradient(180deg, #334155 0%, #475569 60%, #64748b 100%);
	}
	.scene-snow {
		background: linear-gradient(180deg, #475569 0%, #7c8ea8 55%, #cbd5e1 100%);
	}
	.scene-storm {
		background: linear-gradient(180deg, #1e1b4b 0%, #312e81 55%, #475569 100%);
	}
	.idle.night {
		background: linear-gradient(180deg, #0b1d4d 0%, #1e3a8a 60%, #3b4fa0 100%);
	}
	.idle.night.scene-cloudy,
	.idle.night.scene-rain,
	.idle.night.scene-storm {
		background: linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #334155 100%);
	}
	/* Diwali nights: lamp-lit plum sky glowing warm at the horizon */
	.idle.night.diwali.scene-clear,
	.idle.night.diwali.scene-cloudy {
		background: linear-gradient(180deg, #1e1b4b 0%, #4c1d95 55%, #9a3412 100%);
	}
	.idle.night.scene-snow {
		background: linear-gradient(180deg, #1e293b 0%, #334155 60%, #64748b 100%);
	}

	/* ---- sky layers (behind the content) ---- */
	.sky,
	.sky > * {
		position: absolute;
		pointer-events: none;
	}
	.sky {
		inset: 0;
	}
	.sky > * {
		will-change: transform, opacity;
	}
	.star {
		width: 12px;
		height: 12px;
		background: #fef9c3;
		clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
		animation: twinkle 3.5s ease-in-out infinite;
	}
	.moon {
		top: 6px;
		right: 18px;
		animation: moon-glow 6s ease-in-out infinite;
	}
	.sunglow {
		top: -140px;
		right: -140px;
		width: 420px;
		height: 420px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(254, 240, 138, 0.75) 0%, rgba(254, 240, 138, 0.25) 45%, transparent 70%);
		animation: glow 6s ease-in-out infinite;
	}
	.cloud {
		left: 0;
		display: flex;
		opacity: 0.55;
		animation: cloud-drift linear infinite;
	}
	.night .cloud {
		opacity: 0.25;
	}
	.fogband {
		left: -20%;
		width: 140%;
		height: 60px;
		border-radius: 999px;
		background: rgba(241, 245, 249, 0.35);
		animation: fog 14s ease-in-out infinite;
	}
	.drop {
		top: -40px;
		width: 4px;
		height: 26px;
		border-radius: 999px;
		background: rgba(191, 219, 254, 0.8);
		animation: rain linear infinite;
	}
	.flake {
		top: -20px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 0 1.5px rgba(100, 116, 139, 0.45);
		animation: snow linear infinite;
	}
	.flash {
		inset: 0;
		background: #fef9c3;
		opacity: 0;
		animation: flash 7s linear infinite;
	}

	/* ---- festive garland ---- */
	.garland {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -4px;
		display: flex;
		justify-content: space-around;
		pointer-events: none;
	}
	.garland-item {
		display: flex;
		animation: float 3s ease-in-out infinite;
		will-change: transform;
	}

	/* ---- content ---- */
	.content {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px 28px 50px;
	}
	/* comic lettering, like the stickers: white letters with a thick ink
	   outline (drawn under the fill) and a hard offset shadow, readable on
	   any sky — bright sun, snow or stars */
	.clock,
	.date,
	.hello,
	.banner-mr {
		paint-order: stroke fill;
		-webkit-text-stroke: 6px var(--ink);
		stroke-linejoin: round; /* no spike off the top of a "1" */
		text-shadow: 3px 4px 0 var(--ink);
	}
	.banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 20px;
		font-size: 24px;
		font-weight: 900;
		color: var(--text-dark);
		text-shadow: none;
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.banner-mr {
		margin-top: 4px;
		font-size: 20px;
		font-weight: 800;
		-webkit-text-stroke-width: 5px;
		text-shadow: 2px 3px 0 var(--ink);
	}
	.main {
		flex: 1;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
	}
	.time-side {
		min-width: 0;
	}
	.clock {
		font-size: 120px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -1px;
		-webkit-text-stroke-width: 12px;
		text-shadow: 5px 7px 0 var(--ink);
	}
	.ampm {
		margin-left: 10px;
		font-size: 38px;
		letter-spacing: 0;
	}
	.date {
		margin-top: 6px;
		font-size: 32px;
		font-weight: 900;
	}
	.hello {
		margin-top: 4px;
		font-size: 22px;
		font-weight: 900;
		-webkit-text-stroke-width: 5px;
		text-shadow: 2px 3px 0 var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wx-card {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 22px 14px 14px;
		color: var(--text-dark);
		text-shadow: none;
		background: rgba(255, 255, 255, 0.88);
		border: 3px solid var(--border-dark);
		border-radius: 24px;
		box-shadow: var(--sticker-shadow);
	}
	.temp {
		font-size: 72px;
		font-weight: 900;
		line-height: 1;
	}
	.cond {
		font-size: 22px;
		font-weight: 900;
	}
	.hilo {
		font-size: 17px;
		font-weight: 800;
		color: #475569;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 10px;
		max-width: 100%;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 100%;
		padding: 6px 16px 6px 10px;
		font-size: 19px;
		font-weight: 900;
		color: var(--text-dark);
		text-shadow: none;
		white-space: nowrap;
		background: rgba(255, 255, 255, 0.9);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.chip span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.chip.note {
		background: #dcfce7;
	}
	.ask {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 54px;
		padding: 0 20px 0 12px;
		font: 900 21px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		text-shadow: none;
		background: #a5f3fc;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 10px;
	}
	/* the briefing, while it's being read out */
	.caption {
		position: absolute;
		left: 50px;
		right: 50px;
		bottom: 112px;
		z-index: 2;
		padding: 14px 22px;
		font-size: 24px;
		font-weight: 900;
		line-height: 1.3;
		text-align: center;
		color: var(--text-dark);
		text-shadow: none;
		background: #fffbeb;
		border: 3px solid var(--border-dark);
		border-radius: 20px;
		box-shadow: var(--sticker-shadow);
	}
	.hint {
		padding: 2px 14px;
		font-size: 15px;
		font-weight: 800;
		background: rgba(15, 23, 42, 0.55);
		border-radius: 999px;
	}

	@keyframes twinkle {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.3;
			transform: scale(0.6);
		}
	}
	@keyframes moon-glow {
		0%,
		100% {
			opacity: 0.9;
		}
		50% {
			opacity: 1;
		}
	}
	@keyframes glow {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.08);
		}
	}
	@keyframes cloud-drift {
		from {
			transform: translateX(-280px);
		}
		to {
			transform: translateX(820px);
		}
	}
	@keyframes fog {
		0%,
		100% {
			transform: translateX(-6%);
		}
		50% {
			transform: translateX(6%);
		}
	}
	@keyframes rain {
		from {
			transform: translate(0, 0);
		}
		to {
			transform: translate(-30px, 540px);
		}
	}
	@keyframes snow {
		0% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(24px, 250px);
		}
		100% {
			transform: translate(-10px, 520px);
		}
	}
	@keyframes flash {
		0%,
		80%,
		84%,
		88%,
		100% {
			opacity: 0;
		}
		82%,
		86% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.idle * {
			animation: none !important;
		}
	}
</style>
