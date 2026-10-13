<script lang="ts">
	/**
	 * Power menu, opened by holding the top button: screen off, restart or
	 * power off the Pi. Big buttons, closes by itself after 20 seconds (or with
	 * a tap on the button). No PIN: holding the button means being right here.
	 */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';

	let { onclose, onscreenoff }: { onclose: () => void; onscreenoff: () => void } = $props();

	let bye = $state('');
	let problem = $state('');
	let busy = $state(false);

	onMount(() => {
		const t = setTimeout(() => !bye && onclose(), 20_000);
		return () => clearTimeout(t);
	});

	async function power(action: 'reboot' | 'poweroff') {
		busy = true;
		problem = '';
		try {
			const res = await fetch('/api/button/power', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action })
			});
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? `HTTP ${res.status}`);
			bye =
				action === 'reboot'
					? 'Restarting… back in about a minute.'
					: 'Turning off… When the green light stops blinking, it is safe to unplug.';
		} catch (e) {
			problem = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<div class="menu" role="dialog" aria-modal="true" aria-label="Power menu">
	{#if bye}
		<Emoji code="1f44b" size={90} alt="" />
		<div class="bye">{bye}</div>
	{:else}
		<div class="title">Power</div>
		<div class="buttons">
			<button class="big off pressable" disabled={busy} onclick={onscreenoff}>
				<Emoji code="1f634" size={48} alt="" shadow="none" />
				Screen Off
			</button>
			<button class="big restart pressable" disabled={busy} onclick={() => power('reboot')}>
				<Emoji code="1f501" size={48} alt="" shadow="none" />
				Restart
			</button>
			<button class="big poweroff pressable" disabled={busy} onclick={() => power('poweroff')}>
				<Emoji code="1f4f4" size={48} alt="" shadow="none" />
				Power Off
			</button>
		</div>
		{#if problem}<div class="problem">{problem}</div>{/if}
		<button class="cancel pressable" onclick={onclose}>Cancel</button>
	{/if}
</div>

<style>
	.menu {
		position: absolute;
		inset: 0;
		z-index: 48;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 18px;
		padding: 24px;
		background: rgba(15, 23, 42, 0.92);
		color: #fff;
		animation: pop-in 0.25s ease-out both;
	}
	.title {
		font-size: 30px;
		font-weight: 900;
	}
	.buttons {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		width: 100%;
		max-width: 700px;
	}
	.big {
		height: 150px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		font: 900 22px 'Nunito', sans-serif;
		color: var(--text-dark);
		border: 3px solid var(--border-dark);
		border-radius: 20px;
		box-shadow: var(--sticker-shadow);
	}
	.big.off {
		background: #c7d2fe;
	}
	.big.restart {
		background: var(--yellow-banner);
	}
	.big.poweroff {
		background: var(--tab-red);
	}
	.big:disabled {
		opacity: 0.5;
	}
	.cancel {
		height: 50px;
		padding: 0 40px;
		font: 900 19px 'Nunito', sans-serif;
		color: var(--text-dark);
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 14px;
	}
	.problem {
		font-size: 16px;
		font-weight: 800;
		color: #fecaca;
		text-align: center;
	}
	.bye {
		font-size: 28px;
		font-weight: 900;
		text-align: center;
		max-width: 600px;
	}
</style>
