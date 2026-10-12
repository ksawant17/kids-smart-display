<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { weather } from '#lib/weather';
	import { now, todayKey } from '#lib/clock';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { outfitForDay, outfitDayIndex } from '#lib/utils/wardrobe';

	let { data } = $props();

	const wx = $derived($weather.data);
	// today until school is out, then tomorrow
	const dayIdx = $derived(outfitDayIndex($now, data.school.endHour));
	const day = $derived(wx?.days[dayIdx]);
	const outfit = $derived(day ? outfitForDay(day, data.wardrobe) : null);

	/* ---- per-kid checklist, remembered for the day (survives tab switches) ---- */
	let kidIdx = $state(0);
	const kid = $derived(data.kids[Math.min(kidIdx, data.kids.length - 1)]);
	const storeKey = $derived(`wardrobe:${$todayKey}:${dayIdx}:${kid.name}`);

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
		<SectionTitle>{dayIdx === 1 ? "Tomorrow's Weather" : "Today's Weather"}</SectionTitle>
		{#if wx && day}
			{@const code = dayIdx === 0 ? wx.current.weather_code : day.code}
			{@const isDay = dayIdx === 0 ? wx.current.is_day === 1 : true}
			<div class="wx-icon">
				<Emoji code={weatherEmoji(code, isDay)} size={92} alt="" class="anim-pop" />
			</div>
			<div class="wx-temp">{Math.round(dayIdx === 0 ? wx.current.temp_f : day.temp_max_f)}°</div>
			<div class="wx-label">{weatherLabel(code, isDay)}</div>
			{#if day.school}
				<div class="wx-school">
					School hours feel like {Math.round(day.school.feels_min_f)}–{Math.round(day.school.feels_max_f)}°
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

	<!-- Right: outfit checklist -->
	<div class="card checklist-card">
		<SectionTitle variant="white">{allDone ? 'All Dressed — Great Job!' : 'Your Outfit Checklist'}</SectionTitle>

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
						<Emoji code={k.avatar} size={30} alt="" shadow="none" />
						<span>{k.name}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#if outfit}
			<div class="items">
				{#each outfit.items as item (item.name)}
					<button
						class="clothes-item pressable"
						class:done={checked[item.name]}
						onclick={() => toggle(item.name)}
						aria-pressed={!!checked[item.name]}
					>
						<Emoji code={item.emoji} size={34} alt="" />
						<span class="item-name">{item.name}</span>
						<span class="tick">
							{#if checked[item.name]}<Emoji code="2705" size={24} alt="checked" shadow="none" />{/if}
						</span>
					</button>
				{/each}
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
		grid-template-columns: 1fr 1.7fr;
		gap: 14px;
		height: 100%;
		min-height: 0;
	}

	.weather-card {
		align-items: center;
		justify-content: center;
		background-color: var(--bg-light-blue);
		text-align: center;
	}
	.wx-icon :global(img) {
		animation: float 3s ease-in-out infinite;
	}
	.wx-temp {
		font-size: 58px;
		font-weight: 900;
		line-height: 1;
		margin: 6px 0;
	}
	.wx-label {
		font-size: 20px;
		font-weight: 900;
	}
	.wx-school {
		margin-top: 8px;
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

	.kid-picker {
		display: flex;
		gap: 10px;
		margin-bottom: 8px;
	}
	.kid-chip {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 44px;
		font: 900 18px 'Nunito', sans-serif;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		color: #64748b;
	}
	.kid-chip.on {
		background: var(--tab-purple);
		color: var(--text-dark);
	}

	.items {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-auto-rows: minmax(0, 56px);
		align-content: center;
		gap: 8px 10px;
	}
	.clothes-item {
		display: flex;
		align-items: center;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		padding: 4px 10px;
		font: 900 17px 'Nunito', sans-serif;
		gap: 8px;
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
		text-align: left;
		min-width: 0;
	}
	.clothes-item.done {
		background: #dcfce7;
	}
	.clothes-item.done .item-name {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.item-name {
		flex: 1;
		min-width: 0;
		line-height: 1.1;
	}
	.tick {
		flex: 0 0 24px;
		display: flex;
	}
	.cheer {
		position: absolute;
		right: 14px;
		top: 6px;
	}
	.loading {
		margin: auto;
		font-size: 18px;
		font-weight: 800;
		opacity: 0.6;
	}
</style>
