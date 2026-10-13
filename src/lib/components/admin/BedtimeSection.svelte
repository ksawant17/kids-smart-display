<script lang="ts">
	/** Bedtime (quiet hours): dim, off after a minute, back on in the morning. */
	import Emoji from '#lib/components/Emoji.svelte';
	import Stepper from './Stepper.svelte';
	import { hhmmLabel } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const bed = $derived(admin.status!.settings.bedtime);

	const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
	const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
	const label = (m: number) => hhmmLabel(toHhmm(m));

	// svelte-ignore state_referenced_locally (an editable copy; Save sends it)
	let enabled = $state(bed.enabled);
	// svelte-ignore state_referenced_locally
	let start = $state(toMin(bed.start));
	// svelte-ignore state_referenced_locally
	let end = $state(toMin(bed.end));
	const changed = $derived(enabled !== bed.enabled || toHhmm(start) !== bed.start || toHhmm(end) !== bed.end);
</script>

<div class="a-row">
	<Emoji code="1f319" size={40} alt="" />
	<span class="a-big">Bedtime</span>
	<button class="a-toggle pressable" class:on={enabled} onclick={() => (enabled = !enabled)} aria-pressed={enabled}>
		{enabled ? 'ON' : 'OFF'}
	</button>
</div>
<div class="a-box" class:off={!enabled}>
	<span class="a-label">Lights out at</span>
	<Stepper bind:value={start} min={0} max={1425} step={15} format={label} label="bedtime" disabled={!enabled} />
</div>
<div class="a-box" class:off={!enabled}>
	<span class="a-label">Wake up at</span>
	<Stepper bind:value={end} min={0} max={1425} step={15} format={label} label="wake-up time" disabled={!enabled} />
</div>
<div class="a-muted">
	At bedtime the screen goes dim, and turns off a minute after the last touch (a touch still wakes it, dimly).
	At wake-up time it turns back on by itself.
</div>
<div class="a-spacer"></div>
<button
	class="a-btn go pressable"
	disabled={admin.busy || !changed || start === end}
	onclick={() => admin.save({ bedtime: { enabled, start: toHhmm(start), end: toHhmm(end) } })}
>
	Save
</button>

<style>
	.off {
		opacity: 0.5;
	}
</style>
