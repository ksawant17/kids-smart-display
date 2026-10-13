<script lang="ts">
	/** Notes for the TODAY banner: pick a ready-made one or type your own, for today / tomorrow / every day. */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import TextSheet from './TextSheet.svelte';
	import { todayKey } from '#lib/clock';
	import { loadMessages } from '#lib/messages';
	import { keyOf, parseKey } from '#lib/utils/schoolCalendar';
	import {
		MESSAGE_EMOJIS,
		MESSAGE_MAX,
		MESSAGE_PRESETS,
		whenLabel,
		type ParentMessage
	} from '#lib/utils/messages';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	let list = $state<ParentMessage[]>([]);
	let draft = $state<{ text: string; emoji: string; custom: boolean } | null>(null);
	let typing = $state(false);
	let when = $state<'today' | 'tomorrow' | 'always'>('today');

	const tomorrowKey = $derived.by(() => {
		const d = parseKey($todayKey);
		d.setDate(d.getDate() + 1);
		return keyOf(d);
	});

	onMount(() => {
		admin.attempt(async () => (list = await admin.api<ParentMessage[]>('/api/messages')));
	});

	async function post() {
		if (!draft) return;
		const from = when === 'tomorrow' ? tomorrowKey : $todayKey;
		const until = when === 'always' ? null : from;
		const d = draft;
		const ok = await admin.attempt(async () => {
			list = await admin.api<ParentMessage[]>('/api/admin/messages', 'POST', { text: d.text, emoji: d.emoji, from, until });
		});
		if (ok) {
			draft = null;
			admin.say('Note posted on TODAY');
			loadMessages();
		}
	}

	async function remove(id: string) {
		if (await admin.attempt(async () => (list = await admin.api<ParentMessage[]>(`/api/admin/messages?id=${id}`, 'DELETE')))) {
			loadMessages();
		}
	}
</script>

<div class="a-cols">
	<div class="a-col">
		<SectionTitle>On the TODAY screen</SectionTitle>
		<div class="list a-scroll">
			{#each list as m (m.id)}
				<div class="msg">
					<Emoji code={m.emoji} size={26} alt="" shadow="none" />
					<div class="msg-text">
						<div>{m.text}</div>
						<div class="a-muted">{whenLabel(m, $todayKey, tomorrowKey)}</div>
					</div>
					<button class="a-mini pressable" onclick={() => remove(m.id)} aria-label="Remove note">✕</button>
				</div>
			{:else}
				<div class="a-muted">No notes yet. Pick one on the right.</div>
			{/each}
		</div>
	</div>

	<div class="a-col composer">
		{#if !draft}
			<SectionTitle>New note</SectionTitle>
			<div class="presets">
				{#each MESSAGE_PRESETS as p (p.text)}
					<button class="preset pressable" onclick={() => (draft = { ...p, custom: false })}>
						<Emoji code={p.emoji} size={20} alt="" shadow="none" />
						<span>{p.text}</span>
					</button>
				{/each}
			</div>
			<button class="a-btn small pressable" onclick={() => (typing = true)}>
				<Emoji code="270f" size={20} alt="" shadow="none" /> Type my own
			</button>
		{:else}
			<div class="preview">
				<Emoji code={draft.emoji} size={28} alt="" shadow="none" />
				<span>{draft.text}</span>
			</div>
			{#if draft.custom}
				<div class="emojis">
					{#each MESSAGE_EMOJIS as e (e)}
						<button class="emoji pressable" class:on={draft.emoji === e} onclick={() => (draft!.emoji = e)}>
							<Emoji code={e} size={24} alt="" shadow="none" />
						</button>
					{/each}
				</div>
			{/if}
			<div class="a-row">
				{#each [['today', 'Today'], ['tomorrow', 'Tomorrow'], ['always', 'Every day']] as [id, label] (id)}
					<button class="a-chip pressable" class:on={when === id} onclick={() => (when = id as typeof when)}>{label}</button>
				{/each}
			</div>
			<div class="a-muted">
				{when === 'tomorrow'
					? 'Shows from 6 PM tonight (when TODAY switches to tomorrow) and all day tomorrow.'
					: when === 'always'
						? 'Stays until you remove it.'
						: 'Gone tomorrow.'}
			</div>
			<div class="a-spacer"></div>
			<div class="a-row">
				<button class="a-btn small pressable" onclick={() => (draft = null)}>Back</button>
				<button class="a-btn go pressable grow" disabled={admin.busy} onclick={post}>Post it</button>
			</div>
		{/if}
	</div>
</div>

{#if typing}
	<TextSheet
		title="Note for the kids"
		maxLength={MESSAGE_MAX}
		capitalize
		saveLabel="Next"
		onsave={(t) => {
			typing = false;
			draft = { text: t, emoji: MESSAGE_EMOJIS[0], custom: true };
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
	.msg {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 8px;
		background: #dcfce7;
		border: 2px solid var(--border-dark);
		border-radius: 12px;
		font-size: 15px;
		font-weight: 900;
	}
	.msg-text {
		flex: 1;
		min-width: 0;
	}
	.msg-text .a-muted {
		font-size: 12px;
	}
	.msg .a-mini {
		width: 36px;
		height: 34px;
		font-size: 16px;
	}
	.composer {
		flex: 1.2;
	}
	.presets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
	}
	.preset {
		height: 38px;
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 0 6px;
		font: 900 12.5px 'Nunito', sans-serif;
		color: var(--text-dark);
		text-align: left;
		background: var(--card-white);
		border: 2px solid var(--border-dark);
		border-radius: 10px;
		overflow: hidden;
	}
	.preset span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.preview {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		font-size: 18px;
		font-weight: 900;
		background: #dcfce7;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
	}
	.emojis {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.emoji {
		width: 42px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--card-white);
		border: 2px solid #cbd5e1;
		border-radius: 10px;
	}
	.emoji.on {
		border-color: var(--border-dark);
		background: var(--yellow-banner);
	}
	.grow {
		flex: 1;
	}
</style>
