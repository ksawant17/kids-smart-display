<script lang="ts">
	/**
	 * 🎤 hold to talk: pressing opens the Ask sheet (or, inside it, asks
	 * again) and the kid talks while holding; letting go ends the question.
	 * The let-go is watched on the whole window, since the sheet opens on top
	 * of the button while the finger is still down.
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import { askOpen, micHeld } from '#lib/screen';

	let {
		look = 'round',
		label = '',
		onpress = () => askOpen.set(true)
	}: {
		/** round: just the 🎤 (header: small); pill: 🎤 and a label (in the sheet) */
		look?: 'small' | 'round' | 'pill';
		label?: string;
		onpress?: () => void;
	} = $props();

	function press(e: PointerEvent) {
		e.preventDefault(); // no long-press menu or text selection
		e.stopPropagation(); // the idle screen behind closes on a tap
		micHeld.set(Date.now());
		const letGo = () => {
			micHeld.set(0);
			removeEventListener('pointerup', letGo);
			removeEventListener('pointercancel', letGo);
		};
		addEventListener('pointerup', letGo);
		addEventListener('pointercancel', letGo);
		onpress();
	}
</script>

<button
	class="mic pressable {look}"
	aria-label={label || 'Hold to ask a question'}
	onpointerdown={press}
	onclick={(e) => e.stopPropagation()}
	oncontextmenu={(e) => e.preventDefault()}
>
	<Emoji code="1f3a4" size={look === 'small' ? 26 : look === 'round' ? 34 : 26} alt="" shadow="none" />
	{#if look === 'pill' && label}{label}{/if}
</button>

<style>
	.mic {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0;
		font: 900 21px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		text-shadow: none;
		white-space: nowrap;
		background: #a5f3fc;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
		cursor: pointer;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.small {
		width: 42px;
		height: 42px;
		margin-right: 10px;
		box-shadow: 3px 3px 0 var(--border-dark);
	}
	.round {
		width: 64px;
		height: 64px;
	}
	.pill {
		height: 54px;
		padding: 0 20px 0 12px;
	}
</style>
