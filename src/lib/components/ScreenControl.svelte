<script lang="ts">
	/**
	 * Quick menu: a sheet that drops from the top of the screen when you pull
	 * down from the header. Brightness slider (changes
	 * the backlight live, remembered on the server), with the audio HAT also
	 * a volume slider and a mic on/off switch, then "Screen Off" and
	 * "Grown-ups" (the PIN-locked admin tab).
	 * Close: swipe the sheet up, tap outside it, or Done.
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { goto } from '$app/navigation';
	import { screenPanelOpen } from '#lib/screen';

	let {
		brightness,
		min,
		onbrightness,
		voice,
		onvolume,
		onmic,
		onoff
	}: {
		brightness: number;
		min: number;
		/** called while dragging (live) */
		onbrightness: (value: number) => void;
		/** null: no audio HAT, so no sound controls */
		voice: { volume: number; mic: boolean } | null;
		/** while dragging (done: false) and once when let go (done: true) */
		onvolume: (value: number, done: boolean) => void;
		onmic: (on: boolean) => void;
		/** "Turn screen off" */
		onoff: () => void;
	} = $props();

	const close = () => screenPanelOpen.set(false);

	function onScrimDown(e: PointerEvent) {
		if (e.target === e.currentTarget) close();
	}

	// swipe the sheet up to close, from anywhere on it; a slider drag is
	// sideways, so it never counts
	let start: { x: number; y: number } | null = null;
	function sheetUp(e: PointerEvent) {
		if (!start) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (dy < -40 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
	}
</script>

{#if $screenPanelOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions (scrim tap = close; Done button is the accessible path) -->
	<div class="overlay" onpointerdown={onScrimDown}>
		<div
			class="card panel"
			role="dialog"
			aria-modal="true"
			aria-label="Quick menu"
			tabindex="-1"
			onpointerdown={(e) => (start = { x: e.clientX, y: e.clientY })}
			onpointerup={sheetUp}
		>
			<SectionTitle big>{voice ? 'Screen & Sound' : 'Screen Brightness'}</SectionTitle>

			<div class="slider-row">
				<Emoji code="1f506" size={38} alt="brightness" shadow="none" />
				<input
					type="range"
					{min}
					max="100"
					step="1"
					value={brightness}
					aria-label="Screen brightness"
					style="--fill:{((brightness - min) / (100 - min)) * 100}%"
					oninput={(e) => onbrightness(Number(e.currentTarget.value))}
				/>
				<span class="value">{brightness}%</span>
			</div>

			{#if voice}
				<div class="slider-row">
					<Emoji code={voice.volume ? '1f50a' : '1f507'} size={38} alt="volume" shadow="none" />
					<input
						type="range"
						min="0"
						max="100"
						step="5"
						value={voice.volume}
						aria-label="Volume"
						style="--fill:{voice.volume}%"
						oninput={(e) => onvolume(Number(e.currentTarget.value), false)}
						onchange={(e) => onvolume(Number(e.currentTarget.value), true)}
					/>
					<span class="value">{voice.volume ? `${voice.volume}%` : 'Off'}</span>
				</div>
				<button class="mic pressable" class:on={voice.mic} onclick={() => onmic(!voice.mic)} aria-pressed={voice.mic}>
					<Emoji code="1f3a4" size={26} alt="" shadow="none" />
					Microphone
					<b>{voice.mic ? 'ON' : 'OFF'}</b>
				</button>
			{/if}

			<div class="buttons">
				<button
					class="btn off pressable"
					onclick={() => {
						close();
						onoff();
					}}
				>
					<Emoji code="1f634" size={26} alt="" shadow="none" />
					Screen Off
				</button>
				<button
					class="btn grownups pressable"
					onclick={() => {
						close();
						goto('/admin');
					}}
				>
					<Emoji code="1f512" size={24} alt="" shadow="none" />
					Grown-ups
				</button>
				<button class="btn done pressable" onclick={close}>
					<Emoji code="2705" size={24} alt="" shadow="none" />
					Done
				</button>
			</div>

			<div class="hint">Dims after a while and turns off later on its own. Touch to wake.</div>
			<div class="grabber" aria-hidden="true"></div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		background: rgba(17, 24, 39, 0.35);
	}
	/* a sheet hanging from the top edge */
	.panel {
		width: 600px;
		padding: 14px 26px 8px;
		align-items: center;
		gap: 6px;
		background: #fef9c3;
		border-top: none;
		border-radius: 0 0 22px 22px;
		animation: slide-down 0.22s ease-out both;
		touch-action: none;
	}
	.grabber {
		width: 60px;
		height: 6px;
		border-radius: 3px;
		background: rgba(17, 24, 39, 0.35);
		margin-top: 4px;
	}
	.value {
		flex: 0 0 70px;
		font-size: 26px;
		font-weight: 900;
		line-height: 1;
		text-align: right;
	}
	.slider-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.mic {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 46px;
		margin: 2px 0 8px;
		padding: 0 8px 0 14px;
		font: 900 18px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		background: #e5e7eb;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.mic b {
		padding: 2px 12px;
		color: #fff;
		background: #64748b;
		border-radius: 999px;
	}
	.mic.on {
		background: #dcfce7;
	}
	.mic.on b {
		background: #16a34a;
	}

	/* big, fat-finger slider in the sticker style */
	input[type='range'] {
		flex: 1;
		height: 56px;
		appearance: none;
		-webkit-appearance: none;
		background: transparent;
		touch-action: none;
	}
	input[type='range']::-webkit-slider-runnable-track {
		height: 22px;
		border-radius: 999px;
		border: 3px solid var(--border-dark);
		background: linear-gradient(to right, var(--yellow-banner) var(--fill), var(--card-white) var(--fill));
		box-shadow: var(--sticker-shadow-sm);
	}
	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 46px;
		height: 46px;
		margin-top: -15px;
		border-radius: 50%;
		background: var(--tab-orange);
		border: 3px solid var(--border-dark);
		box-shadow: 2px 3px 0 rgba(0, 0, 0, 0.2);
	}

	.buttons {
		display: flex;
		gap: 14px;
		width: 100%;
	}
	.btn {
		flex: 1;
		height: 54px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font: 900 19px 'Nunito', 'Baloo 2', sans-serif;
		white-space: nowrap;
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.btn.off {
		background: #c7d2fe;
	}
	.btn.grownups {
		background: #e5e7eb;
	}
	.btn.done {
		background: var(--tab-green);
	}
	.hint {
		margin-top: 6px;
		font-size: 13px;
		font-weight: 800;
		color: #475569;
	}
</style>
