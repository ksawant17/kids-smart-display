<script lang="ts">
	let {
		children,
		variant = 'yellow',
		big = false
	}: {
		children: import('svelte').Snippet;
		variant?: 'yellow' | 'white';
		big?: boolean;
	} = $props();
</script>

<div class="section-title {variant} {big ? 'big' : ''}">
	{@render children()}
</div>

<style>
	.big {
		font-size: 22px;
		padding: 6px 20px;
	}
</style>
