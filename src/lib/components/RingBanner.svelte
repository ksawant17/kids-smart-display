<script lang="ts">
	/**
	 * A timer, reminder or wake-up alarm going off: big and over everything,
	 * with Stop and 5 more minutes. (The tune and the words come from the server, which
	 * also stops them when the top button is tapped.)
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import { reminderAction } from '#lib/reminders';
	import { ringText, type Reminder } from '#lib/utils/reminders';

	let { reminder }: { reminder: Reminder } = $props();
	const alarm = $derived(reminder.kind === 'alarm');
	const icon = $derived(alarm ? '1f305' : reminder.kind === 'timer' ? '23f0' : '1f514');
</script>

<div class="scrim">
	<div class="sheet card anim-pop" class:alarm role="alertdialog" aria-modal="true" aria-label={ringText(reminder)}>
		<div class="big" class:ringing={!alarm} class:rising={alarm}>
			<Emoji code={icon} size={110} alt="" />
		</div>
		<div class="title">{alarm ? 'Good morning!' : ringText(reminder)}</div>
		{#if alarm}<div class="sub">{reminder.label || 'Time to wake up!'}</div>{/if}
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
	.sheet.alarm {
		background: linear-gradient(#fde68a, #fdba74);
	}
	.rising {
		animation: rise 2.4s ease-in-out infinite;
	}
	@keyframes rise {
		50% {
			transform: translateY(-8px) scale(1.06);
		}
	}
	.sub {
		margin-top: -6px;
		font-size: 24px;
		font-weight: 800;
		color: #7c2d12;
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
