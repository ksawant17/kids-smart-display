<script lang="ts">
	/**
	 * TODAY: three big answers, one column each.
	 *   Weather · School · What to Wear
	 * The top strip is the quote of the day, or a red weather alert, or a note
	 * from a grown-up (admin tab), or (from 6 PM) a "Getting ready for
	 * tomorrow" ribbon. With the AI helper on, the day's briefing takes turns
	 * with the quote / ribbon (tap it to read it all). In the evening ALL three
	 * columns switch to tomorrow together, so nothing on screen is mixed.
	 * Every column is one big button.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Emoji from '#lib/components/Emoji.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { openReport } from '#lib/report';
	import { weather } from '#lib/weather';
	import { now, todayKey } from '#lib/clock';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { outfitForDay } from '#lib/utils/wardrobe';
	import {
		STATUS_EMOJI,
		keyOf,
		parseKey,
		relativeDay,
		todayStatus,
		tomorrowStatus,
		upNext
	} from '#lib/utils/schoolCalendar';
	import { clockTime, hourLabel, pickDaily } from '#lib/utils/time';
	import { alertAdvice, alertLevel, skyStory } from '#lib/utils/forecastStory';
	import { moonPhase } from '#lib/utils/moon';
	import { messagesOn } from '#lib/utils/messages';
	import { messages } from '#lib/messages';
	import ReadAloud from '#lib/components/ReadAloud.svelte';
	import { briefing } from '#lib/briefing';
	import quotes from '#lib/data/quotes.json';

	let { data } = $props();

	onMount(() => {
		// kiosk debugging aid: /?wx opens the full weather report, /?wx&d=1 selects tomorrow
		const sp = new URL(location.href).searchParams;
		if (sp.has('wx')) openReport(Number(sp.get('d')) || 0);
	});

	const wx = $derived($weather.data);

	// ---- which day the screen is about: today, or tomorrow from 6 PM ----
	const evening = $derived($now.getHours() >= data.wardrobe.switchToTomorrowHour);
	const tomorrowKey = $derived.by(() => {
		const d = parseKey($todayKey);
		d.setDate(d.getDate() + 1);
		return keyOf(d);
	});
	const dayIdx = $derived(evening && (wx?.days.length ?? 0) > 1 ? 1 : 0);
	const dayKey = $derived(dayIdx === 1 ? tomorrowKey : $todayKey);
	const day = $derived(wx?.days[dayIdx]);
	const dayName = $derived(parseKey(dayKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));

	// ---- top strip: alert > grown-up note > evening ribbon > quote ----
	const alerts = $derived(wx?.alerts ?? []);
	// several alerts (or notes) take turns on the clock tick
	const turn = $derived(Math.floor($now.getTime() / 15000));
	const alert = $derived(alerts.length ? alerts[turn % alerts.length] : null);
	const notes = $derived(messagesOn($messages, dayKey));
	const note = $derived(notes.length ? notes[turn % notes.length] : null);
	// built-in quotes + the ones a grown-up kept (Grown-ups tab -> New Content)
	const quote = $derived(pickDaily([...quotes, ...data.content.quotes], $now));

	// ---- weather column ----
	// today: now + the coming hours; evening: tomorrow + tomorrow morning
	const hours = $derived(
		!wx || !day ? [] : dayIdx === 1 && day.hours.length ? day.hours.slice(0, 4) : wx.hourly.slice(0, 4)
	);
	const story = $derived(day && wx ? skyStory(day, dayIdx === 1 ? day.hours : wx.hourly.slice(0, 9)) : '');
	const tonight = $derived(moonPhase($now));

	// ---- school column ----
	const school = $derived(
		dayIdx === 1 ? tomorrowStatus(data.schoolEvents, dayKey) : todayStatus(data.schoolEvents, dayKey)
	);
	const nextUp = $derived.by(() => {
		const after = parseKey(dayKey);
		after.setDate(after.getDate() + 1);
		return upNext(data.schoolEvents, keyOf(after), 1)[0] ?? null;
	});

	// ---- wear column ----
	const outfit = $derived(day ? outfitForDay(day, data.wardrobe) : null);
	const outfitNames = $derived(outfit ? outfit.items.map((i) => i.name) : []);
	const avatarSize = $derived(data.kids.length > 2 ? 84 : data.kids.length === 2 ? 118 : 140);
	// each kid's ticks from the WARDROBE checklist (same storage key, per date)
	const progress = $derived.by(() => {
		void $now; // re-read on the clock tick, so ticks made on WARDROBE show up
		return data.kids.map((kid) => {
			let checked: Record<string, boolean> = {};
			try {
				checked = JSON.parse(localStorage.getItem(`wardrobe:${dayKey}:${kid.name}`) ?? '{}');
			} catch {
				/* no storage: show 0 */
			}
			const done = outfitNames.filter((n) => checked[n]).length;
			return { name: kid.name, done, total: outfitNames.length };
		});
	});

	// ---- the AI briefing (the layout fetches it: the idle screen reads it out too) ----
	let briefingOpen = $state(false);
	const briefingText = $derived(data.ai.briefing ? ($briefing?.text ?? null) : null);
	// takes turns with the quote / evening ribbon
	const showBriefing = $derived(!!briefingText && turn % 2 === 0);

	// swipe down on the weather column opens the full report (a tap does too)
	let startY: number | null = null;
	function wxUp(e: PointerEvent) {
		if (startY !== null && e.clientY - startY > 40) openReport(dayIdx);
		startY = null;
	}
</script>

{#if !wx || !day}
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
	<div class="today">
		<!-- top strip -->
		{#if alert}
			{@const tip = alertAdvice(alert.event)}
			<button class="strip alert-{alertLevel(alert.severity)} pressable" onclick={() => openReport(0)}>
				<Emoji code="26a0" size={22} alt="" shadow="none" />
				<b>{alert.event}</b>
				<span class="strip-text">{tip.advice}</span>
				<Emoji code={tip.emoji} size={22} alt="" shadow="none" />
			</button>
		{:else if note}
			<div class="strip note">
				<Emoji code={note.emoji} size={24} alt="" shadow="none" />
				{#if dayIdx === 1}<b>Tomorrow:</b>{/if}
				<span class="strip-text">{note.text}</span>
			</div>
		{:else if showBriefing}
			<button class="strip briefing pressable" onclick={() => (briefingOpen = true)}>
				<Emoji code="2728" size={22} alt="" shadow="none" />
				{#if dayIdx === 1}<b>Tomorrow:</b>{/if}
				<span class="strip-text">{briefingText}</span>
			</button>
		{:else if dayIdx === 1}
			<div class="strip ribbon">
				<Emoji code="1f319" size={22} alt="" shadow="none" />
				<b>Getting ready for tomorrow</b>
				<span class="strip-text">· {dayName}</span>
			</div>
		{:else}
			<button class="strip quote pressable" onclick={() => goto('/quote')}>
				<Emoji code={quote.emoji} size={22} alt="" shadow="none" />
				<span class="strip-text"><i>“{quote.text}”</i></span>
				<b class="who">– {quote.author.split(',')[0]}</b>
			</button>
		{/if}

		<div class="answers">
			<!-- 1 · WEATHER -->
			<div
				class="card col weather-col pressable"
				role="button"
				tabindex="0"
				aria-label="Weather. Tap for the full report."
				onclick={() => openReport(dayIdx)}
				onkeydown={(e) => e.key === 'Enter' && openReport(dayIdx)}
				onpointerdown={(e) => (startY = e.clientY)}
				onpointerup={wxUp}
			>
				<SectionTitle>{dayIdx === 1 ? "Tomorrow's Weather" : 'Weather'}</SectionTitle>
				<div class="wx-main">
					{#if dayIdx === 1}
						<WeatherIcon code={weatherEmoji(day.code, true)} size={54} class="anim-pop" />
						<div class="wx-temp">{Math.round(day.temp_max_f)}°</div>
					{:else}
						<WeatherIcon code={weatherEmoji(wx.current.weather_code, wx.current.is_day === 1)} size={54} class="anim-pop" />
						<div class="wx-temp">{Math.round(wx.current.temp_f)}°</div>
					{/if}
				</div>
				<div class="wx-label">
					{#if dayIdx === 1}
						{weatherLabel(day.code, true)} · low {Math.round(day.temp_min_f)}°
					{:else}
						{weatherLabel(wx.current.weather_code, wx.current.is_day === 1)} · feels {Math.round(wx.current.feels_f)}°
					{/if}
				</div>
				<div class="story">{story}</div>
				<div class="mini-hours">
					{#each hours as h, i (h.time)}
						<div class="mini-hour">
							<span class="mh-time">{dayIdx === 0 && i === 0 ? 'Now' : hourLabel(h.time)}</span>
							<Emoji code={weatherEmoji(h.weather_code, h.is_day === 1)} size={22} alt="" />
							<span class="mh-temp">{Math.round(h.temp_f)}°</span>
						</div>
					{/each}
				</div>
				<div class="wx-foot">
					{#if dayIdx === 1}
						<Emoji code={tonight.emoji} size={18} alt="" shadow="none" /> Tonight: {tonight.name}
					{:else if wx.days[1]}
						Tomorrow <Emoji code={weatherEmoji(wx.days[1].code, true)} size={18} alt="" shadow="none" />
						{Math.round(wx.days[1].temp_max_f)}° / {Math.round(wx.days[1].temp_min_f)}°
					{/if}
					{#if wx.stale || $weather.error}<span class="stale">· updated {clockTime(new Date(wx.fetched_at))}</span>{/if}
				</div>
			</div>

			<!-- 2 · SCHOOL -->
			<button
				class="card col school-col kind-{school.kind} pressable"
				aria-label="{school.title}. Tap for the school calendar."
				onclick={() => goto(`/calendar?day=${dayKey}`)}
			>
				<SectionTitle>School</SectionTitle>
				<Emoji code={STATUS_EMOJI[school.kind]} size={52} alt="" class="anim-pop" />
				<div class="school-title">{school.title}</div>
				{#if school.subtitle}<div class="school-sub">{school.subtitle}</div>{/if}
				{#if nextUp}
					<div class="next-up">
						<div class="next-label">Up next</div>
						<div class="next-what">{nextUp.title === 'No School' ? `No School · ${nextUp.subtitle}` : nextUp.title}</div>
						<div class="next-when">
							{parseKey(nextUp.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
							<span class="sleeps">{nextUp.ongoing ? 'Now' : relativeDay($todayKey, nextUp.date)}</span>
						</div>
					</div>
				{/if}
			</button>

			<!-- 3 · WEAR -->
			<button class="card col wear-col pressable" aria-label="What to wear. Tap for the outfit checklist." onclick={() => goto('/wardrobe')}>
				<SectionTitle>{dayIdx === 1 ? 'Wear Tomorrow' : 'What to Wear'}</SectionTitle>
				<div class="avatars">
					{#each data.kids as kid (kid.name)}
						<div class="avatar"><KidAvatar {kid} items={outfitNames} size={avatarSize} /></div>
					{/each}
				</div>
				{#if outfit}
					<div class="outfit-icons" aria-label="Outfit">
						{#each outfit.items as item (item.name)}
							<Emoji code={item.emoji} size={22} alt={item.name} shadow="none" />
						{/each}
					</div>
					<div class="outfit-text">{outfit.summary}</div>
					<div class="progress">
						{#each progress as p (p.name)}
							<span class="kid-progress" class:done={p.total > 0 && p.done === p.total}>
								{p.name}
								{#if p.total > 0 && p.done === p.total}✓{:else}{p.done}/{p.total}{/if}
							</span>
						{/each}
					</div>
				{/if}
			</button>
		</div>
	</div>
	{#if briefingOpen && briefingText}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="briefing-full" onclick={() => (briefingOpen = false)} role="button" tabindex="-1" aria-label="Close">
			<div class="bubble anim-pop">
				<Emoji code="2728" size={44} alt="" />
				<div class="bubble-label">{dayIdx === 1 ? 'Getting ready for tomorrow' : 'Today'}</div>
				<p>{briefingText}</p>
				{#if data.voice.installed && data.voice.enabled}<ReadAloud text={briefingText} />{/if}
			</div>
		</div>
	{/if}
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

	.today {
		height: 100%;
		min-height: 0;
		min-width: 0; /* a long quote must never widen the page */
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* --- top strip: quote / evening ribbon / alert --- */
	.strip {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 38px;
		padding: 0 14px;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		font: 800 15px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		text-align: left;
		width: 100%;
		min-width: 0;
		overflow: hidden;
	}
	.strip b {
		font-weight: 900;
		white-space: nowrap;
	}
	.strip-text {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.strip.quote {
		background: #fde68a;
	}
	.strip.quote .who {
		color: #334155;
	}
	.strip.ribbon {
		background: #c7d2fe;
	}
	.strip.briefing {
		background: #e9d5ff;
	}
	.briefing-full {
		position: fixed;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.45);
		border: none;
		cursor: pointer;
	}
	.bubble {
		max-width: 620px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 18px 28px 22px;
		background: #faf5ff;
		border: 3px solid var(--border-dark);
		border-radius: 22px;
		box-shadow: var(--sticker-shadow);
		font-family: 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
	}
	.bubble-label {
		font-size: 15px;
		font-weight: 900;
		color: #7c3aed;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.bubble p {
		font-size: 26px;
		font-weight: 900;
		line-height: 1.35;
		text-align: center;
	}
	.strip.note {
		background: #dcfce7;
		font-size: 17px;
		font-weight: 900;
	}
	.strip.alert-red {
		background: #ef4444;
		color: #ffffff;
	}
	.strip.alert-orange {
		background: #fb923c;
	}
	.strip.alert-yellow {
		background: #fde047;
	}

	/* --- three answers --- */
	.answers {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}
	.col {
		align-items: center;
		text-align: center;
		gap: 4px;
		padding: 10px 10px 8px;
		overflow: hidden;
		font-family: 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
	}
	.col :global(.section-title) {
		margin-bottom: 2px;
	}
	/* nothing in a column gets squashed; spare room collects at the margin-top:auto rows */
	.col > :global(*) {
		flex-shrink: 0;
	}

	/* weather */
	.weather-col {
		background: var(--bg-light-blue);
		touch-action: none;
	}
	.wx-main {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.wx-temp {
		font-size: 52px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: -2px;
	}
	.wx-label {
		font-size: 15px;
		font-weight: 900;
	}
	.story {
		font-size: 13px;
		font-weight: 800;
		font-style: italic;
		color: #334155;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.mini-hours {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
		margin-top: auto;
	}
	.mini-hour {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 10px;
		padding: 2px 0;
	}
	.mh-time {
		font-size: 12px;
		font-weight: 900;
	}
	.mh-temp {
		font-size: 14px;
		font-weight: 900;
	}
	.wx-foot {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font-size: 13px;
		font-weight: 900;
		color: #334155;
		white-space: nowrap;
	}
	.stale {
		font-weight: 800;
		opacity: 0.6;
	}

	/* school */
	.school-col {
		background: var(--yellow-banner);
		justify-content: flex-start;
	}
	.school-col.kind-no-school {
		background: #fecaca;
	}
	.school-col.kind-weekend,
	.school-col.kind-summer {
		background: #bbf7d0;
	}
	.school-col.kind-regular {
		background: #fef08a;
	}
	.school-title {
		font-size: 22px;
		font-weight: 900;
		line-height: 1.1;
	}
	.school-sub {
		font-size: 14px;
		font-weight: 800;
		color: #334155;
	}
	.next-up {
		margin-top: auto;
		width: 100%;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 4px 8px 6px;
	}
	.next-label {
		font-size: 12px;
		font-weight: 900;
		color: #ef4444;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.next-what {
		font-size: 14px;
		font-weight: 900;
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.next-when {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 800;
		color: #334155;
		margin-top: 2px;
	}
	.sleeps {
		background: var(--tab-orange);
		color: #ffffff;
		border: 2px solid var(--border-dark);
		border-radius: 999px;
		padding: 0 7px;
		font-size: 12px;
		font-weight: 900;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.35);
	}

	/* wear */
	.wear-col {
		background: #e9d5ff;
	}
	.avatars {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: auto 0 0;
	}
	/* the buddy SVGs have side padding, so they can tuck together */
	.avatar + .avatar {
		margin-left: -26px;
	}
	.outfit-icons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 3px;
	}
	.outfit-text {
		font-size: 14px;
		font-weight: 900;
		line-height: 1.15;
	}
	.progress {
		display: flex;
		gap: 6px;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: auto;
	}
	.kid-progress {
		background: var(--card-white);
		border: 2px solid var(--border-dark);
		border-radius: 999px;
		padding: 0 8px;
		font-size: 12.5px;
		font-weight: 900;
	}
	.kid-progress.done {
		background: var(--tab-green);
		color: #ffffff;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.35);
	}
</style>
