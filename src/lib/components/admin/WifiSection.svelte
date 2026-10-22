<script lang="ts">
	/** Wi-Fi: nearby networks; tap one to join (password typed on screen). */
	import { onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import SetupNote from './SetupNote.svelte';
	import TextSheet from './TextSheet.svelte';
	import { signalBars, type WifiNetwork } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();
	const allowed = $derived(admin.status!.permissions.wifi);

	let nets = $state<WifiNetwork[] | null>(null);
	let joining = $state<WifiNetwork | null>(null);
	let askPassword = $state(false);

	const scan = (rescan = false) =>
		admin.attempt(async () => (nets = await admin.api<WifiNetwork[]>(`/api/admin/wifi${rescan ? '?rescan=1' : ''}`)));
	onMount(() => scan());

	function pick(n: WifiNetwork) {
		if (n.inUse || !allowed) return;
		joining = n;
		if (n.secure) askPassword = true;
		else join();
	}

	async function join(password?: string) {
		askPassword = false;
		const net = joining;
		if (!net) return;
		admin.say(`Joining ${net.ssid}… (up to 30 seconds)`);
		const ok = await admin.attempt(async () => {
			nets = await admin.api<WifiNetwork[]>('/api/admin/wifi', 'POST', { ssid: net.ssid, password });
		});
		joining = null;
		if (ok) {
			admin.say(`Connected to ${net.ssid}`);
			admin.refresh();
		}
	}
</script>

<div class="a-row">
	<span class="a-label">Wi-Fi networks</span>
	<span class="a-muted">Tap one to join it.</span>
	<div class="a-spacer"></div>
	<button class="a-btn small pressable" disabled={admin.busy} onclick={() => scan(true)}>
		<Emoji code="1f50d" size={20} alt="" shadow="none" /> Look again
	</button>
</div>
{#if !allowed}<SetupNote />{/if}
<div class="nets a-scroll">
	{#if nets === null}
		<div class="a-muted">Looking for networks…</div>
	{:else}
		{#each nets as n (n.ssid)}
			<button class="net pressable" class:on={n.inUse} disabled={admin.busy || (!allowed && !n.inUse)} onclick={() => pick(n)}>
				<span class="bars" aria-label="signal {n.signal}%">
					{#each [1, 2, 3, 4] as b (b)}
						<i class:lit={b <= signalBars(n.signal)} style="height:{b * 5 + 3}px"></i>
					{/each}
				</span>
				<span class="ssid">{n.ssid}</span>
				{#if n.secure}<Emoji code="1f512" size={18} alt="needs a password" shadow="none" />{/if}
				{#if n.inUse}<span class="tag">Connected</span>{/if}
				{#if joining?.ssid === n.ssid}<span class="tag">Joining…</span>{/if}
			</button>
		{:else}
			<div class="a-muted">No networks found. Try "Look again".</div>
		{/each}
	{/if}
</div>
<div class="a-muted">On a phone? Switching networks cuts your connection to this page.</div>

{#if askPassword && joining}
	<TextSheet
		title="Password for {joining.ssid}"
		maxLength={63}
		minLength={8}
		saveLabel="Join"
		onsave={(p) => join(p)}
		oncancel={() => ((askPassword = false), (joining = null))}
	/>
{/if}

<style>
	.nets {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.net {
		flex: 0 0 auto;
		height: 46px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 12px;
		font: 900 17px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		text-align: left;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
	}
	.net.on {
		background: #dcfce7;
	}
	.net:disabled {
		opacity: 0.55;
	}
	.ssid {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 24px;
	}
	.bars i {
		width: 5px;
		border-radius: 1px;
		background: #cbd5e1;
	}
	.bars i.lit {
		background: var(--border-dark);
	}
	.tag {
		font-size: 13px;
		padding: 2px 8px;
		background: var(--tab-green);
		border: 2px solid var(--border-dark);
		border-radius: 999px;
	}
</style>
