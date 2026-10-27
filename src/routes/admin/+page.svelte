<script lang="ts">
	/**
	 * Grown-ups (admin) tab: opened from the pull-down quick menu, behind a
	 * 4-digit PIN. A grid of tiles, one per settings section
	 * (src/lib/components/admin/*Section.svelte). Leaving the page locks it
	 * again (and the kiosk's idle timer brings everyone back to TODAY).
	 */
	import { onDestroy, onMount, type Component } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import Keypad from '#lib/components/Keypad.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { AdminSession } from '#lib/admin.svelte';
	import MessagesSection from '#lib/components/admin/MessagesSection.svelte';
	import KidsSection from '#lib/components/admin/KidsSection.svelte';
	import PlaceSection from '#lib/components/admin/PlaceSection.svelte';
	import SchoolSection from '#lib/components/admin/SchoolSection.svelte';
	import WardrobeSection from '#lib/components/admin/WardrobeSection.svelte';
	import BedtimeSection from '#lib/components/admin/BedtimeSection.svelte';
	import ScreenSection from '#lib/components/admin/ScreenSection.svelte';
	import TimeSection from '#lib/components/admin/TimeSection.svelte';
	import WifiSection from '#lib/components/admin/WifiSection.svelte';
	import PowerSection from '#lib/components/admin/PowerSection.svelte';
	import UpdatesSection from '#lib/components/admin/UpdatesSection.svelte';
	import PinSection from '#lib/components/admin/PinSection.svelte';
	import ContentSection from '#lib/components/admin/ContentSection.svelte';
	import AiSection from '#lib/components/admin/AiSection.svelte';

	const admin = new AdminSession();

	const SECTIONS: { id: string; label: string; emoji: string; color: string; component: Component<{ admin: AdminSession }> }[] = [
		{ id: 'messages', label: 'Notes', emoji: '1f4e3', color: '#dcfce7', component: MessagesSection },
		{ id: 'content', label: 'New Content', emoji: '1f4e5', color: '#fef3c7', component: ContentSection },
		{ id: 'ai', label: 'AI Helper', emoji: '1f916', color: '#f3e8ff', component: AiSection },
		{ id: 'kids', label: 'Kids', emoji: '1f9d2', color: '#fce7f3', component: KidsSection },
		{ id: 'place', label: 'Weather Place', emoji: '1f4cd', color: '#e0f2fe', component: PlaceSection },
		{ id: 'school', label: 'School', emoji: '1f3eb', color: '#fee2e2', component: SchoolSection },
		{ id: 'wardrobe', label: 'What to Wear', emoji: '1f9e5', color: '#ede9fe', component: WardrobeSection },
		{ id: 'bedtime', label: 'Bedtime', emoji: '1f319', color: '#e0e7ff', component: BedtimeSection },
		{ id: 'screen', label: 'Screen', emoji: '1f4a1', color: '#fef9c3', component: ScreenSection },
		{ id: 'time', label: 'Date & Time', emoji: '1f552', color: '#e0f2fe', component: TimeSection },
		{ id: 'wifi', label: 'Wi-Fi', emoji: '1f4f6', color: '#ccfbf1', component: WifiSection },
		{ id: 'power', label: 'Power', emoji: '1f50c', color: '#ffedd5', component: PowerSection },
		{ id: 'updates', label: 'Updates', emoji: '2728', color: '#fae8ff', component: UpdatesSection },
		{ id: 'pin', label: 'PIN', emoji: '1f511', color: '#f1f5f9', component: PinSection }
	];

	let sectionId = $state<string | null>(null);
	const section = $derived(SECTIONS.find((s) => s.id === sectionId) ?? null);

	// notes float over the header for a few seconds
	$effect(() => {
		if (!admin.note) return;
		const t = setTimeout(() => (admin.note = null), admin.note.bad ? 8000 : 4000);
		return () => clearTimeout(t);
	});

	onMount(async () => {
		const s = await fetch('/api/admin/login')
			.then((r) => r.json())
			.catch(() => ({ pinSet: true, unlocked: false }));
		admin.pinSet = s.pinSet;
		if (s.unlocked) {
			admin.phase = 'open';
			admin.refresh();
		} else admin.phase = 'locked';
		// ?section=wifi opens a section straight away (handy from a phone)
		const want = new URL(location.href).searchParams.get('section');
		if (want && SECTIONS.some((s) => s.id === want)) sectionId = want;
	});

	// leaving the page (a tab, or the idle timer) locks it again
	onDestroy(() => {
		if (admin.phase === 'open') fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {});
	});

	function open(id: string | null) {
		sectionId = id;
		admin.note = null;
		// fresh numbers (clock, Wi-Fi, uptime...) whenever a section opens
		if (id) admin.refresh();
	}

	/* ------------------------------ PIN gate ------------------------------ */
	let pin = $state('');
	let firstPin = $state(''); // creating a PIN: typed once, then again to confirm
	let loginMsg = $state('');

	async function submitPin(value: string) {
		if (!admin.pinSet && !firstPin) {
			firstPin = value;
			pin = '';
			loginMsg = '';
			return;
		}
		if (!admin.pinSet && value !== firstPin) {
			firstPin = '';
			pin = '';
			loginMsg = "Those didn't match. Start again.";
			return;
		}
		admin.busy = true;
		try {
			const res = await fetch('/api/admin/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ pin: value })
			}).then((r) => r.json());
			pin = '';
			if (res.ok) {
				admin.pinSet = true;
				firstPin = '';
				loginMsg = '';
				admin.phase = 'open';
				admin.refresh();
			} else if (res.waitSeconds) {
				loginMsg = `Too many tries. Wait ${Math.ceil(res.waitSeconds / 60)} min.`;
			} else {
				loginMsg = `Wrong PIN${res.triesLeft ? ` (${res.triesLeft} tries left)` : ''}`;
			}
		} catch {
			loginMsg = "Can't reach the dashboard server";
		} finally {
			admin.busy = false;
		}
	}
</script>

<div class="admin">
	{#if admin.phase === 'loading'}
		<div class="card center"><div class="a-muted">Loading…</div></div>
	{:else if admin.phase === 'locked'}
		<div class="card gate anim-pop">
			<div class="gate-left">
				<Emoji code="1f512" size={64} alt="" />
				<SectionTitle big>Grown-ups only</SectionTitle>
				<div class="a-label">
					{#if !admin.pinSet}
						{firstPin ? 'Type the same PIN again' : 'Make up a 4-digit PIN'}
					{:else}
						Type the 4-digit PIN
					{/if}
				</div>
				<div class="dots" aria-label="{pin.length} of 4 digits">
					{#each [0, 1, 2, 3] as i (i)}
						<span class="dot" class:full={i < pin.length}></span>
					{/each}
				</div>
				<div class="gate-msg">{loginMsg}</div>
			</div>
			<Keypad bind:value={pin} length={4} disabled={admin.busy} okLabel={admin.pinSet ? 'Open' : 'OK'} onok={submitPin} />
		</div>
	{:else if admin.phase === 'bye'}
		<div class="bye">
			<Emoji code="1f44b" size={90} alt="" />
			<div>{admin.bye}</div>
		</div>
	{:else if !section}
		<div class="tiles anim-pop">
			{#each SECTIONS as s (s.id)}
				<button class="tile pressable" style="background:{s.color}" onclick={() => open(s.id)}>
					<Emoji code={s.emoji} size={40} alt="" />
					<span>{s.label}</span>
					{#if s.id === 'content' && admin.status?.contentPending}
						<b class="badge">{admin.status.contentPending}</b>
					{/if}
				</button>
			{/each}
			<button class="tile lock pressable" onclick={() => admin.lock()}>
				<Emoji code="1f512" size={40} alt="" />
				<span>Lock</span>
			</button>
		</div>
	{:else}
		<button class="back pressable" onclick={() => open(null)} aria-label="Back to all settings">
			<Emoji code="2b05" size={30} alt="" shadow="none" />
			<span>Back</span>
		</button>
		<section class="card panel" aria-label={section.label}>
			{#if admin.status}
				{@const Section = section.component}
				{#key section.id}
					<Section {admin} />
				{/key}
			{:else}
				<div class="center a-muted">{admin.busy ? 'Loading…' : ''}</div>
			{/if}
		</section>
	{/if}
	{#if admin.note}
		<div class="note anim-pop" class:bad={admin.note.bad} role="status">{admin.note.text}</div>
	{/if}
</div>

<style>
	.admin {
		display: flex;
		gap: 10px;
		height: 100%;
		min-height: 0;
		padding-bottom: 8px;
	}
	.center {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* ---- PIN gate ---- */
	.gate {
		flex: 1;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 50px;
		background: #fef9c3;
	}
	.gate-left {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		width: 260px;
	}
	.gate-msg {
		min-height: 22px;
		font-size: 16px;
		font-weight: 900;
		color: #dc2626;
		text-align: center;
	}
	.dots {
		display: flex;
		gap: 14px;
		margin: 4px 0;
	}
	.dot {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 3px solid var(--border-dark);
		background: var(--card-white);
	}
	.dot.full {
		background: var(--tab-orange);
	}

	/* ---- home: one tile per section ---- */
	.tiles {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 9px;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font: 900 16px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		border: 3px solid var(--border-dark);
		border-radius: 16px;
		box-shadow: var(--sticker-shadow-sm);
		min-height: 0;
		white-space: nowrap;
	}
	.tile {
		position: relative;
	}
	.badge {
		position: absolute;
		top: 6px;
		right: 8px;
		min-width: 28px;
		padding: 2px 7px;
		font-size: 15px;
		color: #fff;
		background: var(--tab-red);
		border: 2px solid var(--border-dark);
		border-radius: 999px;
	}
	.tile.lock {
		background: #e5e7eb;
	}

	/* ---- a section: back rail + panel ---- */
	.back {
		flex: 0 0 64px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		font: 900 14px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 16px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.panel {
		flex: 1;
		min-width: 0;
		gap: 8px;
		padding: 10px 16px 12px;
		overflow-y: auto;
		touch-action: pan-y;
	}
	.panel :global(.section-title) {
		align-self: flex-start;
		margin: 0 0 2px;
	}

	.note {
		position: fixed;
		top: 8px;
		left: 50%;
		translate: -50% 0;
		z-index: 47;
		max-width: 640px;
		padding: 8px 18px;
		font-size: 18px;
		font-weight: 900;
		background: #dcfce7;
		border: 3px solid var(--border-dark);
		border-radius: 14px;
		box-shadow: var(--sticker-shadow);
	}
	.note.bad {
		background: #fee2e2;
	}

	.bye {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 20px;
		padding: 40px;
		text-align: center;
		font-size: 30px;
		font-weight: 900;
		color: #fff;
		background: #1e293b;
	}
</style>
