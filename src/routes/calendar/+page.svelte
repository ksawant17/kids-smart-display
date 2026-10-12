<script lang="ts">
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { dateKey, monthMarks, upNext, parseKey } from '#lib/utils/schoolCalendar';
	import { monthTitle } from '#lib/utils/time';
	import { todayKey } from '#lib/clock';

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

	const agenda = $derived(upNext(events, $todayKey, 4));

	const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

	// Swipe left/right on the month grid to change months.
	let startX: number | null = null;
	function gridDown(e: PointerEvent) {
		startX = e.clientX;
	}
	function gridUp(e: PointerEvent) {
		if (startX === null) return;
		const dx = e.clientX - startX;
		startX = null;
		if (Math.abs(dx) > 50) shift(dx < 0 ? 1 : -1);
	}
</script>

<div class="cal-grid">
	<!-- Left: month grid -->
	<div class="card month-card" onpointerdown={gridDown} onpointerup={gridUp} role="group" aria-label="Month calendar">
		<div class="month-header">
			<button class="nav-arrow pressable" onclick={() => shift(-1)} aria-label="Previous month">&lsaquo;</button>
			<div class="month-title">{monthTitle(viewYear, viewMonth)}</div>
			{#if !isCurrentMonth}
				<button class="today-btn pressable" onclick={goToday}>Today</button>
			{/if}
			<button class="nav-arrow pressable" onclick={() => shift(1)} aria-label="Next month">&rsaquo;</button>
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
				{@const dow = (firstDay + i) % 7}
				<div
					class="day-cell"
					class:weekend={dow === 0 || dow === 6}
					class:today={key === $todayKey}
					class:holiday={mark === 'holiday'}
					class:early={mark === 'early'}
					class:milestone={mark === 'milestone'}
				>
					{d}
				</div>
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
				<div class="agenda-item kind-{item.kind}">
					<div class="agenda-date">
						<span class="month">{when.toLocaleDateString('en-US', { month: 'short' })}</span>
						<span class="day">{when.getDate()}</span>
					</div>
					<div class="agenda-details">
						<span class="agenda-title">{item.title}</span>
						<span class="agenda-sub">{item.subtitle}</span>
					</div>
				</div>
			{:else}
				<div class="agenda-empty">All done — nothing coming up!</div>
			{/each}
		</div>
	</div>
</div>

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
		margin-bottom: 6px;
		padding: 0 4px;
	}
	.month-title {
		flex: 1;
		text-align: center;
		font-size: 22px;
		font-weight: 900;
		white-space: nowrap;
	}
	/* fat-finger targets: 44px */
	.nav-arrow {
		width: 44px;
		height: 40px;
		flex: 0 0 auto;
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		font: 900 30px/1 'Nunito', sans-serif;
		padding-bottom: 4px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.today-btn {
		height: 40px;
		flex: 0 0 auto;
		padding: 0 12px;
		background: var(--tab-orange);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		font: 900 15px 'Nunito', sans-serif;
		box-shadow: var(--sticker-shadow-sm);
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 4px 6px;
		flex: 1;
		align-content: start;
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
		font-size: 17px;
		font-weight: 800;
		min-height: 31px;
	}
	.day-cell.weekend {
		background: #e2e8f0;
		color: #475569;
	}
	.day-cell.milestone {
		background: var(--tab-green);
	}
	.day-cell.empty {
		background: transparent;
		border: none;
	}
	.day-cell.today {
		background: var(--tab-orange);
		color: white;
		font-size: 20px;
		font-weight: 900;
		border: 3px solid var(--border-dark);
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
		box-shadow: 0 0 0 3px var(--card-white), 0 0 0 5px var(--border-dark);
	}

	.legend {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin-top: 8px;
		font-size: 13px;
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
		gap: 8px;
		overflow-y: auto;
		padding-right: 4px;
		margin-top: 2px;
	}
	.agenda-item {
		display: flex;
		align-items: center;
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 4px 8px;
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
		font-size: 11px;
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
	}
	.agenda-title {
		font-size: 15px;
		font-weight: 900;
		line-height: 1.2;
	}
	.agenda-sub {
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
</style>
