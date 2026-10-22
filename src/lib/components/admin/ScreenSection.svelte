<script lang="ts">
	/** Screen timers: dim, off, back to TODAY (or the idle screen). */
	import Stepper from './Stepper.svelte';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const s = $derived(admin.status!.settings);

	// svelte-ignore state_referenced_locally (an editable copy; Save sends it)
	let dim = $state(s.screen.dimAfterMinutes);
	// svelte-ignore state_referenced_locally
	let off = $state(s.screen.offAfterMinutes);
	// svelte-ignore state_referenced_locally
	let idle = $state(s.kiosk.idleReturnSeconds);
	// svelte-ignore state_referenced_locally
	let idleScreen = $state(s.kiosk.idleScreen);
	const changed = $derived(
		dim !== s.screen.dimAfterMinutes ||
			off !== s.screen.offAfterMinutes ||
			idle !== s.kiosk.idleReturnSeconds ||
			idleScreen !== s.kiosk.idleScreen
	);

	const minutes = (m: number) => (m === 0 ? 'Never' : m < 60 ? `${m} min` : `${m / 60} h`);
	const seconds = (n: number) => (n === 0 ? 'Never' : n < 60 ? `${n} sec` : `${n / 60} min`);
</script>

<div class="list">
	<div class="a-box">
		<span class="a-label">Dim the screen after</span>
		<Stepper bind:value={dim} choices={[0, 1, 2, 5, 10, 15, 20, 30, 45, 60]} format={minutes} label="dim time" />
	</div>
	<div class="a-box">
		<span class="a-label">Turn the screen off after</span>
		<Stepper bind:value={off} choices={[0, 5, 10, 15, 30, 45, 60, 90, 120, 180, 240]} format={minutes} label="off time" />
	</div>
	<div class="a-box">
		<span class="a-label">{idleScreen ? 'Show the idle screen after' : 'Go back to TODAY after'}</span>
		<div class="right">
			<button class="a-toggle pressable" class:on={idleScreen} onclick={() => (idleScreen = !idleScreen)} aria-pressed={idleScreen}>
				Idle screen {idleScreen ? 'ON' : 'OFF'}
			</button>
			<Stepper bind:value={idle} choices={[0, 30, 60, 120, 180, 300, 600]} format={seconds} label="return time" />
		</div>
	</div>
</div>
<div class="a-muted">
	…without anyone touching it. The idle screen shows a big clock, the weather and festivals; a tap opens TODAY.
	Brightness: pull down from the top.
</div>
<div class="a-spacer"></div>
<button
	class="a-btn go pressable"
	disabled={admin.busy || !changed}
	onclick={() =>
		admin.save({ screen: { dimAfterMinutes: dim, offAfterMinutes: off }, kiosk: { idleReturnSeconds: idle, idleScreen } })}
>
	Save
</button>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.right .a-toggle {
		width: auto;
		padding: 0 14px;
		white-space: nowrap;
	}
</style>
