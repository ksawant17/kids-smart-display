<script lang="ts">
	/**
	 * Updates: what's installed, what's new on GitHub, "Update now".
	 * The update runs on the Pi in the background (scripts/update.sh); this
	 * page follows its progress and reloads when the new version is running.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { version } from '$app/env';
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import type { UpdateInfo } from '#lib/utils/admin';
	import type { AdminSession } from '#lib/admin.svelte';

	let { admin }: { admin: AdminSession } = $props();

	let info = $state<UpdateInfo | null>(null);
	let checking = $state(false);
	let ask = $state(false);
	let following = $state(false);
	let timer: ReturnType<typeof setInterval> | null = null;

	async function check() {
		checking = true;
		await admin.attempt(async () => (info = await admin.api<UpdateInfo>('/api/admin/update?check=1')));
		checking = false;
		if (info?.running) follow();
	}
	onMount(check);
	onDestroy(() => timer && clearInterval(timer));

	const last = $derived(info?.log.at(-1) ?? '');
	const finished = $derived(last.startsWith('DONE') || last.startsWith('FAILED'));

	/** follow the log; once the new build answers, reload the page onto it */
	function follow() {
		following = true;
		timer ??= setInterval(async () => {
			try {
				const v = await fetch('/_app/version.json', { cache: 'no-store' }).then((r) => r.json());
				if (v.version !== version) location.reload();
			} catch {
				/* server restarting */
			}
			try {
				const res = await fetch('/api/admin/update');
				if (res.ok) info = await res.json();
			} catch {
				/* server restarting */
			}
			if (finished && !last.startsWith('DONE: updated')) {
				clearInterval(timer!);
				timer = null;
				following = false;
			}
		}, 2000);
	}

	async function start() {
		ask = false;
		if (await admin.attempt(() => admin.api('/api/admin/update', 'POST'))) follow();
	}
</script>

{#if !info}
	<div class="a-muted">{checking ? 'Checking GitHub for updates…' : ''}</div>
{:else}
	<SectionTitle>Installed</SectionTitle>
	<div class="a-row">
		<span class="a-big">{info.version}</span>
		<span class="a-muted">{info.date} · {info.subject}</span>
	</div>

	{#if following || info.running}
		<SectionTitle>Updating…</SectionTitle>
		<pre class="log">{info.log.join('\n') || 'starting…'}</pre>
		<div class="a-muted">The screen reloads by itself when the new version is running.</div>
	{:else}
		{#if info.log.length && finished}
			<div class="a-muted">Last update: {last}</div>
		{/if}
		{#if info.localChanges}
			<div class="a-setup">This copy has changes made by hand, so update it from a terminal (git pull, then npm run build).</div>
		{:else if info.behind === null}
			<div class="a-muted">Couldn't reach GitHub. Is the Wi-Fi working?</div>
		{:else if info.behind === 0}
			<div class="a-row a-label"><Emoji code="2705" size={26} alt="" shadow="none" /> Up to date</div>
		{:else}
			<SectionTitle>{info.behind} new change{info.behind === 1 ? '' : 's'}</SectionTitle>
			<ul class="waiting a-scroll">
				{#each info.waiting as w, i (i)}<li>{w}</li>{/each}
			</ul>
		{/if}
		<div class="a-spacer"></div>
		{#if ask}
			<div class="a-confirm anim-pop">
				Update now? It takes a few minutes; the dashboard keeps running meanwhile.
				<button class="a-btn small go pressable" onclick={start}>Yes</button>
				<button class="a-btn small pressable" onclick={() => (ask = false)}>No</button>
			</div>
		{:else}
			<div class="a-row">
				<button class="a-btn pressable" disabled={admin.busy || checking} onclick={check}>
					<Emoji code="1f50d" size={22} alt="" shadow="none" /> Check again
				</button>
				<button
					class="a-btn go pressable grow"
					disabled={admin.busy || checking || info.localChanges || !info.behind}
					onclick={() => (ask = true)}
				>
					<Emoji code="2728" size={22} alt="" shadow="none" /> Update now
				</button>
			</div>
		{/if}
	{/if}
{/if}

<style>
	.log {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		padding: 8px 10px;
		font: 700 12px ui-monospace, monospace;
		white-space: pre-wrap;
		color: #e2e8f0;
		background: #1e293b;
		border-radius: 10px;
	}
	.waiting {
		flex: 1;
		padding-left: 22px;
		font-size: 15px;
		font-weight: 800;
	}
	.grow {
		flex: 1;
	}
</style>
