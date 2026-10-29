<script lang="ts">
	/**
	 * AI Helper: the address and key of an AI chat server on the home network
	 * (see src/lib/server/ai.ts), a Test button that lists its models, and
	 * which features may use it. The key is never shown again, only "…abcd".
	 */
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import Emoji from '#lib/components/Emoji.svelte';
	import TextSheet from './TextSheet.svelte';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	interface Features {
		briefing: boolean;
		stories: boolean;
		content: boolean;
	}
	interface AiState {
		enabled: boolean;
		url: string;
		keyHint: string;
		model: string;
		features: Features;
	}

	const FEATURES: { id: keyof Features; label: string; emoji: string; hint: string }[] = [
		{ id: 'briefing', label: 'Daily briefing', emoji: '2728', hint: 'on TODAY' },
		{ id: 'stories', label: 'Bedtime stories', emoji: '1f4d6', hint: 'on FUN' },
		{ id: 'content', label: 'New jokes, facts, words', emoji: '1f4e5', hint: 'wait for your OK' }
	];

	let saved = $state<AiState | null>(null);
	// the editable copy; a new key is only sent when one was typed
	let enabled = $state(false);
	let url = $state('');
	let key = $state<string | null>(null);
	let model = $state('');
	let features = $state<Features>({ briefing: true, stories: true, content: true });
	let models = $state<string[]>([]);
	let reply = $state('');
	let editing = $state<'url' | 'key' | null>(null);

	function take(s: AiState) {
		saved = s;
		enabled = s.enabled;
		url = s.url;
		key = null;
		model = s.model;
		features = { ...s.features };
	}
	onMount(() => admin.attempt(async () => take(await admin.api<AiState>('/api/admin/ai'))));

	const changed = $derived(
		!!saved &&
			(enabled !== saved.enabled ||
				url !== saved.url ||
				key !== null ||
				model !== saved.model ||
				FEATURES.some((f) => features[f.id] !== saved!.features[f.id]))
	);

	async function test() {
		reply = '';
		await admin.attempt(async () => {
			const r = await admin.api<{ models: string[]; reply: string }>('/api/admin/ai', 'POST', {
				action: 'test',
				url,
				model,
				...(key !== null ? { key } : {})
			});
			models = r.models;
			if (!model || !models.includes(model)) model = models[0] ?? '';
			reply = r.reply;
		});
	}

	async function save() {
		const ok = await admin.attempt(async () =>
			take(
				await admin.api<AiState>('/api/admin/ai', 'POST', {
					action: 'save',
					enabled,
					url,
					model,
					features,
					...(key !== null ? { key } : {})
				})
			)
		);
		if (ok) {
			admin.say('Saved');
			invalidateAll(); // the kiosk shows or hides the AI bits straight away
		}
	}
</script>

{#if saved}
	<div class="a-row">
		<Emoji code="1f916" size={40} alt="" />
		<span class="a-big">AI Helper</span>
		<button class="a-toggle pressable" class:on={enabled} onclick={() => (enabled = !enabled)} aria-pressed={enabled}>
			{enabled ? 'ON' : 'OFF'}
		</button>
		<div class="a-spacer"></div>
		<button class="a-btn small pressable" disabled={admin.busy || !url} onclick={test}>Test</button>
		<button class="a-btn small go pressable" disabled={admin.busy || !changed} onclick={save}>Save</button>
	</div>

	<div class="a-cols">
		<div class="a-col">
			<button class="a-box field pressable" onclick={() => (editing = 'url')}>
				<span class="a-label">Server</span>
				<span class="val">{url || 'Tap to type the address'}</span>
			</button>
			<button class="a-box field pressable" onclick={() => (editing = 'key')}>
				<span class="a-label">Key</span>
				<span class="val">{key !== null ? (key ? 'new key typed' : 'no key') : saved.keyHint || 'none (tap to add)'}</span>
			</button>
			{#if models.length || model}
				<div class="models">
					{#each models.length ? models : [model] as m (m)}
						<button class="a-chip pressable" class:on={m === model} onclick={() => (model = m)}>{m}</button>
					{/each}
				</div>
			{/if}
			{#if reply}
				<div class="reply anim-pop"><Emoji code="1f916" size={24} alt="" shadow="none" /> “{reply}”</div>
			{/if}
		</div>
		<div class="a-col">
			{#each FEATURES as f (f.id)}
				<div class="a-box" class:off={!enabled}>
					<Emoji code={f.emoji} size={26} alt="" shadow="none" />
					<span class="feat">{f.label}<small>{f.hint}</small></span>
					<button
						class="a-toggle pressable"
						class:on={features[f.id]}
						disabled={!enabled}
						onclick={() => (features[f.id] = !features[f.id])}
						aria-pressed={features[f.id]}
					>
						{features[f.id] ? 'ON' : 'OFF'}
					</button>
				</div>
			{/each}
			<div class="a-muted">
				Works with any OpenAI-style chat server (llama.cpp, Ollama, LM Studio). Everything it writes is checked
				for blocked words, and new jokes, facts and words still wait in New Content for your OK.
			</div>
		</div>
	</div>
{/if}

{#if editing === 'url'}
	<TextSheet
		title="AI server address"
		value={url || 'http://'}
		maxLength={200}
		placeholder="http://192.168.1.20:8080"
		onsave={(t) => ((url = t.trim()), (editing = null), (models = []), (reply = ''))}
		oncancel={() => (editing = null)}
	/>
{:else if editing === 'key'}
	<TextSheet
		title="AI server key (leave empty for none)"
		maxLength={200}
		minLength={0}
		onsave={(t) => ((key = t.trim()), (editing = null))}
		oncancel={() => (editing = null)}
	/>
{/if}

<style>
	.field {
		font: inherit;
		text-align: left;
		cursor: pointer;
		min-height: 46px;
	}
	.val {
		flex: 1;
		min-width: 0;
		text-align: right;
		font-size: 15px;
		font-weight: 900;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.models {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.models .a-chip {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.reply {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		font-size: 16px;
		font-weight: 900;
		background: #ecfccb;
		border: 3px solid var(--border-dark);
		border-radius: 12px;
	}
	.feat {
		flex: 1;
		display: flex;
		flex-direction: column;
		font-size: 16px;
		font-weight: 900;
		line-height: 1.1;
	}
	.feat small {
		font-size: 12px;
		color: #64748b;
	}
	.off {
		opacity: 0.5;
	}
</style>
