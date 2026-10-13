<script lang="ts">
	/** What to Wear: the temperature bands, the rain cut-off, when to show tomorrow. Saves as you go. */
	import Emoji from '#lib/components/Emoji.svelte';
	import Stepper from './Stepper.svelte';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const w = $derived(admin.status!.settings.wardrobe);

	// svelte-ignore state_referenced_locally (an editable copy, saved a moment after each change)
	let v = $state({ ...w });

	const deg = (n: number) => `${n}°F`;
	const hour = (h: number) => (h >= 24 ? 'Never' : new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' }));

	// save a moment after the last tap
	$effect(() => {
		const next = JSON.stringify(v);
		if (next === JSON.stringify(w)) return;
		const t = setTimeout(() => admin.save({ wardrobe: JSON.parse(next) }), 1200);
		return () => clearTimeout(t);
	});
</script>

<div class="rows">
	<div class="a-box">
		<span class="a-row a-label"><Emoji code="1f9e3" size={26} alt="" shadow="none" />Winter coat below</span>
		<Stepper bind:value={v.coldBelowF} min={0} max={v.coolUpToF} format={deg} label="coat temperature" />
	</div>
	<div class="a-box">
		<span class="a-row a-label"><Emoji code="1f9e5" size={26} alt="" shadow="none" />Light jacket up to</span>
		<Stepper bind:value={v.coolUpToF} min={v.coldBelowF} max={v.mildUpToF - 1} format={deg} label="jacket temperature" />
	</div>
	<div class="a-box">
		<span class="a-row a-label">
			<Emoji code="1f455" size={26} alt="" shadow="none" />Long sleeves up to
			<span class="a-muted">(T-shirt above)</span>
		</span>
		<Stepper bind:value={v.mildUpToF} min={v.coolUpToF + 1} max={100} format={deg} label="long-sleeve temperature" />
	</div>
	<div class="a-box">
		<span class="a-row a-label"><Emoji code="2614" size={26} alt="" shadow="none" />Umbrella when rain chance is over</span>
		<Stepper bind:value={v.rainChancePct} min={0} max={100} step={5} format={(n) => `${n}%`} label="rain chance" />
	</div>
	<div class="a-box">
		<span class="a-row a-label"><Emoji code="1f319" size={26} alt="" shadow="none" />Show tomorrow's outfit from</span>
		<Stepper bind:value={v.switchToTomorrowHour} min={12} max={24} format={hour} label="switch hour" />
	</div>
</div>
<div class="a-muted">Feels-like temperature during school hours. Changes save by themselves.</div>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.rows :global(.a-box) {
		min-height: 46px;
		padding: 2px 4px 2px 10px;
	}
	.a-label {
		gap: 8px;
	}
</style>
