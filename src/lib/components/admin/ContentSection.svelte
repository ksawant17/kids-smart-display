<script lang="ts">
	/**
	 * New Content: quotes and facts fetched from the internet wait here; a
	 * grown-up keeps (with a sticker) or skips each one. Kept ones join the
	 * built-in lists on TODAY, QUOTE and FUN.
	 */
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import Emoji from '#lib/components/Emoji.svelte';
	import {
		STICKER_CHOICES,
		suggestEmoji,
		type Candidate,
		type ContentKind,
		type KeptContent
	} from '#lib/utils/content';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	interface ContentState {
		pending: Candidate[];
		kept: KeptContent;
		lastFetch: number;
	}

	let content = $state<ContentState | null>(null);
	let view = $state<ContentKind | 'kept'>('quote');
	let sticker = $state('');

	const waiting = $derived(content?.pending.filter((p) => p.kind === view) ?? []);
	const current = $derived(waiting[0] ?? null);
	const keptCount = $derived(content ? content.kept.quotes.length + content.kept.facts.length : 0);
	const count = (kind: ContentKind) => content?.pending.filter((p) => p.kind === kind).length ?? 0;
	// suggested sticker for each new card
	$effect(() => {
		if (current) sticker = suggestEmoji(current.text, current.kind);
	});
	const stickers = $derived(sticker && !STICKER_CHOICES.includes(sticker) ? [sticker, ...STICKER_CHOICES] : STICKER_CHOICES);

	async function load(fetchMore = false) {
		await admin.attempt(async () => {
			content = fetchMore
				? await admin.api<ContentState>('/api/admin/content', 'POST', { action: 'fetch' })
				: await admin.api<ContentState>('/api/admin/content');
		});
		if (admin.status && content) admin.status.contentPending = content.pending.length;
	}
	onMount(() => load());

	async function act(action: 'keep' | 'skip' | 'remove', id: string) {
		const ok = await admin.attempt(async () => {
			content = await admin.api<ContentState>('/api/admin/content', 'POST', { action, id, emoji: sticker });
		});
		if (!ok) return;
		if (admin.status && content) admin.status.contentPending = content.pending.length;
		if (action !== 'skip') invalidateAll(); // the kiosk shows kept ones straight away
		if (action === 'keep') admin.say('Kept! It will show up on the dashboard');
	}

	const kept = $derived(
		content
			? [
					...content.kept.quotes.map((q) => ({ id: q.id, text: q.text, who: q.author, emoji: q.emoji })),
					...content.kept.facts.map((f) => ({ id: f.id, text: f.text, who: 'fact', emoji: f.emoji[0] }))
				]
			: []
	);
</script>

<div class="a-row">
	<button class="a-chip pressable" class:on={view === 'quote'} onclick={() => (view = 'quote')}>Quotes ({count('quote')})</button>
	<button class="a-chip pressable" class:on={view === 'fact'} onclick={() => (view = 'fact')}>Facts ({count('fact')})</button>
	<button class="a-chip pressable" class:on={view === 'kept'} onclick={() => (view = 'kept')}>Kept ({keptCount})</button>
	<div class="a-spacer"></div>
	<button class="a-btn small pressable" disabled={admin.busy} onclick={() => load(true)}>
		<Emoji code="1f504" size={20} alt="" shadow="none" /> Get more
	</button>
</div>

{#if !content}
	<div class="a-muted">{admin.busy ? 'Fetching from the internet…' : ''}</div>
{:else if view === 'kept'}
	<div class="kept a-scroll">
		{#each kept as k (k.id)}
			<div class="kept-row">
				<Emoji code={k.emoji} size={24} alt="" shadow="none" />
				<div class="kept-text">
					<div>{k.text}</div>
					<div class="a-muted">{k.who === 'fact' ? 'Fun fact' : `– ${k.who}`}</div>
				</div>
				<button class="a-mini pressable" onclick={() => act('remove', k.id)} aria-label="Take it off the dashboard">✕</button>
			</div>
		{:else}
			<div class="a-muted">Nothing kept yet. Keep a few quotes or facts and they'll show up on TODAY, QUOTE and FUN.</div>
		{/each}
	</div>
{:else if current}
	<div class="review anim-pop">
		{#key current.id}
			<div class="text">{current.kind === 'quote' ? `“${current.text}”` : current.text}</div>
			{#if current.author}<div class="who">– {current.author}</div>{/if}
		{/key}
	</div>
	<div class="a-row stickers">
		<span class="a-muted">Sticker</span>
		{#each stickers as e (e)}
			<button class="sticker pressable" class:on={sticker === e} onclick={() => (sticker = e)} aria-label="sticker {e}">
				<Emoji code={e} size={24} alt="" shadow="none" />
			</button>
		{/each}
	</div>
	<div class="a-row">
		<span class="a-muted grow">{waiting.length - 1} more waiting · from {current.source === 'zenquotes' ? 'zenquotes.io' : 'uselessfacts.jsph.pl'}</span>
		<button class="a-btn danger pressable" disabled={admin.busy} onclick={() => act('skip', current!.id)}>Skip</button>
		<button class="a-btn go pressable keep" disabled={admin.busy} onclick={() => act('keep', current!.id)}>Keep</button>
	</div>
{:else}
	<div class="a-muted">
		No new {view === 'quote' ? 'quotes' : 'facts'} waiting. New ones arrive every day, or tap "Get more".
		Only the ones you keep are shown to the kids.
	</div>
{/if}

<style>
	.review {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 8px;
		padding: 12px 18px;
		background: #fef9c3;
		border: 3px solid var(--border-dark);
		border-radius: 16px;
	}
	.text {
		font-size: 22px;
		font-weight: 900;
		line-height: 1.3;
	}
	.who {
		font-size: 17px;
		font-weight: 900;
		color: #475569;
		text-align: right;
	}
	.stickers {
		gap: 5px;
	}
	.sticker {
		width: 40px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--card-white);
		border: 2px solid #cbd5e1;
		border-radius: 10px;
	}
	.sticker.on {
		border-color: var(--border-dark);
		background: var(--yellow-banner);
	}
	.grow {
		flex: 1;
		min-width: 0;
	}
	.keep {
		min-width: 140px;
	}
	.kept {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.kept-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 10px;
		font-size: 15px;
		font-weight: 900;
		background: var(--bg-light-blue);
		border: 2px solid var(--border-dark);
		border-radius: 12px;
	}
	.kept-text {
		flex: 1;
		min-width: 0;
	}
	.kept-text .a-muted {
		font-size: 12px;
	}
	.kept-row .a-mini {
		width: 36px;
		height: 34px;
		font-size: 16px;
	}
</style>
