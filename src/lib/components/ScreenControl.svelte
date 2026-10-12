<script lang="ts">
	/**
	 * Brightness panel (opened by tapping the clock). The slider changes the
	 * backlight live; the value is remembered on the server.
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { screenPanelOpen } from '#lib/screen';

	let {
		brightness,
		min,
		onbrightness,
		onoff
	}: {
		brightness: number;
		min: number;
		/** called while dragging (live) */
		onbrightness: (value: number) => void;
		/** "Turn screen off" */
		onoff: () => void;
	} = $props();

	const close = () => screenPanelOpen.set(false);

	function onScrimDown(e: PointerEvent) {
		if (e.target === e.currentTarget) close();
	}
</script>

{#if $screenPanelOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions (scrim tap = close; Done button is the accessible path) -->
	<div class="overlay" onpointerdown={onScrimDown}>
		<div class="card panel" role="dialog" aria-modal="true" aria-label="Screen brightness" tabindex="-1">
			<SectionTitle big>Screen Brightness</SectionTitle>

			<div class="value">{brightness}%</div>

			<div class="slider-row">
				<Emoji code="1f505" size={34} alt="dimmer" shadow="none" />
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
				<Emoji code="1f506" size={40} alt="brighter" shadow="none" />
			</div>

			<div class="buttons">
				<button
					class="btn off pressable"
					onclick={() => {
						close();
						onoff();
					}}
				>
					<Emoji code="1f634" size={26} alt="" shadow="none" />
					Turn Screen Off
				</button>
				<button class="btn done pressable" onclick={close}>
					<Emoji code="2705" size={24} alt="" shadow="none" />
					Done
				</button>
			</div>

			<div class="hint">Dims after a while and turns off later on its own. Touch to wake.</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: absolute;
		inset: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(17, 24, 39, 0.35);
	}
	.panel {
		width: 560px;
		padding: 18px 26px 14px;
		align-items: center;
		gap: 6px;
		background: #fef9c3;
		animation: pop-in 0.25s ease-out both;
	}
	.value {
		font-size: 44px;
		font-weight: 900;
		line-height: 1;
	}
	.slider-row {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 14px;
		margin: 10px 0 14px;
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
		font: 900 19px 'Nunito', sans-serif;
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.btn.off {
		background: #c7d2fe;
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
