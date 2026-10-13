<script lang="ts">
	/** The Pi: health numbers, reload the screen, restart, power off. */
	import Emoji from '#lib/components/Emoji.svelte';
	import SetupNote from './SetupNote.svelte';
	import { uptimeLabel } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const status = $derived(admin.status!);
	const sys = $derived(status.system);

	let ask = $state<'reboot' | 'poweroff' | null>(null);

	async function go(action: 'reboot' | 'poweroff') {
		ask = null;
		if (await admin.attempt(() => admin.api('/api/admin/power', 'POST', { action }))) {
			admin.goodbye(
				action === 'reboot'
					? 'Restarting… the dashboard is back in about a minute.'
					: 'Turning off… When the green light stops blinking, it is safe to unplug.'
			);
		}
	}
</script>

<div class="facts">
	<div><span class="a-muted">Wi-Fi</span>{sys.wifi ?? '—'}</div>
	<div><span class="a-muted">Address</span>{sys.ip[0] ?? '—'}</div>
	<div><span class="a-muted">On for</span>{uptimeLabel(sys.uptimeSeconds)}</div>
	<div><span class="a-muted">Temperature</span>{sys.tempC === null ? '—' : `${sys.tempC} °C`}</div>
	<div><span class="a-muted">Free space</span>{sys.diskFreeGb === null ? '—' : `${sys.diskFreeGb} GB`}</div>
	<div><span class="a-muted">Name</span>{sys.hostname}</div>
</div>
{#if !status.permissions.power}<SetupNote />{/if}
<div class="a-spacer"></div>
{#if ask}
	<div class="a-confirm anim-pop">
		{ask === 'reboot' ? 'Restart the Pi now?' : 'Power off the Pi now?'}
		<button class="a-btn small {ask === 'poweroff' ? 'danger' : 'go'} pressable" onclick={() => go(ask!)}>Yes</button>
		<button class="a-btn small pressable" onclick={() => (ask = null)}>No</button>
	</div>
{:else}
	<div class="buttons">
		<button class="a-btn pressable" onclick={() => location.reload()}>
			<Emoji code="1f504" size={26} alt="" shadow="none" /> Reload
		</button>
		<button class="a-btn pressable" disabled={admin.busy || !status.permissions.power} onclick={() => (ask = 'reboot')}>
			<Emoji code="1f501" size={26} alt="" shadow="none" /> Restart Pi
		</button>
		<button class="a-btn danger pressable" disabled={admin.busy || !status.permissions.power} onclick={() => (ask = 'poweroff')}>
			<Emoji code="1f4f4" size={26} alt="" shadow="none" /> Power Off
		</button>
	</div>
{/if}

<style>
	.facts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px 16px;
		font-size: 17px;
		font-weight: 900;
	}
	.facts div {
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.facts .a-muted {
		font-size: 13px;
	}
	.buttons {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}
</style>
