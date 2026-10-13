<script lang="ts">
	/** − value + : steps through `choices` (snapping odd values in), or by `step` within min..max */
	let {
		value = $bindable(),
		choices,
		min = -Infinity,
		max = Infinity,
		step = 1,
		format = String,
		label = 'value',
		disabled = false
	}: {
		value: number;
		choices?: number[];
		min?: number;
		max?: number;
		step?: number;
		format?: (n: number) => string;
		label?: string;
		disabled?: boolean;
	} = $props();

	function move(dir: 1 | -1) {
		if (choices) {
			value =
				dir > 0
					? (choices.find((v) => v > value) ?? choices[choices.length - 1])
					: ([...choices].reverse().find((v) => v < value) ?? choices[0]);
		} else value = Math.min(max, Math.max(min, value + dir * step));
	}
	const atMin = $derived(choices ? value <= choices[0] : value <= min);
	const atMax = $derived(choices ? value >= choices[choices.length - 1] : value >= max);
</script>

<div class="a-row stepper">
	<button class="a-mini pressable" disabled={disabled || atMin} onclick={() => move(-1)} aria-label="less {label}">−</button>
	<span class="a-val">{format(value)}</span>
	<button class="a-mini pressable" disabled={disabled || atMax} onclick={() => move(1)} aria-label="more {label}">+</button>
</div>

<style>
	.stepper {
		gap: 6px;
		flex: 0 0 auto;
	}
</style>
