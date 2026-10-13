<script lang="ts">
	/** Change the grown-ups PIN (typed twice). */
	import Keypad from '#lib/components/Keypad.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	let pin = $state('');
	let first = $state('');

	async function submit(value: string) {
		if (!first) {
			first = value;
			pin = '';
			return;
		}
		const again = first;
		first = '';
		pin = '';
		if (value !== again) return admin.say("Those didn't match. Try again.", true);
		if (await admin.attempt(() => admin.api('/api/admin/pin', 'POST', { pin: value }))) admin.say('New PIN saved');
	}
</script>

<div class="a-cols">
	<div class="a-col">
		<SectionTitle>Change the PIN</SectionTitle>
		<div class="a-label">{first ? 'Type the new PIN again' : 'Type a new 4-digit PIN'}</div>
		<div class="dots">
			{#each [0, 1, 2, 3] as i (i)}
				<span class="dot" class:full={i < pin.length}></span>
			{/each}
		</div>
		<div class="a-muted">Forgot it? Delete data/admin.json on the Pi, then make a new one here.</div>
	</div>
	<div class="pad">
		<Keypad bind:value={pin} length={4} disabled={admin.busy} onok={submit} />
	</div>
</div>

<style>
	.pad {
		display: flex;
		align-items: center;
	}
	.dots {
		display: flex;
		gap: 14px;
		margin: 4px 0;
	}
	.dot {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 3px solid var(--border-dark);
		background: var(--card-white);
	}
	.dot.full {
		background: var(--tab-orange);
	}
</style>
