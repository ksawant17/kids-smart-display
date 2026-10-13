<script lang="ts">
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import WeatherIcon from '#lib/components/WeatherIcon.svelte';
	import {
		STATUS_EMOJI,
		dateKey,
		dayStatus,
		eventsOn,
		formatRange,
		monthMarks,
		nextBreak,
		parseKey,
		relativeDay,
		sleepsLabel,
		sleepsUntil,
		upNext
	} from '#lib/utils/schoolCalendar';
	import { monthTitle } from '#lib/utils/time';
	import { todayKey } from '#lib/clock';
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import { weather } from '#lib/weather';
	import { weatherEmoji, weatherLabel } from '#lib/utils/weatherCodes';
	import { outfitForDay } from '#lib/utils/wardrobe';

	let { data } = $props();

	const events = $derived(data.schoolEvents);
	const todayDate = $derived(parseKey($todayKey));

	// Month on display; snaps back to the current month when the day rolls over.
	let viewYear = $state(new Date().getFullYear());
	let viewMonth = $state(new Date().getMonth()); // 0-based
	let shownFor = '';
	$effect(() => {
		if ($todayKey !== shownFor) {
			shownFor = $todayKey;
			goToday();
		}
	});

	function goToday() {
		viewYear = todayDate.getFullYear();
		viewMonth = todayDate.getMonth();
	}

	function shift(delta: number) {
		const d = new Date(viewYear, viewMonth + delta, 1);
		viewYear = d.getFullYear();
		viewMonth = d.getMonth();
	}

	const isCurrentMonth = $derived(viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth());
	const marks = $derived(monthMarks(events, viewYear, viewMonth));
	const firstDay = $derived(new Date(viewYear, viewMonth, 1).getDay()); // 0=Sun
	const daysInMonth = $derived(new Date(viewYear, viewMonth + 1, 0).getDate());

	// next big break, unless it's already one of the rows shown
	const brk = $derived(nextBreak(events, $todayKey));
	const agendaAll = $derived(upNext(events, $todayKey, 4));
	const showBreak = $derived(!!brk && !agendaAll.some((a) => a.date === brk.date));
	const agenda = $derived(showBreak ? agendaAll.slice(0, 3) : agendaAll);

	const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	// Swipe left/right on the month grid to change months.
	let startX: number | null = null;
	let swiped = false; // a swipe must not also open a day
	function gridDown(e: PointerEvent) {
		startX = e.clientX;
		swiped = false;
	}
	function gridUp(e: PointerEvent) {
		if (startX === null) return;
		const dx = e.clientX - startX;
		startX = null;
		if (Math.abs(dx) > 50) {
			swiped = true;
			shift(dx < 0 ? 1 : -1);
		}
	}

	/* ------------- day popup: what's on that day + weather + outfit ------------- */
	let openKey = $state<string | null>(null);
	// /calendar?day=YYYY-MM-DD (from the TODAY school banner): show that month
	// with the day's details open, then tidy the URL so a reload doesn't reopen it
	$effect(() => {
		const day = page.url.searchParams.get('day');
		if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
			const d = parseKey(day);
			viewYear = d.getFullYear();
			viewMonth = d.getMonth();
			openKey = day;
			replaceState('/calendar', {});
		}
	});

	function openDay(key: string) {
		if (!swiped) openKey = key;
	}
	const popup = $derived.by(() => {
		if (!openKey) return null;
		const date = parseKey(openKey);
		const status = dayStatus(events, openKey);
		const list = eventsOn(events, openKey);
		const wx = $weather.data?.days.find((d) => d.date === openKey) ?? null;
		const outfit = wx ? outfitForDay(wx, data.wardrobe) : null;
		const ahead = sleepsUntil($todayKey, openKey);
		return { key: openKey, date, status, list, wx, outfit, ahead };
	});
	function onScrimDown(e: PointerEvent) {
		if (e.target === e.currentTarget) openKey = null;
	}
</script>

<div class="cal-grid">
	<!-- Left: month grid -->
	<div class="card month-card" onpointerdown={gridDown} onpointerup={gridUp} role="group" aria-label="Month calendar">
		<div class="month-header">
			<button class="nav-arrow pressable" onclick={() => shift(-1)} aria-label="Previous month">&lt;</button>
			<div class="month-title">{monthTitle(viewYear, viewMonth)}</div>
			{#if !isCurrentMonth}
				<button class="today-btn pressable" onclick={goToday}>Today</button>
			{/if}
			<button class="nav-arrow pressable" onclick={() => shift(1)} aria-label="Next month">&gt;</button>
		</div>

		<div class="calendar-grid">
			{#each dayNames as dn, i (i)}
				<div class="day-name">{dn}</div>
			{/each}

			{#each Array(firstDay) as _, i (i)}
				<div class="day-cell empty"></div>
			{/each}

			{#each Array(daysInMonth) as _, i (i)}
				{@const d = i + 1}
				{@const key = dateKey(viewYear, viewMonth, d)}
				{@const mark = marks.get(key)}
				<button
					class="day-cell"
					class:today={key === $todayKey}
					class:holiday={mark === 'holiday'}
					class:early={mark === 'early'}
					class:milestone={mark === 'milestone'}
					onclick={() => openDay(key)}
					aria-label={parseKey(key).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
				>
					{d}
				</button>
			{/each}
		</div>

		<div class="legend">
			<span><span class="dot red"></span> No School</span>
			<span><span class="dot yellow"></span> Early Release</span>
			<span><span class="dot green"></span> First / Last Day</span>
		</div>
	</div>

	<!-- Right: up next -->
	<div class="card">
		<SectionTitle>Up Next at School</SectionTitle>
		<div class="agenda-list">
			{#each agenda as item (item.date + item.title)}
				{@const when = parseKey(item.date)}
				{@const n = sleepsUntil($todayKey, item.date)}
				<button class="agenda-item kind-{item.kind}" onclick={() => (openKey = item.date)}>
					<div class="agenda-date">
						<span class="month">{when.toLocaleDateString('en-US', { month: 'short' })}</span>
						<span class="day">{when.getDate()}</span>
					</div>
					<div class="agenda-details">
						<span class="agenda-title">{item.title}</span>
						<span class="agenda-sub">{item.subtitle}</span>
					</div>
					<span class="sleeps" class:soon={item.ongoing || n <= 1}>{item.ongoing ? 'Now' : sleepsLabel(n)}</span>
				</button>
			{:else}
				<div class="agenda-empty">All done — nothing coming up!</div>
			{/each}
		</div>
		{#if showBreak && brk}
			<div class="break-countdown">
				<span>Next break: <b>{brk.title}</b></span>
				<span class="sleeps soon">{sleepsLabel(sleepsUntil($todayKey, brk.date))}</span>
			</div>
		{/if}
	</div>
</div>

{#if popup}
	<!-- svelte-ignore a11y_no_static_element_interactions (scrim tap = close; ✕ button is the accessible path) -->
	<div class="overlay" onpointerdown={onScrimDown}>
		<div class="card day-pop kind-{popup.status.kind}" role="dialog" aria-modal="true" aria-label="Day details" tabindex="-1">
			<button class="close-btn pressable" onclick={() => (openKey = null)} aria-label="Close">
				<Emoji code="274c" size={18} alt="Close" shadow="none" />
			</button>

			<div class="pop-body">
				<!-- left: the date -->
				<div class="pop-date">
					<div class="big-date">
						<span class="month">{popup.date.toLocaleDateString('en-US', { month: 'short' })}</span>
						<span class="day">{popup.date.getDate()}</span>
					</div>
					<div class="weekday">{popup.date.toLocaleDateString('en-US', { weekday: 'long' })}</div>
					<span class="sleeps" class:soon={popup.ahead >= 0 && popup.ahead <= 1}>{relativeDay($todayKey, popup.key)}</span>
				</div>

				<!-- right: school, events, weather -->
				<div class="pop-info">
					<div class="status kind-{popup.status.kind}">
						<Emoji code={STATUS_EMOJI[popup.status.kind]} size={30} alt="" shadow="none" />
						<div>
							<div class="status-title">{popup.status.title}</div>
							{#if popup.status.subtitle}<div class="status-sub">{popup.status.subtitle}</div>{/if}
						</div>
					</div>

					{#if popup.list.length > 1 || (popup.list.length === 1 && popup.list[0].endDate)}
						<ul class="events">
							{#each popup.list as ev (ev.date + ev.title)}
								<li>
									<b>{ev.title}</b>
									{#if ev.endDate && ev.endDate !== ev.date}<span> · {formatRange(ev)}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}

					{#if popup.wx}
						<div class="pop-wx">
							<WeatherIcon code={weatherEmoji(popup.wx.code, true)} size={44} />
							<div class="pop-wx-text">
								<div class="wx-line"><b>{weatherLabel(popup.wx.code, true)}</b> · H {Math.round(popup.wx.temp_max_f)}° / L {Math.round(popup.wx.temp_min_f)}°</div>
								<div class="wx-sub">
									<Emoji code="1f4a7" size={14} alt="" shadow="none" /> Rain {Math.round(popup.wx.rain_max)}%
								</div>
							</div>
						</div>
						{#if popup.outfit}
							<div class="pop-outfit">
								<span>Wear:</span>
								{#each popup.outfit.items as item (item.name)}
									<Emoji code={item.emoji} size={24} alt={item.name} shadow="none" />
								{/each}
								<span class="outfit-text">{popup.outfit.summary}</span>
							</div>
						{/if}
					{:else if popup.ahead > 0}
						<div class="no-wx">The weather shows up here a week before.</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.cal-grid {
		display: grid;
		grid-template-columns: 1.4fr 1fr;
		gap: 14px;
		height: 100%;
		min-height: 0;
	}

	.month-card {
		touch-action: pan-y;
	}
	.month-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
		padding: 0 6px;
	}
	.month-title {
		flex: 1;
		text-align: center;
		font-size: 24px;
		font-weight: 900;
		white-space: nowrap;
	}
	/* sample-pages arrow boxes, sized up to a fat-finger target */
	.nav-arrow,
	.today-btn {
		height: 36px;
		flex: 0 0 auto;
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 8px;
		font: 900 18px 'Nunito', sans-serif;
		box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.1);
	}
	.nav-arrow {
		width: 44px;
	}
	.today-btn {
		padding: 0 10px;
		font-size: 15px;
		background: var(--tab-orange);
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: auto;
		grid-auto-rows: 1fr;
		gap: 6px;
		flex: 1;
		min-height: 0;
	}
	.day-name {
		text-align: center;
		font-weight: 900;
		font-size: 14px;
		color: #64748b;
	}
	.day-cell {
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
		font-weight: 800;
	}
	.day-cell.milestone {
		background: var(--tab-green);
	}
	.day-cell.empty {
		background: transparent;
		border: none;
	}
	.day-cell.holiday {
		background: var(--event-holiday);
		color: white;
	}
	.day-cell.early {
		background: var(--event-early);
	}
	/* today wins over every other mark */
	.day-cell.today {
		background: var(--tab-orange);
		color: white;
		font-size: 20px;
		font-weight: 900;
		border: 3px solid var(--border-dark);
	}

	.legend {
		display: flex;
		justify-content: center;
		gap: 14px;
		margin-top: 8px;
		font-size: 13.5px;
		font-weight: 800;
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--border-dark);
	}
	.dot.red {
		background: var(--event-holiday);
	}
	.dot.yellow {
		background: var(--event-early);
	}
	.dot.green {
		background: var(--tab-green);
	}

	.agenda-list {
		display: flex;
		flex-direction: column;
		gap: 9px;
		overflow-y: auto;
		padding: 6px 4px 0 0;
		margin-top: 0;
	}
	.agenda-item {
		display: flex;
		align-items: center;
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 3px 8px;
		gap: 10px;
		flex: 0 0 auto;
	}
	.agenda-item.kind-no-school,
	.agenda-item.kind-break {
		background: #fee2e2;
		border-color: var(--event-holiday);
	}
	.agenda-item.kind-early {
		background: #fef9c3;
		border-color: #ca8a04;
	}
	.agenda-date {
		background: var(--card-white);
		border: 2px solid var(--border-dark);
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		height: 44px;
		flex: 0 0 auto;
	}
	.agenda-date .month {
		font-size: 12px;
		line-height: 1;
		font-weight: 900;
		text-transform: uppercase;
		color: #ef4444;
	}
	.agenda-date .day {
		font-size: 20px;
		font-weight: 900;
		line-height: 1;
	}
	.agenda-details {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	/* "3 sleeps" sticker on the row's top-right corner */
	.agenda-item {
		position: relative;
	}
	.agenda-item .sleeps {
		position: absolute;
		top: -9px;
		right: 8px;
	}
	.sleeps {
		flex: 0 0 auto;
		background: var(--card-white);
		border: 2px solid var(--border-dark);
		border-radius: 999px;
		padding: 0 8px;
		font-size: 12.5px;
		line-height: 1.35;
		font-weight: 900;
		white-space: nowrap;
	}
	.sleeps.soon {
		background: var(--tab-orange);
		color: #ffffff;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.35);
	}
	.break-countdown {
		margin-top: auto;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		background: #dcfce7;
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 6px 10px;
		font-size: 14px;
		font-weight: 800;
	}
	.break-countdown b {
		font-weight: 900;
	}
	.agenda-title {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 15px;
		font-weight: 900;
		line-height: 1.2;
	}
	.agenda-sub {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 13px;
		font-weight: 800;
		color: #475569;
		margin-top: 2px;
	}
	.agenda-empty {
		text-align: center;
		font-size: 16px;
		font-weight: 800;
		opacity: 0.6;
		margin-top: 30px;
	}

	/* --- tappable days & rows --- */
	button.day-cell {
		font-family: 'Nunito', sans-serif;
		color: inherit;
		padding: 0;
		cursor: pointer;
	}
	button.day-cell:active {
		transform: translate(1px, 1px);
		filter: brightness(0.95);
	}
	button.agenda-item {
		width: 100%;
		text-align: left;
		font-family: 'Nunito', sans-serif;
		color: inherit;
	}
	button.agenda-item:active {
		filter: brightness(0.96);
	}

	/* --- day popup --- */
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(17, 24, 39, 0.35);
	}
	.day-pop {
		width: 600px;
		max-height: 100%;
		padding: 16px 18px;
		animation: pop-in 0.22s ease-out both;
	}
	.close-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 36px;
		height: 36px;
		border: 3px solid var(--border-dark);
		border-radius: 50%;
		background: var(--tab-red);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--sticker-shadow-sm);
	}
	.pop-body {
		display: flex;
		gap: 18px;
		align-items: flex-start;
	}
	.pop-date {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
	}
	.big-date {
		width: 104px;
		height: 104px;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 16px;
		box-shadow: var(--sticker-shadow);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.big-date .month {
		width: 100%;
		text-align: center;
		background: var(--tab-red);
		color: #ffffff;
		font-size: 16px;
		font-weight: 900;
		text-transform: uppercase;
		border-bottom: 3px solid var(--border-dark);
		padding: 2px 0;
	}
	.big-date .day {
		flex: 1;
		display: flex;
		align-items: center;
		font-size: 50px;
		font-weight: 900;
		line-height: 1;
	}
	.weekday {
		font-size: 17px;
		font-weight: 900;
	}
	.pop-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-right: 34px; /* room for the close button */
	}
	.status {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		padding: 8px 12px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.status.kind-no-school {
		background: #fecaca;
	}
	.status.kind-weekend,
	.status.kind-summer {
		background: #bbf7d0;
	}
	.status.kind-regular {
		background: var(--bg-light-blue);
	}
	.status-title {
		font-size: 20px;
		font-weight: 900;
		line-height: 1.15;
	}
	.status-sub {
		font-size: 14px;
		font-weight: 800;
		color: #475569;
	}
	.events {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 14px;
		font-weight: 800;
	}
	.events li::before {
		content: '★ ';
		color: #f59e0b;
	}
	.pop-wx {
		display: flex;
		align-items: center;
		gap: 10px;
		background: var(--bg-light-blue);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		padding: 6px 12px;
	}
	.wx-line {
		font-size: 16px;
		font-weight: 800;
	}
	.wx-line b {
		font-weight: 900;
	}
	.wx-sub {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 14px;
		font-weight: 800;
		color: #475569;
	}
	.pop-outfit {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		font-size: 15px;
		font-weight: 900;
	}
	.outfit-text {
		margin-left: 4px;
		color: #475569;
		font-weight: 800;
	}
	.no-wx {
		font-size: 14px;
		font-weight: 800;
		color: #64748b;
	}
</style>
