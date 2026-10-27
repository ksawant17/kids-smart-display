<script lang="ts">
	/** The kids: name, animal buddy, clothes colour; add or remove (1-4). */
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import TextSheet from './TextSheet.svelte';
	import { BUDDIES, BUDDY_COLORS } from '#lib/buddies';
	import { MAX_KIDS } from '#lib/utils/admin';
	import type { Kid } from '#lib/config';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const saved = $derived(admin.status!.settings.kids);

	// svelte-ignore state_referenced_locally (an editable copy; Save sends it)
	let kids = $state<Kid[]>(saved.map((k) => ({ ...k })));
	let sel = $state(0);
	let naming = $state<number | null>(null);
	let askRemove = $state(false);

	const kid = $derived(kids[sel]);
	const changed = $derived(JSON.stringify(kids) !== JSON.stringify(saved));
	const colors = $derived(BUDDY_COLORS.includes(kid?.color) ? BUDDY_COLORS : [...BUDDY_COLORS, kid.color]);

	function add() {
		const used = new Set(kids.map((k) => k.avatar));
		kids.push({
			name: '',
			avatar: BUDDIES.find((b) => !used.has(b)) ?? 'bear',
			color: BUDDY_COLORS[kids.length % BUDDY_COLORS.length]
		});
		sel = kids.length - 1;
		naming = sel;
	}

	function remove() {
		askRemove = false;
		kids.splice(sel, 1);
		sel = Math.max(0, sel - 1);
	}

	function save() {
		if (kids.some((k) => !k.name.trim())) return admin.say('Every kid needs a name', true);
		admin.save({ kids });
	}
</script>

<div class="tabs">
	{#each kids as k, i (i)}
		<button class="kid-tab pressable" class:on={i === sel} onclick={() => ((sel = i), (askRemove = false))}>
			<KidAvatar kid={k} size={52} />
			<span>{k.name || '?'}</span>
		</button>
	{/each}
	{#if kids.length < MAX_KIDS}
		<button class="kid-tab add pressable" onclick={add}>
			<Emoji code="2795" size={30} alt="" shadow="none" />
			<span>Add</span>
		</button>
	{/if}
	<div class="a-spacer"></div>
	<button class="a-btn go pressable save" disabled={admin.busy || !changed} onclick={save}>Save</button>
</div>

{#if kid}
	<div class="a-row">
		<span class="a-label lbl">Name</span>
		<button class="a-btn small name pressable" onclick={() => (naming = sel)}>{kid.name || 'Type a name'}</button>
		<div class="a-spacer"></div>
		{#if kids.length > 1}
			{#if askRemove}
				<span class="a-label">Remove {kid.name || 'this kid'}?</span>
				<button class="a-btn small danger pressable" onclick={remove}>Yes</button>
				<button class="a-btn small pressable" onclick={() => (askRemove = false)}>No</button>
			{:else}
				<button class="a-btn small pressable" onclick={() => (askRemove = true)}>Remove</button>
			{/if}
		{/if}
	</div>
	<div class="a-row">
		<span class="a-label lbl">Buddy</span>
		<div class="choices">
			{#each BUDDIES as b (b)}
				<button class="buddy pressable" class:on={kid.avatar === b} onclick={() => (kid.avatar = b)} aria-label={b}>
					<KidAvatar kid={{ ...kid, avatar: b }} size={46} />
				</button>
			{/each}
		</div>
	</div>
	<div class="a-row">
		<span class="a-label lbl">Colour</span>
		<div class="choices">
			{#each colors as c (c)}
				<button
					class="swatch pressable"
					class:on={kid.color.toLowerCase() === c.toLowerCase()}
					style="background:{c}"
					onclick={() => (kid.color = c)}
					aria-label="colour {c}"
				></button>
			{/each}
		</div>
	</div>
{/if}

{#if naming !== null}
	<TextSheet
		title="Kid's name"
		value={kids[naming]?.name ?? ''}
		maxLength={16}
		capitalize
		saveLabel="OK"
		onsave={(t) => {
			kids[naming!].name = t;
			naming = null;
		}}
		oncancel={() => {
			// a new kid without a name is dropped again
			if (!kids[naming!].name) {
				kids.splice(naming!, 1);
				sel = Math.max(0, kids.length - 1);
			}
			naming = null;
		}}
	/>
{/if}

<style>
	.tabs {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.kid-tab {
		width: 92px;
		height: 86px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
		font: 900 14px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		background: var(--bg-light-blue);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		overflow: hidden;
	}
	.kid-tab span {
		max-width: 84px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.kid-tab.on {
		background: var(--yellow-banner);
	}
	.kid-tab.add {
		background: #f1f5f9;
		border-style: dashed;
	}
	.save {
		align-self: flex-start;
	}
	.lbl {
		width: 66px;
		flex: 0 0 auto;
	}
	.name {
		min-width: 160px;
		justify-content: flex-start;
		font-size: 18px;
	}
	.choices {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.buddy {
		width: 62px;
		height: 58px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--card-white);
		border: 3px solid #cbd5e1;
		border-radius: 12px;
		overflow: hidden;
	}
	.buddy.on {
		border-color: var(--border-dark);
		background: var(--yellow-banner);
	}
	.swatch {
		width: 44px;
		height: 40px;
		border: 3px solid #cbd5e1;
		border-radius: 12px;
	}
	.swatch.on {
		border-color: var(--border-dark);
		box-shadow: 0 0 0 3px var(--yellow-banner);
	}
</style>
