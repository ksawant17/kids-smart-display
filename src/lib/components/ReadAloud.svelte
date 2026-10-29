<script lang="ts">
	/**
	 * 🔊 Read me: says `text` through the audio HAT's speakers (POST /api/speak,
	 * which only reads text the dashboard wrote itself). Tap again to stop.
	 * Only shown when the voice is installed and switched on.
	 */
	import Emoji from '#lib/components/Emoji.svelte';

	let {
		text,
		label = 'Read me',
		talking = $bindable(false)
	}: { text: string; label?: string; talking?: boolean } = $props();

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

<button class="read pressable" class:talking onclick={speak} aria-pressed={talking}>
	<span class="icon"><Emoji code={talking ? '23f9' : '1f50a'} size={30} alt="" shadow="none" /></span>
	{talking ? 'Stop' : label}
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
