<script lang="ts">
	/** Date & time: time zone, automatic (internet) time, or set it by hand. */
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import SetupNote from './SetupNote.svelte';
	import { now } from '#lib/clock';
	import { clockTime } from '#lib/utils/time';
	import { US_TIMEZONES, tzLabel, type TimeStatus } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const status = $derived(admin.status!);

	let askZone = $state<string | null>(null);
	let manual = $state(new Date(new Date().setSeconds(0, 0)));

	const zones = $derived(
		US_TIMEZONES.some((z) => z.id === status.time.timezone)
			? US_TIMEZONES
			: [...US_TIMEZONES, { id: status.time.timezone, label: tzLabel(status.time.timezone) }]
	);

	async function setNtp(on: boolean) {
		manual = new Date(new Date().setSeconds(0, 0));
		await admin.attempt(async () => {
			const t = await admin.api<TimeStatus>('/api/admin/time', 'POST', { ntp: on });
			status.time = t;
		});
	}

	function nudge(unit: 'day' | 'hour' | 'minute', by: number) {
		const d = new Date(manual);
		if (unit === 'day') d.setDate(d.getDate() + by);
		if (unit === 'hour') d.setHours(d.getHours() + by);
		if (unit === 'minute') d.setMinutes(d.getMinutes() + by);
		manual = d;
	}

	const pad = (n: number) => String(n).padStart(2, '0');
	async function setClock() {
		const d = manual;
		const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
		if (await admin.attempt(() => admin.api('/api/admin/time', 'POST', { time }))) admin.say('Clock set');
	}
</script>

<div class="a-row clock">
	<div class="big-clock">{clockTime($now)}</div>
	<div class="a-muted">
		{$now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
	</div>
</div>
{#if !status.permissions.clock}<SetupNote />{/if}
<SectionTitle>Time zone</SectionTitle>
<div class="chips">
	{#each zones as z (z.id)}
		<button
			class="a-chip pressable"
			class:on={z.id === status.time.timezone}
			disabled={admin.busy || !status.permissions.clock}
			onclick={() => z.id !== status.time.timezone && (askZone = z.id)}
		>
			{z.label}
		</button>
	{/each}
</div>
{#if askZone}
	<div class="a-confirm anim-pop">
		Change to {tzLabel(askZone)} time? The screen restarts.
		<button class="a-btn small go pressable" onclick={() => (admin.changeZone(askZone!), (askZone = null))}>Change</button>
		<button class="a-btn small pressable" onclick={() => (askZone = null)}>Cancel</button>
	</div>
{/if}
<div class="a-row">
	<SectionTitle>Set automatically</SectionTitle>
	<button
		class="a-toggle pressable"
		class:on={status.time.ntp}
		disabled={admin.busy || !status.permissions.clock}
		onclick={() => setNtp(!status.time.ntp)}
		aria-pressed={status.time.ntp}
	>
		{status.time.ntp ? 'ON' : 'OFF'}
	</button>
	<span class="a-muted">
		{status.time.ntp ? (status.time.synced ? 'from the internet, in sync' : 'waiting for the internet…') : 'set by hand below'}
	</span>
</div>
{#if !status.time.ntp}
	<div class="a-row manual">
		<div class="a-row step">
			<button class="a-mini pressable" onclick={() => nudge('day', -1)}>−</button>
			<span class="a-val date">{manual.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
			<button class="a-mini pressable" onclick={() => nudge('day', 1)}>+</button>
		</div>
		<div class="a-row step">
			<button class="a-mini pressable" onclick={() => nudge('hour', -1)}>−</button>
			<span class="a-val">{manual.toLocaleTimeString('en-US', { hour: 'numeric' })}</span>
			<button class="a-mini pressable" onclick={() => nudge('hour', 1)}>+</button>
		</div>
		<div class="a-row step">
			<button class="a-mini pressable" onclick={() => nudge('minute', -1)}>−</button>
			<span class="a-val">:{pad(manual.getMinutes())}</span>
			<button class="a-mini pressable" onclick={() => nudge('minute', 1)}>+</button>
		</div>
		<button class="a-btn small go pressable" disabled={admin.busy} onclick={setClock}>Set clock</button>
	</div>
{/if}

<style>
	.clock {
		align-items: baseline;
		gap: 14px;
	}
	.big-clock {
		font-size: 40px;
		font-weight: 900;
		line-height: 1;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 7px;
	}
	.manual {
		flex-wrap: wrap;
		gap: 8px;
	}
	.step {
		gap: 6px;
	}
	.date {
		min-width: 150px;
	}
</style>
