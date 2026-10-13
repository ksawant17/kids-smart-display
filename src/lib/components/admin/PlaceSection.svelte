<script lang="ts">
	/** Weather place: type a ZIP code, check the town it found, use it. */
	import Keypad from '#lib/components/Keypad.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { loadWeather } from '#lib/weather';
	import { tzLabel } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	interface Place {
		zip: string;
		name: string;
		latitude: number;
		longitude: number;
		timezone: string | null;
	}

	const status = $derived(admin.status!);
	const loc = $derived(status.settings.location);
	let zip = $state('');
	let found = $state<Place | null>(null);

	function find(value: string) {
		found = null;
		admin.attempt(async () => (found = await admin.api<Place>(`/api/admin/zip?zip=${value}`)));
	}

	async function use() {
		if (!found) return;
		const { zip: z, name, latitude, longitude } = found;
		if (await admin.save({ location: { zip: z, name, latitude, longitude } }, `Weather is now for ${name}`)) {
			zip = '';
			loadWeather();
		}
	}
</script>

<div class="a-cols">
	<div class="a-col">
		<SectionTitle>Weather for</SectionTitle>
		<div class="a-big">{loc.name}</div>
		<div class="a-muted">{loc.zip ? `ZIP ${loc.zip}` : 'set by map position'}</div>
		<div class="a-spacer"></div>
		{#if found}
			<div class="found anim-pop">
				<div class="a-muted">ZIP {found.zip} is</div>
				<div class="a-big">{found.name}</div>
				{#if found.timezone}<div class="a-muted">{tzLabel(found.timezone)} time</div>{/if}
				{#if found.zip !== loc.zip || found.name !== loc.name}
					<button class="a-btn go pressable" disabled={admin.busy} onclick={use}>Use this place</button>
				{:else if found.timezone && found.timezone !== status.time.timezone && status.permissions.clock}
					<div class="a-muted">The Pi's clock is on {tzLabel(status.time.timezone)} time.</div>
					<button class="a-btn pressable" disabled={admin.busy} onclick={() => admin.changeZone(found!.timezone!)}>
						Switch clock to {tzLabel(found.timezone)}
					</button>
				{/if}
			</div>
		{:else}
			<div class="a-muted">Type a ZIP code to change it.</div>
		{/if}
	</div>
	<div class="pad">
		<div class="entry" class:empty={!zip}>{zip || 'ZIP code'}</div>
		<Keypad bind:value={zip} length={5} okLabel="Find" disabled={admin.busy} onok={find} />
	</div>
</div>

<style>
	.found {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		background: #ecfccb;
		border: 3px solid var(--border-dark);
		border-radius: 14px;
	}
	.pad {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.entry {
		width: 232px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 28px;
		font-weight: 900;
		letter-spacing: 4px;
		background: var(--bg-light-blue);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		margin-bottom: 8px;
	}
	.entry.empty {
		font-size: 18px;
		letter-spacing: 0;
		color: #94a3b8;
	}
</style>
