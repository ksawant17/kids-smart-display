<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { now } from '#lib/clock';
	import { pickDaily } from '#lib/utils/time';
	import quotes from '#lib/data/quotes.json';

	// rotates at midnight (same pick as the TODAY tab)
	const quote = $derived(pickDaily(quotes, $now));
	const size = $derived(quote.text.length < 60 ? 'big' : quote.text.length < 100 ? 'mid' : 'small');
</script>

<div class="quote-main">
	<div class="card quote-card anim-pop">
		<SectionTitle variant="white" big>Message of the Day</SectionTitle>
		{#key quote.text}
			<div class="quote-text {size} anim-pop">“{quote.text}”</div>
		{/key}
		<div class="quote-author">
			– {quote.author}
			<Emoji code={quote.emoji} size={28} alt="" />
		</div>
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
		background-color: #fef9c3;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 30px;
	}
	.quote-text {
		font-size: 30px;
		font-weight: 900;
		font-style: italic;
		line-height: 1.4;
		color: #334155;
		margin-top: 20px;
		max-width: 92%;
	}
	.quote-text.big {
		font-size: 36px;
	}
	.quote-text.small {
		font-size: 25px;
		line-height: 1.35;
	}
	.quote-author {
		font-size: 22px;
		font-weight: 900;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-top: 24px;
		color: #475569;
	}
</style>
