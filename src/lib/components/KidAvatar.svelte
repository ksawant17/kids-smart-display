<script lang="ts">
	/** A kid's picture: their animal buddy in the given outfit, or a plain emoji avatar. */
	import Buddy from '#lib/components/Buddy.svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import { isBuddy } from '#lib/buddies';
	import type { Kid } from '#lib/config';
	import { now } from '#lib/clock';
	import { themeFor } from '#lib/themes';
	import { place } from '#lib/place';

	let { kid, items = [], size = 140 }: { kid: Kid; items?: string[]; size?: number } = $props();

	// seasonal hat: witch hats in October, pom-poms in winter...
	const hat = $derived(themeFor($now, $place)?.hat ?? null);
</script>

{#if isBuddy(kid.avatar)}
	<Buddy kind={kid.avatar} {items} color={kid.color} {size} label={kid.name} {hat} />
{:else}
	<Emoji code={kid.avatar} size={Math.round(size * 0.75)} alt={kid.name} />
{/if}
