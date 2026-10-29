<script lang="ts">
	/**
	 * 🔊 Read me: says `text` through the audio HAT's speakers (POST /api/speak,
	 * which only reads text the dashboard wrote itself). Tap again to stop.
	 * Only shown when the voice is installed and switched on. `round`: just the
	 * 🔊 sign in a circle (the label is still there for screen readers).
	 */
	import Emoji from '#lib/components/Emoji.svelte';

	let {
		text,
		label = 'Read me',
		round = false,
		talking = $bindable(false)
	}: { text: string; label?: string; round?: boolean; talking?: boolean } = $props();

	let ticket = 0; // a reply to an older tap must not reset a newer one

	async function speak(e: Event) {
		e.stopPropagation(); // the idle screen / bubble behind closes on a tap
		const mine = ++ticket;
		if (talking) {
			talking = false;
			fetch('/api/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"stop":true}' });
			return;
		}
		talking = true;
		try {
			await fetch('/api/speak', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text })
			});
		} catch {
			/* nothing to say: the button just goes back */
		}
		if (mine === ticket) talking = false;
	}
</script>

<button
	class="read pressable"
	class:talking
	class:round
	onclick={speak}
	aria-pressed={talking}
	aria-label={round ? (talking ? 'Stop' : label) : undefined}
>
	<span class="icon"><Emoji code={talking ? '23f9' : '1f50a'} size={round ? 34 : 30} alt="" shadow="none" /></span>
	{#if !round}{talking ? 'Stop' : label}{/if}
</button>

<style>
	.read {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 54px;
		padding: 0 20px 0 12px;
		font: 900 21px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		white-space: nowrap;
		background: #fde68a;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		cursor: pointer;
	}
	.read.round {
		width: 64px;
		height: 64px;
		padding: 0;
		justify-content: center;
	}
	.read.talking {
		background: #fecaca;
	}
	.talking .icon {
		animation: pulse 1s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			transform: scale(1.15);
		}
	}
</style>
