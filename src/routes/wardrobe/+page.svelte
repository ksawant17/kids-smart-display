<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { weather } from '#lib/weather';
	import { now, todayKey } from '#lib/clock';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { dayName, outfitForDay, outfitDayIndex } from '#lib/utils/wardrobe';
	import { isWeekend, parseKey } from '#lib/utils/schoolCalendar';

	let { data } = $props();

	const wx = $derived($weather.data);
	const dayCount = $derived(wx?.days.length ?? 1);

	// Starts on today (tomorrow after 6 PM, like the TODAY tab); the arrows
	// step through the rest of the week's forecast.
	let picked = $state<number | null>(null);
	const dayIdx = $derived(
		Math.min(picked ?? outfitDayIndex($now, data.wardrobe.switchToTomorrowHour), dayCount - 1)
	);
	const day = $derived(wx?.days[dayIdx]);
	const outfit = $derived(day ? outfitForDay(day, data.wardrobe) : null);
	const name = $derived(day ? dayName(day.date, dayIdx) : 'Today');
	const shortDate = $derived(
		day ? parseKey(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
	);
	const step = (delta: number) => (picked = Math.max(0, Math.min(dayCount - 1, dayIdx + delta)));

	/* ---- per-kid checklist for that date (survives tab switches, and ticks made
	        the evening before still count in the morning) ---- */
	let kidIdx = $state(0);
	const kid = $derived(data.kids[Math.min(kidIdx, data.kids.length - 1)]);
	const storeKey = $derived(`wardrobe:${day?.date ?? $todayKey}:${kid.name}`);

	let checked = $state<Record<string, boolean>>({});
	$effect(() => {
		checked = readChecks(storeKey);
	});

	function readChecks(key: string): Record<string, boolean> {
		try {
			return JSON.parse(localStorage.getItem(key) ?? '{}');
		} catch {
			return {};
		}
	}
	function toggle(name: string) {
		checked = { ...checked, [name]: !checked[name] };
		try {
			localStorage.setItem(storeKey, JSON.stringify(checked));
		} catch {
			/* storage unavailable: still works for this visit */
		}
	}
	const allDone = $derived(!!outfit && outfit.items.every((i) => checked[i.name]));
</script>

<div class="wardrobe-grid">
	<!-- Left: the weather the outfit is for -->
	<div class="card weather-card">
		<div class="day-nav">
			<button class="day-arrow pressable" onclick={() => step(-1)} disabled={dayIdx === 0} aria-label="Previous day">&lt;</button>
			<div class="day-title">
				<SectionTitle>{name}</SectionTitle>
				<div class="day-date">{shortDate}</div>
			</div>
			<button class="day-arrow pressable" onclick={() => step(1)} disabled={dayIdx >= dayCount - 1} aria-label="Next day">&gt;</button>
		</div>
		{#if wx && day}
			{@const code = dayIdx === 0 ? wx.current.weather_code : day.code}
			{@const isDay = dayIdx === 0 ? wx.current.is_day === 1 : true}
			<div class="wx-icon">
				{#key day.date}
					<Emoji code={weatherEmoji(code, isDay)} size={84} alt="" class="anim-pop" />
				{/key}
			</div>
			<div class="wx-temp">{Math.round(dayIdx === 0 ? wx.current.temp_f : day.temp_max_f)}°</div>
			<div class="wx-label">{weatherLabel(code, isDay)}</div>
			<div class="wx-highlow">H: {Math.round(day.temp_max_f)}° &nbsp; L: {Math.round(day.temp_min_f)}°</div>
			{#if day.school}
				<div class="wx-school">
					{isWeekend(day.date) ? 'Daytime' : 'School hours'} feel like {Math.round(day.school.feels_min_f)}–{Math.round(day.school.feels_max_f)}°
					{#if day.school.pop_max > 0}· <Emoji code="1f4a7" size={14} alt="" shadow="none" /> {day.school.pop_max}%{/if}
				</div>
			{/if}
		{:else if $weather.error}
			<Emoji code="26c5" size={80} alt="" />
			<div class="wx-label">Can't reach the weather. Trying again soon…</div>
		{:else}
			<Emoji code="2601" size={80} alt="" class="anim-float" />
			<div class="wx-label">Loading…</div>
		{/if}
	</div>

	<!-- Right: outfit checklist (sample-pages: big kid on the left, items on the right) -->
	<div class="card checklist-card">
		<SectionTitle variant="white">
			{allDone ? 'All Dressed — Great Job!' : dayIdx === 0 ? 'Your Outfit Checklist' : `${name}'s Outfit`}
		</SectionTitle>

		{#if outfit}
			<div class="checklist-body">
				<div class="kid-col">
					<!-- the buddy gets dressed as items are ticked off -->
					{#key kid.name}
						<div class="anim-pop">
							<KidAvatar
								{kid}
								items={outfit.items.filter((i) => checked[i.name]).map((i) => i.name)}
								size={data.kids.length > 1 ? 160 : 190}
							/>
						</div>
					{/key}
					{#if data.kids.length > 1}
						<div class="kid-picker" role="tablist" aria-label="Whose checklist">
							{#each data.kids as k, i (k.name)}
								<button
									class="kid-chip pressable"
									class:on={i === kidIdx}
									role="tab"
									aria-selected={i === kidIdx}
									onclick={() => (kidIdx = i)}
								>
									{k.name}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<div class="items" class:many={outfit.items.length > 3}>
					{#each outfit.items as item (item.name)}
						<button
							class="clothes-item pressable"
							class:done={checked[item.name]}
							onclick={() => toggle(item.name)}
							aria-pressed={!!checked[item.name]}
						>
							<Emoji code={item.emoji} size={outfit.items.length > 3 ? 26 : 36} alt="" />
							<span class="item-name">{item.name}</span>
							<span class="tick">
								{#if checked[item.name]}<Emoji code="2705" size={22} alt="checked" shadow="none" />{/if}
							</span>
						</button>
					{/each}
				</div>
			</div>
			{#if allDone}
				<div class="cheer"><Emoji code="1f389" size={30} alt="" class="anim-pop" /></div>
			{/if}
		{:else}
			<div class="loading">Checking what to wear…</div>
		{/if}
	</div>
</div>

<style>
	.wardrobe-grid {
		display: grid;
		grid-template-columns: 1fr 1.5fr;
		gap: 14px;
		height: 100%;
		min-height: 0;
	}

	.weather-card {
		align-items: center;
		justify-content: space-between;
		background-color: var(--bg-light-blue);
		text-align: center;
	}
	.day-nav {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}
	.day-title {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
	}
	.day-title :global(.section-title) {
		margin-bottom: 0;
	}
	.day-date {
		font-size: 12px;
		font-weight: 800;
		color: #475569;
		margin-top: 2px;
	}
	/* fat-finger day arrows (sample-pages arrow-box style) */
	.day-arrow {
		width: 44px;
		height: 40px;
		flex: 0 0 auto;
		background: var(--yellow-banner);
		border: 2.5px solid var(--border-dark);
		border-radius: 10px;
		font: 900 20px 'Nunito', sans-serif;
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
	}
	.day-arrow:disabled {
		background: var(--card-white);
		opacity: 0.35;
	}
	.wx-highlow {
		font-size: 14px;
		font-weight: 800;
		color: #475569;
		margin-top: 2px;
	}
	.wx-icon :global(img) {
		animation: float 3s ease-in-out infinite;
	}
	.wx-temp {
		font-size: 56px;
		font-weight: 900;
		line-height: 1;
		margin: 4px 0;
	}
	.wx-label {
		font-size: 20px;
		font-weight: 900;
	}
	.wx-school {
		margin-top: 4px;
		font-size: 13px;
		font-weight: 800;
		color: #475569;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 3px;
	}

	.checklist-card {
		background-color: #f3e8ff;
		position: relative;
	}

	.checklist-body {
		display: flex;
		gap: 20px;
		align-items: center;
		justify-content: center;
		flex: 1;
		min-height: 0;
	}
	.kid-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.kid-picker {
		display: flex;
		gap: 6px;
	}
	.kid-chip {
		height: 36px;
		padding: 0 12px;
		font: 900 15px 'Nunito', sans-serif;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		color: #64748b;
	}
	.kid-chip.on {
		background: var(--tab-purple);
		color: var(--text-dark);
	}

	.items {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 240px;
	}
	.items.many {
		gap: 6px;
	}
	.clothes-item {
		display: flex;
		align-items: center;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		padding: 8px 16px;
		font: 900 19px 'Nunito', sans-serif;
		gap: 12px;
		white-space: nowrap;
		box-shadow: var(--sticker-shadow-sm);
		text-align: left;
	}
	.items.many .clothes-item {
		padding: 3px 12px;
		font-size: 17px;
		gap: 10px;
	}
	.clothes-item.done {
		opacity: 0.5;
	}
	.clothes-item.done .item-name {
		text-decoration: line-through;
	}
	.item-name {
		flex: 1;
		min-width: 0;
		line-height: 1.1;
	}
	.tick {
		flex: 0 0 22px;
		display: flex;
	}
	.cheer {
		position: absolute;
		right: 14px;
		top: 8px;
	}
	.loading {
		margin: auto;
		font-size: 18px;
		font-weight: 800;
		opacity: 0.6;
	}
</style>
