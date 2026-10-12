<script lang="ts">
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import { now } from '#lib/clock';
	import { pickDaily } from '#lib/utils/time';
	import { dinoEmoji, dietEmoji, dinoSize, type Dino } from '#lib/utils/dino';
	import facts from '#lib/data/facts.json';
	import dinos from '#lib/data/dinos.json';

	// Both rotate at midnight; the salt keeps them from lining up the same way every cycle.
	const dino = $derived(pickDaily(dinos as Dino[], $now));
	const fact = $derived(pickDaily(facts, $now, 7));

	const OUTLINE =
		'2.5px 0 0 rgba(51,65,85,0.85), -2.5px 0 0 rgba(51,65,85,0.85), 0 2.5px 0 rgba(51,65,85,0.85), 0 -2.5px 0 rgba(51,65,85,0.85), 4px 5px 0 rgba(51,65,85,0.3)';
</script>

<div class="fun-main">
	<div class="card dino-card">
		<!-- Left: dino of the day -->
		<div class="dino-left">
			<SectionTitle variant="white">Dino of the Day!</SectionTitle>
			{#key dino.name}
				<Emoji code={dinoEmoji(dino)} size={120} alt={dino.name} shadow={OUTLINE} class="anim-pop" />
			{/key}
			<div class="dino-name">{dino.name}</div>
			<div class="dino-say">say “{dino.say}”</div>
			<div class="chips">
				<span class="chip"><Emoji code={dietEmoji(dino)} size={18} alt="" shadow="none" /> eats {dino.diet}</span>
				<span class="chip"><Emoji code="1f4cf" size={18} alt="" shadow="none" /> {dino.lengthFt} ft</span>
			</div>
			<div class="dino-size">{dinoSize(dino.lengthFt)}</div>
		</div>

		<!-- Right: dino fact + fact of the day -->
		<div class="fact-col">
			<div class="fact-box dino-fact">
				<div class="fact-label">Dino Fact</div>
				<p class="fact-text">{dino.fact}</p>
			</div>
			<div class="fact-box">
				<div class="fact-label">Did you know?</div>
				<p class="fact-text">
					{fact.text}
					{#each fact.emoji as code, i (i)}
						<Emoji {code} size={26} alt="" />
					{/each}
				</p>
			</div>
		</div>
	</div>
</div>

<style>
	.fun-main {
		display: flex;
		flex: 1;
		min-height: 0;
		height: 100%;
	}

	.dino-card {
		flex: 1;
		background-color: #dcfce7;
		flex-direction: row;
		align-items: stretch;
		padding: 14px;
		gap: 16px;
	}

	.dino-left {
		flex: 0.85;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
	}
	.dino-name {
		font-size: 24px;
		font-weight: 900;
		text-align: center;
		line-height: 1.1;
		margin-top: 6px;
	}
	.dino-say {
		font-size: 14px;
		font-weight: 800;
		color: #475569;
		text-align: center;
	}
	.chips {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		padding: 2px 10px;
		font-size: 14px;
		font-weight: 900;
	}
	.dino-size {
		font-size: 14px;
		font-weight: 900;
		color: #166534;
		text-align: center;
	}

	.fact-col {
		flex: 1.15;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.fact-box {
		flex: 1;
		font-size: 18px;
		font-weight: 800;
		line-height: 1.4;
		padding: 12px 16px;
		background: var(--card-white);
		border-radius: 16px;
		border: 3px solid var(--border-dark);
		box-shadow: inset 0 4px 6px rgba(0, 0, 0, 0.05);
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.dino-fact {
		flex: 0.8;
		background: #fefce8;
	}
	.fact-label {
		font-size: 19px;
		font-weight: 900;
		color: #ef4444;
		margin-bottom: 4px;
	}
	.fact-text :global(img) {
		vertical-align: middle;
		margin-left: 4px;
	}
</style>
