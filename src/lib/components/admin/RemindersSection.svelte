<script lang="ts">
	/** Timers and reminders: what's set (kids set them with 🎤 Ask), take one off, or set one here. */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import Stepper from './Stepper.svelte';
	import TextSheet from './TextSheet.svelte';
	import { now } from '#lib/clock';
	import { loadReminders } from '#lib/reminders';
	import { clockTime, duration, type Reminder } from '#lib/utils/reminders';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	type State = { upcoming: Reminder[]; ringing: Reminder[] };
	let list = $state<Reminder[]>([]);
	let kind = $state<'timer' | 'reminder'>('reminder');
	let minutes = $state(10);
	let hour = $state(16);
	let minute = $state(0);
	let label = $state('');
	let typing = $state(false);

	const MINUTES = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
	const pad = (n: number) => String(n).padStart(2, '0');
	const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
	const tomorrow = $derived(hour * 60 + minute <= $now.getHours() * 60 + $now.getMinutes());

	onMount(() => {
		admin.attempt(async () => (list = (await admin.api<State>('/api/reminders')).upcoming));
	});

	function when(r: Reminder): string {
		if (r.kind === 'timer') return `${duration((r.at - $now.getTime()) / 1000)} left`;
		const day = new Date(r.at).toDateString() === $now.toDateString() ? 'today' : 'tomorrow';
		return `${clockTime(r.at)} ${day}`;
	}

	async function set() {
		const body =
			kind === 'timer'
				? { action: 'add', kind, minutes, label }
				: { action: 'add', kind, time: `${pad(hour)}:${pad(minute)}`, label };
		if (await admin.attempt(async () => (list = (await admin.api<State>('/api/reminders', 'POST', body)).upcoming))) {
			admin.say(kind === 'timer' ? 'Timer started' : 'Reminder set');
			label = '';
			loadReminders();
		}
	}

	async function remove(id: string) {
		if (await admin.attempt(async () => (list = (await admin.api<State>('/api/reminders', 'POST', { action: 'cancel', id })).upcoming))) {
			loadReminders();
		}
	}
</script>

<div class="a-cols">
	<div class="a-col">
		<SectionTitle>Set now</SectionTitle>
		<div class="list a-scroll">
			{#each list as r (r.id)}
				<div class="item">
					<Emoji code={r.kind === 'timer' ? '23f2' : '1f514'} size={26} alt="" shadow="none" />
					<div class="item-text">
						<div>{r.label || (r.kind === 'timer' ? 'Timer' : 'Reminder')}</div>
						<div class="a-muted">{when(r)}</div>
					</div>
					<button class="a-mini pressable" onclick={() => remove(r.id)} aria-label="Remove">✕</button>
				</div>
			{:else}
				<div class="a-muted">Nothing set. Kids can say "set a timer for 10 minutes" or "remind me at 4 to feed the fish" to the Ask button.</div>
			{/each}
		</div>
	</div>

	<div class="a-col composer">
		<SectionTitle>New</SectionTitle>
		<div class="a-row">
			<button class="a-chip pressable" class:on={kind === 'reminder'} onclick={() => (kind = 'reminder')}><Emoji code="1f514" size={18} alt="" shadow="none" /> Reminder</button>
			<button class="a-chip pressable" class:on={kind === 'timer'} onclick={() => (kind = 'timer')}><Emoji code="23f2" size={18} alt="" shadow="none" /> Timer</button>
		</div>
		{#if kind === 'timer'}
			<div class="a-box">
				<span class="a-label">for</span>
				<Stepper bind:value={minutes} choices={MINUTES} format={(m) => duration(m * 60)} label="minutes" />
			</div>
		{:else}
			<div class="a-box">
				<span class="a-label">at</span>
				<Stepper bind:value={hour} min={0} max={23} format={hourLabel} label="hour" />
				<Stepper bind:value={minute} min={0} max={55} step={5} format={(m) => `:${pad(m)}`} label="minutes" />
			</div>
			<div class="a-muted">{tomorrow ? 'Tomorrow (that time has gone by today).' : 'Today.'} Silent during bedtime quiet hours.</div>
		{/if}
		<button class="a-btn small pressable" onclick={() => (typing = true)}>
			<Emoji code="270f" size={20} alt="" shadow="none" />
			{label ? `“${label}”` : 'What for? (optional)'}
		</button>
		<div class="a-spacer"></div>
		<button class="a-btn go pressable" disabled={admin.busy} onclick={set}>
			{kind === 'timer' ? 'Start the timer' : 'Set the reminder'}
		</button>
	</div>
</div>

{#if typing}
	<TextSheet
		title={kind === 'timer' ? 'What is the timer for?' : 'Remind them to…'}
		maxLength={60}
		saveLabel="OK"
		onsave={(t) => {
			typing = false;
			label = t;
		}}
		oncancel={() => (typing = false)}
	/>
{/if}

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex: 1;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 8px;
		background: #fef3c7;
		border: 2px solid var(--border-dark);
		border-radius: 12px;
		font-size: 15px;
		font-weight: 900;
	}
	.item-text {
		flex: 1;
		min-width: 0;
	}
	.item-text .a-muted {
		font-size: 12px;
	}
	.item .a-mini {
		width: 36px;
		height: 34px;
		font-size: 16px;
	}
	.composer {
		flex: 1.2;
	}
</style>
