<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { now } from '#lib/clock';
	import { dayNumber, pickDaily } from '#lib/utils/time';
	import quotes from '#lib/data/quotes.json';

	let { data } = $props();

	// rotates at midnight (same pick as the TODAY tab): built-in quotes plus
	// the ones a grown-up kept (Grown-ups tab -> New Content)
	const quote = $derived<{ text: string; author: string; emoji: string; source?: string }>(
		pickDaily([...quotes, ...data.content.quotes], $now)
	);
	// a kid's buddy presents it, taking turns day by day
	const buddy = $derived(data.kids.length ? data.kids[dayNumber($now) % data.kids.length] : null);
	const size = $derived(quote.text.length < 60 ? 'big' : quote.text.length < 100 ? 'mid' : 'small');
</script>

<div class="quote-main">
	<div class="card quote-card anim-pop">
		{#if buddy}
			<div class="buddy">
				<KidAvatar kid={buddy} size={200} />
			</div>
		{/if}
		<div class="quote-body">
			<SectionTitle variant="white" big>Quote of the Day</SectionTitle>
			{#key quote.text}
				<div class="quote-text {size} anim-pop">“{quote.text}”</div>
			{/key}
			<div class="quote-author">
				– {quote.author}
				<Emoji code={quote.emoji} size={32} alt="" />
			</div>
		</div>
		{#if quote.source === 'zenquotes'}
			<!-- ZenQuotes' free API asks for a credit -->
			<div class="credit">Quote from zenquotes.io</div>
		{/if}
	</div>
</div>

<style>
	.quote-main {
		display: flex;
		flex: 1;
		min-height: 0;
		padding-bottom: 8px;
		height: 100%;
	}
	.quote-card {
		flex: 1;
		flex-direction: row;
		background-color: #fef9c3;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 20px 26px 20px 16px;
	}
	/* the buddy bobs gently beside the quote */
	.buddy {
		flex: 0 0 200px;
		display: flex;
		justify-content: center;
		animation: float 4s ease-in-out infinite;
		will-change: transform;
	}
	.quote-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}
	.quote-text {
		font-size: 34px;
		font-weight: 900;
		font-style: italic;
		line-height: 1.35;
		color: #334155;
		margin-top: 18px;
	}
	.quote-text.big {
		font-size: 40px;
	}
	.quote-text.small {
		font-size: 28px;
		line-height: 1.3;
	}
	.credit {
		position: absolute;
		bottom: 8px;
		right: 14px;
		font-size: 12px;
		font-weight: 800;
		color: #94a3b8;
	}
	.quote-author {
		font-size: 22px;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-top: 20px;
		color: #475569;
	}
</style>
