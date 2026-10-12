<script lang="ts">
	import { page } from '$app/state';
	import Emoji from '#lib/components/Emoji.svelte';

	const tabs = [
		{ path: '/', label: 'TODAY', emoji: '1f60e', cls: 'tab-today' },
		{ path: '/calendar', label: 'CALENDAR', emoji: '1f5d3', cls: 'tab-calendar' },
		{ path: '/quote', label: 'QUOTE', emoji: '1f3c6', cls: 'tab-quote' },
		{ path: '/wardrobe', label: 'WARDROBE', emoji: '1f9e5', cls: 'tab-wardrobe' },
		{ path: '/fun', label: 'FUN', emoji: '1f996', cls: 'tab-fun' }
	];

	const current = $derived(page.url.pathname);
	const isActive = (path: string) => current === path;
</script>

<nav class="tabs" aria-label="Main tabs">
	{#each tabs as tab (tab.path)}
		<a
			href={tab.path}
			class="tab {tab.cls} {isActive(tab.path) ? 'active' : ''}"
			aria-current={isActive(tab.path) ? 'page' : undefined}
		>
			<Emoji code={tab.emoji} size={30} alt={tab.label} shadow="none" />
			<span>{tab.label}</span>
		</a>
	{/each}
</nav>
