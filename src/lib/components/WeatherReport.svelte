<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { reportState, closeReport } from '#lib/report';
	import { weather, loadWeather } from '#lib/weather';
	import { weatherEmoji } from '#lib/utils/weatherCodes';
	import { clockTime, hourLabel } from '#lib/utils/time';

	// Live, shared forecast (refreshed in the background by the root layout).
	const data = $derived($weather.data);
	let selected = $state(0); // 0 = today, 1 = tomorrow

	const day = $derived(data ? data.days[selected] : null);

	// When the report is opened: honour the requested day.
	$effect(() => {
		if ($reportState.open) selected = $reportState.day;
	});

	/* ---------- gestures: swipe up on the card closes ---------- */
	let startY: number | null = null;
	function onDown(e: PointerEvent) {
		startY = e.clientY;
	}
	function onUp(e: PointerEvent) {
		if (startY === null) return;
		const dy = e.clientY - startY;
		startY = null;
		if (dy < -40) closeReport();
	}
	function onLeave() {
		startY = null;
	}
	// Tapping the darkened scrim (outside the card) closes the panel.
	function onScrimDown(e: PointerEvent) {
		if (e.target === e.currentTarget) closeReport();
	}
</script>

{#if $reportState.open}
	<!-- svelte-ignore a11y_no_static_element_interactions (scrim tap = close; ✕ button is the accessible path) -->
	<div class="overlay" onpointerdown={onScrimDown}>
		<div
			class="card report"
			role="dialog"
			aria-modal="true"
			aria-label="Full weather report"
			tabindex="-1"
			onpointerdown={(e) => {
				e.stopPropagation();
				onDown(e);
			}}
			onpointerup={onUp}
			onpointerleave={onLeave}
		>
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
					<button class="retry pressable" onclick={closeReport}>Close</button>
				</div>
			{:else}
				<div class="report-head">
					<div class="title-wrap">
						<SectionTitle>Full Weather Report</SectionTitle>
						<div class="report-sub">
							{data.location}
							{#if data.stale || $weather.error} · updated {clockTime(new Date(data.fetched_at))}
							{:else if selected === 0} · today
							{:else} · tomorrow
							{/if}
						</div>
					</div>
					<button class="close-btn pressable" onclick={closeReport} aria-label="Close weather report">
						<Emoji code="274c" size={22} alt="Close" shadow="none" />
					</button>
				</div>

				<!-- full-width hourly strip -->
				<div class="hourly-section">
					<div class="hourly-label">Next 24 Hours</div>
					<div class="hourly-strip">
						{#each data.hourly as h, i (h.time)}
							<div class="hour-box">
								<div class="hour-time">{i === 0 ? 'Now' : hourLabel(h.time)}</div>
								<Emoji code={weatherEmoji(h.weather_code, h.is_day === 1)} size={26} alt="" />
								<div class="hour-temp">{Math.round(h.temp_f)}°</div>
								<div class="hour-pop {h.pop >= 40 ? 'wet' : ''}">
									<Emoji code="1f4a7" size={10} alt="" shadow="none" />{h.pop}%
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- day details -->
				<div class="day-section">
					<div class="day-pills" role="tablist">
						<button
							class="day-pill pressable {selected === 0 ? 'on' : ''}"
							role="tab"
							aria-selected={selected === 0}
							onclick={() => (selected = 0)}
						>
							Today
						</button>
						{#if data.days[1]}
							<button
								class="day-pill pressable {selected === 1 ? 'on' : ''}"
								role="tab"
								aria-selected={selected === 1}
								onclick={() => (selected = 1)}
							>
								Tomorrow
							</button>
						{/if}
					</div>

					<div class="detail-grid">
						<div class="detail">
							<Emoji code="1f321" size={20} alt="" />
							<span>High {Math.round(day.temp_max_f)}° · Low {Math.round(day.temp_min_f)}°</span>
						</div>
						<div class="detail">
							<Emoji code="1f4a7" size={20} alt="" />
							<span>Rain chance {Math.round(day.rain_max)}%</span>
						</div>
						<div class="detail">
							<Emoji code="1f32c" size={20} alt="" />
							<span>Wind {Math.round(day.wind_mph)} mph</span>
						</div>
						<div class="detail">
							<Emoji code="1f4a7" size={20} alt="" />
							<span>Humidity {day.humidity == null ? '—' : Math.round(day.humidity) + '%'}</span>
						</div>
						<div class="detail">
							<Emoji code="1f305" size={20} alt="" />
							<span>Sunrise {day.sunrise ? clockTime(new Date(day.sunrise)) : '—'}</span>
						</div>
						<div class="detail">
							<Emoji code="1f306" size={20} alt="" />
							<span>Sunset {day.sunset ? clockTime(new Date(day.sunset)) : '—'}</span>
						</div>
					</div>
				</div>

				<div class="swipe-hint">
					<Emoji code="2b06" size={14} alt="" shadow="none" /> swipe up or tap ✕ to close
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
		margin: 10px;
		animation: slide-down 0.22s ease-out both;
		overflow: hidden;
		padding: 12px 14px 8px;
		display: flex;
		flex-direction: column;
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

	.report-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.title-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.report-sub {
		font-size: 13px;
		font-weight: 800;
		opacity: 0.6;
		white-space: nowrap;
	}

	.close-btn {
		width: 36px;
		height: 36px;
		border: 3px solid var(--border-dark);
		border-radius: 50%;
		background: var(--tab-red);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: var(--sticker-shadow-sm);
		flex: 0 0 auto;
	}

	/* --- hourly strip: 13 equal boxes across the full width --- */
	.hourly-section {
		margin-top: 10px;
	}
	.hourly-label {
		font-size: 14px;
		font-weight: 900;
		margin-bottom: 6px;
	}
	.hourly-strip {
		display: flex;
		gap: 7px;
	}
	.hour-box {
		flex: 1 1 0;
		min-width: 0;
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 6px 2px 7px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.hour-time {
		font-size: 11.5px;
		font-weight: 900;
	}
	.hour-temp {
		font-size: 16px;
		font-weight: 900;
		line-height: 1.1;
	}
	.hour-pop {
		font-size: 11px;
		font-weight: 800;
		color: var(--border-dark);
		opacity: 0.55;
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.hour-pop.wet {
		opacity: 1;
		background: #bfdbfe;
		border-radius: 8px;
		padding: 0 4px;
	}

	/* --- day details --- */
	.day-section {
		margin-top: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.day-pills {
		display: flex;
		gap: 10px;
	}
	.day-pill {
		flex: 1;
		padding: 7px 0;
		font: 900 15px 'Nunito', sans-serif;
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		background: var(--bg-light-blue);
		box-shadow: var(--sticker-shadow-sm);
	}
	.day-pill.on {
		background: var(--yellow-banner);
	}

	.detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px 12px;
	}
	.detail {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 800;
		background: var(--bg-light-blue);
		border: 2.5px solid var(--border-dark);
		border-radius: 12px;
		padding: 9px 12px;
		min-width: 0;
		box-shadow: var(--sticker-shadow-sm);
	}
	.detail span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.swipe-hint {
		margin-top: auto;
		text-align: center;
		font-size: 11.5px;
		font-weight: 800;
		opacity: 0.55;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding-top: 4px;
	}
</style>
