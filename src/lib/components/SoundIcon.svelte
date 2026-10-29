<script lang="ts">
	/**
	 * Bold, dark speaker / stop / mic icons for the round sound buttons (the
	 * emoji versions are light grey and vanish on the pale button colours).
	 */
	let { kind, size = 30 }: { kind: 'speaker' | 'stop' | 'mic'; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
	{#if kind === 'speaker'}
		<path d="M3 9.5h3.5L11.5 5v14l-5-4.5H3z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
		<path d="M15 9a4 4 0 0 1 0 6M17.8 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
	{:else if kind === 'stop'}
		<rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor" />
	{:else}
		<rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor" />
		<path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		color: var(--text-dark);
	}
</style>
