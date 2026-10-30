<script lang="ts">
	/**
	 * A timer or reminder going off: big and over everything, with Stop and
	 * 5 more minutes. (The tune and the words come from the server, which
	 * also stops them when the top button is tapped.)
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import { reminderAction } from '#lib/reminders';
	import { ringText, type Reminder } from '#lib/utils/reminders';

	let { reminder }: { reminder: Reminder } = $props();
</script>

<div class="scrim">
	<div class="sheet card anim-pop" role="alertdialog" aria-modal="true" aria-label={ringText(reminder)}>
		<div class="big ringing">
			<Emoji code={reminder.kind === 'timer' ? '23f0' : '1f514'} size={110} alt="" />
		</div>
		<div class="title">{ringText(reminder)}</div>
		<div class="row">
			<button class="btn stop pressable" onclick={() => reminderAction('stop', reminder.id)}>
				<Emoji code="270b" size={30} alt="" shadow="none" /> Stop
			</button>
			<button class="btn pressable" onclick={() => reminderAction('snooze', reminder.id)}>
				<Emoji code="1f634" size={30} alt="" shadow="none" /> 5 more minutes
			</button>
		</div>
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 49;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.55);
	}
	.sheet {
		width: 640px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 26px 28px;
		background: #fef3c7;
		font-family: 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
	}
	.big {
		display: flex;
	}
	.ringing {
		animation: ring 0.9s ease-in-out infinite;
	}
	@keyframes ring {
		0%,
		60%,
		100% {
			transform: rotate(0);
		}
		10%,
		30%,
		50% {
			transform: rotate(-14deg);
		}
		20%,
		40% {
			transform: rotate(14deg);
		}
	}
	.title {
		font-size: 36px;
		font-weight: 900;
		text-align: center;
		line-height: 1.2;
	}
	.row {
		display: flex;
		gap: 16px;
		margin-top: 4px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		height: 68px;
		padding: 0 26px;
		font: 900 25px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		white-space: nowrap;
		background: #e5e7eb;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.stop {
		background: #fca5a5;
	}
</style>
