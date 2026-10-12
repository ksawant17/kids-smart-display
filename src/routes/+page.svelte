<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { openReport } from '#lib/report';
	import { weather } from '#lib/weather';
	import { now, todayKey } from '#lib/clock';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { outfitForDay, outfitDayIndex } from '#lib/utils/wardrobe';
	import { STATUS_EMOJI, keyOf, parseKey, todayStatus, tomorrowStatus } from '#lib/utils/schoolCalendar';
	import { clockTime, hourLabel, pickDaily } from '#lib/utils/time';
	import { alertAdvice, alertLevel } from '#lib/utils/forecastStory';
	import quotes from '#lib/data/quotes.json';

	let { data } = $props();

	onMount(() => {
		// kiosk debugging aid: /?wx opens the full weather report, /?wx&d=1 selects tomorrow
		const sp = new URL(location.href).searchParams;
		if (sp.has('wx')) openReport(Number(sp.get('d')) || 0);
	});

	const wx = $derived($weather.data);
	const today = $derived(wx?.days[0]);
	const tomorrow = $derived(wx?.days[1]);

	// --- evening look-ahead: from 6 PM (wardrobe.switchToTomorrowHour) TODAY talks about tomorrow ---
	const evening = $derived($now.getHours() >= data.wardrobe.switchToTomorrowHour);
	const tomorrowKey = $derived.by(() => {
		const d = parseKey($todayKey);
		d.setDate(d.getDate() + 1);
		return keyOf(d);
	});

	// --- school status (district calendar) ---
	const schoolToday = $derived(
		evening ? tomorrowStatus(data.schoolEvents, tomorrowKey) : todayStatus(data.schoolEvents, $todayKey)
	);
	// weather alerts take turns with the school status (15 s each, on the clock tick)
	const alerts = $derived(wx?.alerts ?? []);
	const alertTurn = $derived(alerts.length > 0 && Math.floor($now.getTime() / 15000) % 2 === 1);
	const alert = $derived(alertTurn ? alerts[Math.floor($now.getTime() / 30000) % alerts.length] : null);

	// next few hours, or tomorrow morning (the bus-stop hours) in the evening
	const strip = $derived(
		wx ? (evening && wx.days[1]?.hours.length ? wx.days[1].hours.slice(0, 4) : wx.hourly.slice(0, 4)) : []
	);
	const stripIsTomorrow = $derived(evening && !!wx?.days[1]?.hours.length);


	// --- quote of the day (rotates at midnight) ---
	const quote = $derived(pickDaily(quotes, $now));
	const quoteSize = $derived(quote.text.length < 70 ? 'q-lg' : quote.text.length < 105 ? 'q-md' : 'q-sm');

	// --- what to wear: today until the evening (6 PM by default), then tomorrow ---
	const outfitIdx = $derived(outfitDayIndex($now, data.wardrobe.switchToTomorrowHour));
	const outfitDay = $derived(wx?.days[outfitIdx]);
	const outfit = $derived(outfitDay ? outfitForDay(outfitDay, data.wardrobe) : null);
	const avatarSize = $derived(data.kids.length > 2 ? 100 : data.kids.length === 2 ? 142 : 165);
	const outfitNames = $derived(outfit ? outfit.items.map((i) => i.name) : []);

	// --- swipe down on the hero opens the full report (tap does too) ---
	let startY: number | null = null;
	function heroDown(e: PointerEvent) {
		startY = e.clientY;
	}
	function heroUp(e: PointerEvent) {
		if (startY === null) return;
		const dy = e.clientY - startY;
		startY = null;
		if (dy > 40) openReport(0);
	}
</script>

{#if !wx || !today}
	<div class="card load-card">
		{#if $weather.error}
			<Emoji code="26c5" size={64} alt="" />
			<div class="load-text">Can't reach the weather right now. Trying again soon…</div>
		{:else}
			<Emoji code="2601" size={64} alt="" class="anim-float" />
			<div class="load-text">Checking the sky…</div>
		{/if}
	</div>
{:else}
	<div class="today-grid">
		<!-- Column 1 · left: current weather -->
		<div class="left-col">
			<div
				class="card hero-card pressable"
				role="button"
				tabindex="0"
				aria-label="Today's weather. Tap for the full report."
				onclick={() => openReport(0)}
				onkeydown={(e) => e.key === 'Enter' && openReport(0)}
				onpointerdown={heroDown}
				onpointerup={heroUp}
			>
				<div class="hero-top">
					<div class="hero-temp">{Math.round(wx.current.temp_f)}&deg;</div>
					<Emoji
						code={weatherEmoji(wx.current.weather_code, wx.current.is_day === 1)}
						size={80}
						alt=""
						class="hero-icon anim-pop"
					/>
				</div>
				<div class="hero-desc">{weatherLabel(wx.current.weather_code, wx.current.is_day === 1)}</div>
				{#if wx.stale || $weather.error}
					<div class="hero-stale">updated {clockTime(new Date(wx.fetched_at))}</div>
				{/if}
			</div>

			<!-- tap the hours: the full report (tomorrow's when they show tomorrow morning) -->
			<div
				class="hourly-row pressable"
				role="button"
				tabindex="0"
				aria-label={stripIsTomorrow ? 'Tomorrow morning. Tap for the full report.' : 'Next few hours. Tap for the full report.'}
				onclick={() => openReport(stripIsTomorrow ? 1 : 0)}
				onkeydown={(e) => e.key === 'Enter' && openReport(stripIsTomorrow ? 1 : 0)}
			>
				{#each strip as h, i (h.time)}
					<div class="hour-box">
						{#if stripIsTomorrow && i === 0}<span class="tomorrow-badge">Tomorrow</span>{/if}
						<span>{i === 0 && !stripIsTomorrow ? 'Now' : hourLabel(h.time)}</span>
						<Emoji code={weatherEmoji(h.weather_code, h.is_day === 1)} size={28} alt="" />
						<span>{Math.round(h.temp_f)}&deg;</span>
					</div>
				{/each}
			</div>

			{#if alert}
				{@const tip = alertAdvice(alert.event)}
				<button class="school-banner alert-{alertLevel(alert.severity)} pressable" onclick={() => openReport(0)}>
					<div class="banner-row">
						<Emoji code="26a0" size={18} alt="" shadow="none" />
						<span>{alert.event}</span>
					</div>
					<div class="banner-row sub">
						<Emoji code={tip.emoji} size={16} alt="" shadow="none" />
						<span>{tip.advice}</span>
					</div>
				</button>
			{:else}
				<!-- tap: the calendar, with that day's details open -->
				<button
					class="school-banner kind-{schoolToday.kind} pressable"
					aria-label="{schoolToday.title}. Tap for the school calendar."
					onclick={() => goto(`/calendar?day=${evening ? tomorrowKey : $todayKey}`)}
				>
					<div class="banner-row">
						<Emoji code={STATUS_EMOJI[schoolToday.kind]} size={18} alt="" shadow="none" />
						<span>{schoolToday.title}</span>
					</div>
					{#if schoolToday.subtitle}
						<div class="banner-row sub">
							<Emoji code="1f31f" size={16} alt="" shadow="none" />
							<span>{schoolToday.subtitle}</span>
						</div>
					{/if}
				</button>
			{/if}
		</div>

		<!-- Column 2 · middle: tomorrow & quote -->
		<div class="mid-col">
			<div
				class="card tomorrow-card pressable"
				role="button"
				tabindex="0"
				aria-label="Tomorrow's weather. Tap for the full report."
				onclick={() => openReport(1)}
				onkeydown={(e) => e.key === 'Enter' && openReport(1)}
			>
				<SectionTitle>Tomorrow</SectionTitle>
				{#if tomorrow}
					<Emoji code={weatherEmoji(tomorrow.code, true)} size={50} alt="" class="tomorrow-icon anim-float" />
					<div class="tomorrow-desc">{weatherLabel(tomorrow.code, true)}</div>
					<div class="tomorrow-highlow">
						H: {Math.round(tomorrow.temp_max_f)}&deg; &nbsp; L: {Math.round(tomorrow.temp_min_f)}&deg;
					</div>
				{/if}
			</div>

			<!-- tap: the QUOTE tab, big -->
			<div
				class="card quote-card pressable"
				role="button"
				tabindex="0"
				aria-label="Quote of the day. Tap to see it big."
				onclick={() => goto('/quote')}
				onkeydown={(e) => e.key === 'Enter' && goto('/quote')}
			>
				<SectionTitle>Quote of the Day</SectionTitle>
				<p class="quote-text {quoteSize}">&ldquo;{quote.text}&rdquo;</p>
				<div class="quote-author">
					<span>&mdash; {quote.author.split(',')[0]}</span>
					<Emoji code={quote.emoji} size={18} alt="" shadow="none" />
				</div>
			</div>
		</div>

		<!-- Column 3 · right: wardrobe (tap: the WARDROBE tab, with the whole week) -->
		<div
			class="card wardrobe-card pressable"
			role="button"
			tabindex="0"
			aria-label="What to wear. Tap for the outfit checklist and the rest of the week."
			onclick={() => goto('/wardrobe')}
			onkeydown={(e) => e.key === 'Enter' && goto('/wardrobe')}
		>
			<SectionTitle>{outfitIdx === 1 ? 'Wear Tomorrow' : 'What to Wear'}</SectionTitle>
			{#if outfit}
				<div class="avatars">
					{#each data.kids as kid (kid.name)}
						<div class="avatar"><KidAvatar {kid} items={outfitNames} size={avatarSize} /></div>
					{/each}
				</div>
				<div class="wardrobe-footer">
					<div class="outfit-icons" aria-label="Outfit">
						{#each outfit.items as item (item.name)}
							<Emoji code={item.emoji} size={20} alt={item.name} shadow="none" />
						{/each}
					</div>
					<span>{outfit.summary}{outfitIdx === 1 ? ' tomorrow!' : ' today!'}</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- (the full weather report panel lives in the root layout) -->
{/if}

<style>
	.load-card {
		flex: 1;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}
	.load-text {
		font-size: 18px;
		font-weight: 800;
		opacity: 0.7;
	}

	/* --- main grid: 1.15 / 0.95 / 0.9 columns, like the reference page --- */
	.today-grid {
		display: grid;
		/* minmax(0, …): long text must never widen a column */
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(0, 0.9fr);
		gap: 14px;
		height: 100%;
		min-height: 0;
	}
	.left-col {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-height: 0;
	}
	.mid-col {
		display: flex;
		flex-direction: column;
		gap: 14px;
		min-height: 0;
	}

	/* --- hero (whole card is a touch target: opens today's report) --- */
	.hero-card {
		flex: 1.1;
		justify-content: space-between;
		align-items: center;
		touch-action: none;
	}
	.hero-top {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: flex-start;
	}
	.hero-temp {
		font-size: 80px;
		font-weight: 900;
		line-height: 0.8;
		letter-spacing: -3px;
	}
	.hero-top :global(img) {
		margin-top: -5px;
		margin-right: -5px;
		flex: 0 0 auto;
	}
	.hero-desc {
		font-size: 19px;
		font-weight: 900;
		margin-top: auto;
	}
	.hero-stale {
		font-size: 13px;
		font-weight: 800;
		opacity: 0.6;
	}

	/* --- mini hourly: dark timeline strip + white boxes --- */
	.hourly-row {
		display: flex;
		justify-content: space-between;
		position: relative;
		align-items: center;
		flex: 0.7;
		min-height: 0;
	}
	.hourly-row::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 5px;
		right: 5px;
		height: 3px;
		background-color: var(--border-dark);
		z-index: 0;
		transform: translateY(-50%);
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
	}
	.hour-box {
		background-color: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 6px 0;
		width: 62px;
		z-index: 1;
		box-shadow: var(--sticker-shadow);
	}
	.hour-box span {
		font-size: 13px;
		font-weight: 800;
	}
	.hour-box span:last-child {
		font-size: 15px;
		font-weight: 900;
	}
	.hour-box {
		position: relative;
	}
	.hour-box .tomorrow-badge {
		position: absolute;
		top: -11px;
		left: 50%;
		transform: translateX(-50%);
		background: var(--tab-orange);
		border: 2px solid var(--border-dark);
		border-radius: 999px;
		padding: 0 5px;
		font-size: 10.5px;
		font-weight: 900;
		white-space: nowrap;
	}
	.hour-box :global(img) {
		margin: 3px 0;
	}

	/* --- school banner (yellow, its own border — not a white card) --- */
	.school-banner {
		background-color: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		padding: 8px 12px;
		font-weight: 800;
		font-size: 14.5px;
		display: flex;
		flex-direction: column;
		line-height: 1.35;
		flex: 0.6;
		justify-content: center;
		gap: 2px;
		box-shadow: var(--sticker-shadow);
	}
	.banner-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.banner-row span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.school-banner.kind-no-school {
		background-color: #fecaca;
	}
	.school-banner.kind-weekend,
	.school-banner.kind-summer {
		background-color: #bbf7d0;
	}
	/* the banner is a button (calendar / weather report); alert advice may wrap */
	button.school-banner {
		font-family: 'Nunito', sans-serif;
		color: inherit;
		text-align: left;
		width: 100%;
		min-width: 0;
	}
	button.school-banner .banner-row.sub {
		align-items: flex-start;
		font-size: 13px;
		line-height: 1.25;
	}
	button.school-banner .banner-row.sub span {
		white-space: normal;
	}
	.school-banner.alert-red {
		background-color: #ef4444;
		color: #ffffff;
	}
	.school-banner.alert-orange {
		background-color: #fb923c;
	}
	.school-banner.alert-yellow {
		background-color: #fde047;
	}

	/* --- tomorrow card (light-blue; whole card opens tomorrow's report) --- */
	.tomorrow-card {
		flex: 0.95;
		align-items: center;
		justify-content: center;
		background-color: var(--bg-light-blue);
		padding: 10px;
		touch-action: manipulation;
	}
	.tomorrow-card :global(.section-title) {
		margin-bottom: 4px;
	}
	.tomorrow-card :global(img) {
		margin: 0 0 4px 0;
	}
	.tomorrow-desc {
		font-size: 16px;
		font-weight: 900;
	}
	.tomorrow-highlow {
		font-size: 14px;
		font-weight: 800;
		color: #475569;
	}

	/* --- quote card --- */
	.quote-card {
		flex: 1.05;
		padding: 12px;
		justify-content: center;
	}
	.quote-text {
		font-weight: 800;
		font-style: italic;
		text-align: center;
		line-height: 1.3;
		margin-top: 2px;
		color: #334155;
		padding: 0 2px;
	}
	.quote-text.q-lg {
		font-size: 15px;
	}
	.quote-text.q-md {
		font-size: 13.5px;
	}
	.quote-text.q-sm {
		font-size: 12.5px;
		line-height: 1.25;
	}
	.quote-author {
		font-size: 13.5px;
		font-weight: 900;
		text-align: right;
		margin-top: 6px;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
	}

	/* --- wardrobe card (light-blue, big avatars, blue footer strip) --- */
	.wardrobe-card {
		align-items: center;
		background-color: var(--bg-light-blue);
		padding: 12px 12px 0 12px;
		overflow: hidden;
	}
	.avatars {
		margin: auto 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* the buddy SVGs have side padding, so they can tuck together */
	.avatar + .avatar {
		margin-left: -30px;
	}
	.wardrobe-footer {
		background: #dbeafe;
		border-top: 3px solid var(--border-dark);
		width: calc(100% + 24px);
		margin-left: -12px;
		margin-right: -12px;
		padding: 8px 12px 10px;
		text-align: center;
		font-size: 15px;
		font-weight: 900;
		line-height: 1.3;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}
	.outfit-icons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px;
	}
</style>
