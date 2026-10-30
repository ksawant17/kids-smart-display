<script lang="ts">
	/**
	 * Voice: who reads aloud (the briefing, answers to 🎤 questions) and how
	 * fast. Picking a voice saves it straight away and it says hello, so you
	 * can hear it. The voices come from the voice server (AI Helper); without
	 * one the Pi only has Amy.
	 *
	 * Also the clock announcement on the hour: which hours, with or without
	 * the weather, and a "Say it now" button to hear it.
	 */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import Stepper from './Stepper.svelte';
	import type { AdminSession } from '#lib/admin.svelte';
	import { hourName, type HourlySettings } from '#lib/utils/announce';

	let { admin }: { admin: AdminSession } = $props();

	interface Voice {
		id: string;
		name: string;
		funny: boolean;
	}
	interface VoiceState {
		installed: boolean;
		server: boolean;
		voices: Voice[];
		voice: string;
		speed: number;
		hourly: HourlySettings;
	}

	const FUNNY_EMOJI: Record<string, string> = { chipmunk: '1f43f', bear: '1f43b', robot: '1f916', alien: '1f47d' };
	const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2, 1.3];
	const speedLabel = (n: number) => (n === 1 ? 'Normal' : n < 1 ? `Slower ${Math.round(n * 100)}%` : `Faster ${Math.round(n * 100)}%`);

	let info = $state<VoiceState | null>(null);
	let speed = $state(1);
	let from = $state(7);
	let to = $state(20);
	let said = $state('');

	onMount(() =>
		admin.attempt(async () => {
			info = await admin.api<VoiceState>('/api/admin/voice');
			speed = SPEEDS.reduce((a, b) => (Math.abs(b - info!.speed) < Math.abs(a - info!.speed) ? b : a));
			from = info.hourly.from;
			to = info.hourly.to;
		})
	);

	async function pick(patch: { voice?: string; speed?: number }) {
		await admin.attempt(async () => {
			const s = await admin.api<{ voice: string; speed: number }>('/api/admin/voice', 'POST', patch);
			info = { ...info!, voice: s.voice, speed: s.speed };
		});
	}

	async function saveHourly(patch: Partial<HourlySettings>) {
		await admin.attempt(async () => {
			const s = await admin.api<{ hourly: HourlySettings }>('/api/admin/voice', 'POST', {
				hourly: { ...info!.hourly, ...patch }
			});
			info = { ...info!, hourly: s.hourly };
		});
	}

	async function sayNow() {
		said = '';
		await admin.attempt(async () => {
			said = (await admin.api<{ text: string }>('/api/admin/voice', 'POST', { announce: true })).text;
		});
	}

	// the hour steppers changed: save them
	$effect(() => {
		if (info && (from !== info.hourly.from || to !== info.hourly.to)) saveHourly({ from, to });
	});

	// the stepper changed the speed: save it (and hear it)
	$effect(() => {
		if (info && speed !== info.speed) pick({ speed });
	});
</script>

{#if info}
	{#if !info.installed}
		<div class="a-muted">The voice needs the audio HAT, and it isn't there.</div>
	{:else}
		<div class="a-box">
			<Emoji code="1f570" size={26} alt="" shadow="none" />
			<span class="a-label">Clock on the hour</span>
			<button
				class="a-toggle pressable"
				class:on={info.hourly.enabled}
				disabled={admin.busy}
				onclick={() => saveHourly({ enabled: !info!.hourly.enabled })}
				aria-pressed={info.hourly.enabled}
			>
				{info.hourly.enabled ? 'ON' : 'OFF'}
			</button>
			<div class="a-spacer"></div>
			<span class="a-label">+ weather</span>
			<button
				class="a-toggle pressable"
				class:on={info.hourly.weather}
				disabled={admin.busy || !info.hourly.enabled}
				onclick={() => saveHourly({ weather: !info!.hourly.weather })}
				aria-pressed={info.hourly.weather}
			>
				{info.hourly.weather ? 'ON' : 'OFF'}
			</button>
			<button class="a-btn small pressable" disabled={admin.busy} onclick={sayNow}>Say it now</button>
		</div>
		<div class="a-box" class:off={!info.hourly.enabled}>
			<span class="a-label">From</span>
			<Stepper bind:value={from} min={0} max={23} format={hourName} label="first hour" disabled={!info.hourly.enabled} />
			<div class="a-spacer"></div>
			<span class="a-label">until</span>
			<Stepper bind:value={to} min={0} max={23} format={hourName} label="last hour" disabled={!info.hourly.enabled} />
		</div>
		{#if said}<div class="a-muted said">Said: “{said}”</div>{:else}<div class="a-muted">A soft chime, then the time. Never during bedtime quiet hours.</div>{/if}
		<div class="a-box">
			<span class="a-label">Talking speed</span>
			<Stepper bind:value={speed} choices={SPEEDS} format={speedLabel} label="talking speed" />
		</div>
		{#each [false, true] as funny (funny)}
			{@const list = info.voices.filter((v) => v.funny === funny)}
			{#if list.length}
				<div class="a-label group">{funny ? 'Funny voices' : 'Voices'}</div>
				<div class="voices">
					{#each list as v (v.id)}
						<button
							class="a-chip pressable"
							class:on={v.id === info.voice}
							disabled={admin.busy}
							onclick={() => pick({ voice: v.id })}
						>
							{#if FUNNY_EMOJI[v.id]}<Emoji code={FUNNY_EMOJI[v.id]} size={22} alt="" shadow="none" />{/if}
							{v.name}
						</button>
					{/each}
				</div>
			{/if}
		{/each}
		<div class="a-muted">
			Tap a voice to hear it; it is used from then on.
			{info.server
				? 'The voices come from the voice server (AI Helper). If it is off, Amy talks instead.'
				: 'Only Amy is here: set up a voice server in AI Helper for more voices, including funny ones.'}
		</div>
	{/if}
{/if}

<style>
	.off {
		opacity: 0.5;
	}
	.said {
		font-style: italic;
	}
	.group {
		margin-top: 8px;
	}
	.voices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.voices .a-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
</style>
