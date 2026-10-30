<script lang="ts">
	/** Wake-up alarms: the list (on/off, skip the next morning, remove), a new or changed one, and their own volume. */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import Stepper from './Stepper.svelte';
	import TextSheet from './TextSheet.svelte';
	import { now } from '#lib/clock';
	import { loadReminders } from '#lib/reminders';
	import { DAY_NAMES, REPEATS, dayWord, repeatLabel, timeLabel, type Alarm, type Repeat } from '#lib/utils/alarms';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	type Listed = Alarm & { next: number | null };
	type State = { alarms: Listed[]; volume: number };
	let alarms = $state<Listed[]>([]);
	let volume = $state(85);
	let savedVolume = 85;
	// the one being made or changed (id '' = new)
	let id = $state('');
	let hour = $state(6);
	let minute = $state(45);
	let repeat = $state<Repeat>('school');
	let days = $state<number[]>([1, 2, 3, 4, 5]);
	let label = $state('');
	let typing = $state(false);
	let said = $state('');

	const pad = (n: number) => String(n).padStart(2, '0');
	const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

	function got(s: State) {
		alarms = s.alarms;
		volume = savedVolume = s.volume;
		loadReminders();
	}

	onMount(() => {
		admin.attempt(async () => got(await admin.api<State>('/api/alarms')));
	});

	const post = (body: object) => admin.attempt(async () => got(await admin.api<State>('/api/alarms', 'POST', body)));

	function edit(a: Listed | null) {
		id = a?.id ?? '';
		[hour, minute] = a ? a.time.split(':').map(Number) : [6, 45];
		repeat = a?.repeat ?? 'school';
		days = a?.days.length ? [...a.days] : [1, 2, 3, 4, 5];
		label = a?.label ?? '';
	}

	async function save() {
		const old = alarms.find((a) => a.id === id);
		const alarm = {
			id: id || undefined,
			time: `${pad(hour)}:${pad(minute)}`,
			label,
			repeat,
			days: repeat === 'days' ? days : [],
			on: old?.on ?? true,
			skip: old?.skip ?? null
		};
		if (await post({ save: alarm })) {
			admin.say(id ? 'Alarm changed' : 'Alarm set');
			edit(null);
		}
	}

	async function remove(alarm: string) {
		if ((await post({ remove: alarm })) && alarm === id) edit(null);
	}

	function toggle(a: Listed) {
		post({ save: { ...a, on: !a.on } });
	}

	function toggleDay(d: number) {
		days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
	}

	// the volume is saved a moment after the last press
	let volumeTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const v = volume;
		if (v === savedVolume) return;
		if (volumeTimer) clearTimeout(volumeTimer);
		volumeTimer = setTimeout(() => post({ volume: v }), 600);
	});

	async function tryIt() {
		said = '';
		await admin.attempt(async () => (said = (await admin.api<{ text: string }>('/api/alarms', 'POST', { try: true })).text));
	}

	function nextText(a: Listed): string {
		if (!a.on) return 'Off';
		if (!a.next) return 'Not coming up';
		const d = new Date(a.next);
		return `${a.skip ? 'Skipping one, then ' : 'Next: '}${dayWord(d, $now)}`;
	}
</script>

<div class="a-cols">
	<div class="a-col">
		<SectionTitle>Wake-up alarms</SectionTitle>
		<div class="list a-scroll">
			{#each alarms as a (a.id)}
				<div class="alarm" class:off={!a.on} class:editing={a.id === id}>
					<button class="what pressable" onclick={() => edit(a)} aria-label="Change this alarm">
						<span class="time">{timeLabel(a.time)}</span>
						<span class="info">
							<span>{a.label || repeatLabel(a)}</span>
							<span class="a-muted">{a.label ? `${repeatLabel(a)} · ` : ''}{nextText(a)}</span>
						</span>
					</button>
					<div class="acts">
					{#if a.on && a.repeat !== 'once'}
						<button class="a-mini pressable skip" class:on={!!a.skip} onclick={() => post({ skip: a.id, on: !a.skip })}>
							{a.skip ? 'Skipped' : 'Skip next'}
						</button>
					{/if}
					<button class="a-mini pressable onoff" class:on={a.on} onclick={() => toggle(a)}>{a.on ? 'ON' : 'OFF'}</button>
					<button class="a-mini pressable" onclick={() => remove(a.id)} aria-label="Remove alarm">✕</button>
					</div>
				</div>
			{:else}
				<div class="a-muted">No alarms yet. Make one on the right, like 6:45 AM on school days.</div>
			{/each}
		</div>
		<div class="a-box loud">
			<Emoji code="23f0" size={22} alt="Alarm loudness" shadow="none" />
			<Stepper bind:value={volume} min={10} max={100} step={10} format={(v) => `${v}%`} label="alarm loudness" />
			<button class="a-btn small pressable" disabled={admin.busy} onclick={tryIt}>
				<Emoji code="1f50a" size={18} alt="" shadow="none" /> Try
			</button>
		</div>
		{#if said}<div class="a-muted said">Said: “{said}”</div>{/if}
	</div>

	<div class="a-col composer">
		<SectionTitle>{id ? 'Change alarm' : 'New alarm'}</SectionTitle>
		<div class="a-box when">
			<Stepper bind:value={hour} min={0} max={23} format={hourLabel} label="hour" />
			<Stepper bind:value={minute} min={0} max={55} step={5} format={(m) => `:${pad(m)}`} label="minutes" />
		</div>
		<div class="repeats">
			{#each REPEATS as r (r.id)}
				<button class="a-chip pressable" class:on={repeat === r.id} onclick={() => (repeat = r.id)}>{r.label}</button>
			{/each}
		</div>
		{#if repeat === 'days'}
			<div class="days">
				{#each DAY_NAMES as name, d (name)}
					<button class="a-chip pressable" class:on={days.includes(d)} onclick={() => toggleDay(d)}>{name}</button>
				{/each}
			</div>
		{:else if repeat === 'school'}
			<div class="a-muted">Mon–Fri, skipping holidays and breaks on the school calendar.</div>
		{/if}
		<div class="a-spacer"></div>
		<div class="a-row">
			{#if id}<button class="a-btn small pressable" onclick={() => edit(null)}>Cancel</button>{/if}
			<button class="a-btn small pressable name" onclick={() => (typing = true)}>
				<Emoji code="270f" size={18} alt="" shadow="none" />
				<span>{label || 'Name'}</span>
			</button>
			<button class="a-btn go pressable grow" disabled={admin.busy || (repeat === 'days' && !days.length)} onclick={save}>
				{id ? 'Save' : 'Set the alarm'}
			</button>
		</div>
	</div>
</div>

{#if typing}
	<TextSheet
		title="Alarm name"
		maxLength={40}
		capitalize
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
	.alarm {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 6px;
		padding: 4px;
		background: #ffedd5;
		border: 2px solid var(--border-dark);
		border-radius: 12px;
	}
	.alarm.off {
		background: #e5e7eb;
		opacity: 0.75;
	}
	.alarm.editing {
		outline: 3px solid #f97316;
	}
	.what {
		flex: 1 1 100%;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 4px;
		font: inherit;
		color: var(--text-dark);
		text-align: left;
		background: none;
		border: 0;
	}
	.time {
		font-size: 19px;
		font-weight: 900;
		white-space: nowrap;
	}
	.info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		font-size: 14px;
		font-weight: 900;
	}
	.info span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.info .a-muted {
		font-size: 11.5px;
	}
	.alarm .a-mini {
		height: 34px;
		min-width: 36px;
		padding: 0 6px;
		font-size: 12px;
		font-weight: 900;
	}
	.acts {
		display: flex;
		gap: 6px;
		margin-left: auto;
	}
	.loud :global(.a-val) {
		min-width: 54px;
	}
	.when {
		justify-content: space-between;
		gap: 4px;
		padding-left: 4px;
	}
	.when :global(.a-val) {
		min-width: 50px;
	}
	.name {
		max-width: 130px;
	}
	.name span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.onoff.on {
		background: #86efac;
	}
	.skip.on {
		background: #fde68a;
	}
	.said {
		font-size: 12px;
	}
	.composer {
		flex: 1.1;
	}
	.repeats {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 5px;
	}
	.days {
		display: flex;
		gap: 4px;
	}
	.days .a-chip {
		flex: 1;
		padding: 0;
	}
	.grow {
		flex: 1;
	}
</style>
