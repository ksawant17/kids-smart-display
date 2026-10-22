<script lang="ts">
	/**
	 * Big on-screen number pad (the kiosk has no keyboard): PINs and ZIP codes.
	 * Typing stops at `length` digits; OK is enabled once it is full.
	 */
	import Emoji from '#lib/components/Emoji.svelte';

	let {
		value = $bindable(''),
		length,
		okLabel = 'OK',
		disabled = false,
		onok
	}: {
		value?: string;
		length: number;
		okLabel?: string;
		disabled?: boolean;
		onok: (value: string) => void;
	} = $props();

	const type = (d: string) => {
		if (!disabled && value.length < length) value += d;
	};
	const back = () => (value = value.slice(0, -1));
</script>

<div class="keypad" role="group" aria-label="Number pad">
	{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
		<button class="key pressable" {disabled} onclick={() => type(d)}>{d}</button>
	{/each}
	<button class="key back pressable" disabled={disabled || !value} onclick={back} aria-label="Delete">
		<Emoji code="2b05" size={26} alt="" shadow="none" />
	</button>
	<button class="key pressable" {disabled} onclick={() => type('0')}>0</button>
	<button class="key ok pressable" disabled={disabled || value.length !== length} onclick={() => onok(value)}>
		{okLabel}
	</button>
</div>

<style>
	.keypad {
		display: grid;
		grid-template-columns: repeat(3, 72px);
		grid-auto-rows: 54px;
		gap: 8px;
	}
	.key {
		font: 900 26px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		box-shadow: var(--sticker-shadow-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.key.back {
		background: #fde68a;
	}
	.key.ok {
		background: var(--tab-green);
		font-size: 18px;
	}
	.key:disabled {
		opacity: 0.45;
	}
</style>
