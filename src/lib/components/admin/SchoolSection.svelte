<script lang="ts">
	/** School: the calendar feed (.ics link) and the school-day hours. */
	import { page } from '$app/state';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import Stepper from './Stepper.svelte';
	import TextSheet from './TextSheet.svelte';
	import { todayKey } from '#lib/clock';
	import { parseKey, upNext } from '#lib/utils/schoolCalendar';
	import type { SchoolEvent } from '#lib/utils/schoolCalendar';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const school = $derived(admin.status!.settings.school);
	const ip = $derived(admin.status!.system.ip[0]);

	// svelte-ignore state_referenced_locally (an editable copy; Save sends it)
	let start = $state(school.startHour);
	// svelte-ignore state_referenced_locally
	let end = $state(school.endHour);
	let editing = $state(false);

	const events = $derived((page.data.schoolEvents ?? []) as SchoolEvent[]);
	const next = $derived(upNext(events, $todayKey, 1)[0]);
	const hour = (h: number) => new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' });

	async function useLink(url: string) {
		editing = false;
		await admin.save({ school: { icsUrl: url, startHour: start, endHour: end } }, 'Calendar updated');
	}
</script>

<SectionTitle>School calendar</SectionTitle>
<div class="a-row">
	<div class="link">{school.icsUrl}</div>
	<button class="a-btn small pressable" disabled={admin.busy} onclick={() => (editing = true)}>Change link</button>
</div>
<div class="a-muted">
	{events.length} school dates loaded{next ? ` · next: ${next.title}, ${parseKey(next.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.
	Paste your district's calendar (.ics or webcal) link; easier from a phone{ip ? ` at http://${ip}:3000/admin` : ''}.
</div>
<SectionTitle>School day</SectionTitle>
<div class="a-box">
	<Stepper bind:value={start} min={5} max={Math.min(12, end - 1)} format={hour} label="start" />
	<span class="a-label">to</span>
	<Stepper bind:value={end} min={Math.max(11, start + 1)} max={19} format={hour} label="end" />
	<button
		class="a-btn small go pressable"
		disabled={admin.busy || (start === school.startHour && end === school.endHour)}
		onclick={() => admin.save({ school: { icsUrl: school.icsUrl, startHour: start, endHour: end } })}
	>
		Save
	</button>
</div>
<div class="a-muted">The outfit is picked for the weather during school hours.</div>

{#if editing}
	<TextSheet
		title="Calendar link"
		value={school.icsUrl}
		maxLength={500}
		minLength={10}
		placeholder="https://…"
		saveLabel="Check & use"
		onsave={useLink}
		oncancel={() => (editing = false)}
	/>
{/if}

<style>
	.link {
		flex: 1;
		min-width: 0;
		padding: 8px 10px;
		font-size: 13px;
		font-weight: 800;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		background: var(--bg-light-blue);
		border: 2px solid var(--border-dark);
		border-radius: 10px;
		user-select: text;
	}
</style>
