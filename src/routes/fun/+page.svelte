<script lang="ts">
	/**
	 * FUN: five little corners, each with a daily pick and an "another!" button.
	 *   Dino · Joke (tap to reveal) · Word of the day · Math (tap to check) · Facts
	 * Everything resets to the daily pick when the tab is opened again.
	 */
	import Emoji from '#lib/components/Emoji.svelte';
	import SectionTitle from '#lib/components/SectionTitle.svelte';
	import KidAvatar from '#lib/components/KidAvatar.svelte';
	import { now } from '#lib/clock';
	import { dayNumber } from '#lib/utils/time';
	import { dinoEmoji, dietEmoji, dinoSize, type Dino } from '#lib/utils/dino';
	import { mathPuzzle, type MathLevel } from '#lib/utils/mathPuzzle';
	import facts from '#lib/data/facts.json';
	import dinos from '#lib/data/dinos.json';
	import jokes from '#lib/data/jokes.json';
	import words from '#lib/data/words.json';

	let { data } = $props();

	type Corner = 'dino' | 'joke' | 'word' | 'math' | 'fact';
	const CORNERS: { id: Corner; label: string; emoji: string }[] = [
		{ id: 'dino', label: 'Dino', emoji: '1f996' },
		{ id: 'joke', label: 'Joke', emoji: '1f602' },
		{ id: 'word', label: 'Word', emoji: '1f524' },
		{ id: 'math', label: 'Math', emoji: '2795' },
		{ id: 'fact', label: 'Facts', emoji: '1f4a1' }
	];
	let corner = $state<Corner>('dino');

	// today's pick + how many times "another!" was pressed, per corner
	const day = $derived(dayNumber($now));
	let extra = $state({ dino: 0, joke: 0, word: 0, math: 0, fact: 0 });
	const pick = <T,>(list: T[], salt: number, n: number) => list[(day + salt + n) % list.length];
	function another(c: Corner) {
		extra = { ...extra, [c]: extra[c] + 1 };
		revealed = false;
		answered = null;
	}

	const dino = $derived(pick(dinos as Dino[], 0, extra.dino));
	// built-in jokes + the ones a grown-up kept (Grown-ups tab -> New Content)
	const joke = $derived(pick([...jokes, ...data.content.jokes], 3, extra.joke));
	const word = $derived(pick(words, 11, extra.word));
	// built-in facts + the ones a grown-up kept (Grown-ups tab -> New Content)
	const fact = $derived(pick([...facts, ...data.content.facts], 7, extra.fact));

	// joke: the punchline waits for a tap; a kid's buddy tells it
	let revealed = $state(false);
	const teller = $derived(data.kids[(day + extra.joke) % data.kids.length]);

	// math: easy / tricky, tap an answer to check it
	let level = $state<MathLevel>('easy');
	let answered = $state<number | null>(null);
	const puzzle = $derived(mathPuzzle(day * 10 + extra.math, level));
	const solved = $derived(answered === puzzle.answer);

	const OUTLINE =
		'2.5px 0 0 rgba(51,65,85,0.85), -2.5px 0 0 rgba(51,65,85,0.85), 0 2.5px 0 rgba(51,65,85,0.85), 0 -2.5px 0 rgba(51,65,85,0.85), 4px 5px 0 rgba(51,65,85,0.3)';
</script>

<div class="fun-main">
	<div class="card fun-card corner-{corner}">
		<div class="corners" role="tablist" aria-label="Fun corners">
			{#each CORNERS as c (c.id)}
				<button
					class="corner-pill pressable"
					class:on={corner === c.id}
					role="tab"
					aria-selected={corner === c.id}
					onclick={() => {
						corner = c.id;
						revealed = false;
						answered = null;
					}}
				>
					<Emoji code={c.emoji} size={22} alt="" shadow="none" />
					{c.label}
				</button>
			{/each}
		</div>

		<div class="panel">
			{#if corner === 'dino'}
				<div class="dino-left">
					<SectionTitle variant="white">Dino of the Day!</SectionTitle>
					{#key dino.name}
						<Emoji code={dinoEmoji(dino)} size={118} alt={dino.name} shadow={OUTLINE} class="anim-pop" />
					{/key}
					<div class="dino-name">{dino.name}</div>
					<div class="dino-say">say “{dino.say}”</div>
				</div>
				<div class="side">
					<div class="chips">
						<span class="chip"><Emoji code={dietEmoji(dino)} size={18} alt="" shadow="none" /> eats {dino.diet}</span>
						<span class="chip"><Emoji code="1f4cf" size={18} alt="" shadow="none" /> {dino.lengthFt} ft</span>
						<span class="chip"><Emoji code="23f3" size={18} alt="" shadow="none" /> {dino.period}</span>
					</div>
					<div class="dino-size">{dinoSize(dino.lengthFt)}</div>
					<div class="bubble-box">
						<div class="box-label">Dino Fact</div>
						<p class="box-text">{dino.fact}</p>
					</div>
					<button class="another pressable" onclick={() => another('dino')}>Another dino! <Emoji code="27a1" size={18} alt="" shadow="none" /></button>
				</div>
			{:else if corner === 'joke'}
				<!-- the buddy cracks up when the punchline lands -->
				<div class="teller" class:laugh={revealed}>
					<KidAvatar kid={teller} size={160} />
					{#if revealed}<span class="haha anim-pop"><Emoji code="1f602" size={40} alt="" /></span>{/if}
				</div>
				<div class="side">
					<div class="bubble-box joke-q">
						<div class="box-label">{teller.name} asks:</div>
						<p class="box-text big">{joke.q}</p>
					</div>
					{#if revealed}
						<div class="bubble-box joke-a anim-pop">
							<p class="box-text big"><Emoji code={joke.emoji} size={30} alt="" /> {joke.a}</p>
						</div>
						<button class="another pressable" onclick={() => another('joke')}>Another joke! <Emoji code="1f602" size={18} alt="" shadow="none" /></button>
					{:else}
						<button class="reveal pressable" onclick={() => (revealed = true)}>
							<Emoji code="1f914" size={26} alt="" shadow="none" /> Tell me!
						</button>
					{/if}
				</div>
			{:else if corner === 'word'}
				<div class="word-left">
					<SectionTitle variant="white">Word of the Day</SectionTitle>
					{#key word.word}
						<Emoji code={word.emoji} size={100} alt="" class="anim-pop" />
					{/key}
					<div class="word">{word.word}</div>
					<div class="dino-say">say “{word.say}”</div>
				</div>
				<div class="side">
					<div class="bubble-box">
						<div class="box-label">It means…</div>
						<p class="box-text big">{word.meaning}</p>
					</div>
					<div class="bubble-box sentence">
						<div class="box-label">Try it in a sentence</div>
						<p class="box-text"><i>“{word.sentence}”</i></p>
					</div>
					<button class="another pressable" onclick={() => another('word')}>Another word! <Emoji code="27a1" size={18} alt="" shadow="none" /></button>
				</div>
			{:else if corner === 'math'}
				<div class="math">
					<div class="levels">
						{#each ['easy', 'tricky'] as l (l)}
							<button
								class="level pressable"
								class:on={level === l}
								onclick={() => {
									level = l as MathLevel;
									answered = null;
								}}
							>
								{l === 'easy' ? 'Easy' : 'Tricky'}
							</button>
						{/each}
					</div>
					{#key puzzle.question}
						<div class="question anim-pop">{puzzle.question}</div>
					{/key}
					<div class="choices">
						{#each puzzle.choices as c (c)}
							<button
								class="choice pressable"
								class:right={answered !== null && c === puzzle.answer && solved}
								class:wrong={answered === c && c !== puzzle.answer}
								disabled={solved}
								onclick={() => (answered = c)}
							>
								{c}
							</button>
						{/each}
					</div>
					<div class="math-msg">
						{#if solved}
							<Emoji code="1f389" size={28} alt="" class="anim-pop" /> Yes! Great thinking!
							<button class="another pressable" onclick={() => another('math')}>Next puzzle <Emoji code="27a1" size={18} alt="" shadow="none" /></button>
						{:else if answered !== null}
							<Emoji code="1f914" size={24} alt="" shadow="none" /> Not quite. Try again!
						{:else}
							Tap the right answer
						{/if}
					</div>
				</div>
			{:else}
				<div class="fact-panel">
					<SectionTitle variant="white">Did you know?</SectionTitle>
					{#key fact.text}
						<p class="fact-text anim-pop">
							{fact.text}
							{#each fact.emoji as code, i (i)}
								<Emoji {code} size={30} alt="" />
							{/each}
						</p>
					{/key}
					<button class="another pressable" onclick={() => another('fact')}>Show me another! <Emoji code="27a1" size={18} alt="" shadow="none" /></button>
				</div>
			{/if}
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
	.fun-card {
		flex: 1;
		padding: 10px 16px 14px;
		gap: 10px;
		background-color: #dcfce7;
	}
	.fun-card.corner-joke {
		background-color: #fef9c3;
	}
	.fun-card.corner-word {
		background-color: #e0e7ff;
	}
	.fun-card.corner-math {
		background-color: #fce7f3;
	}
	.fun-card.corner-fact {
		background-color: #e0f2fe;
	}

	/* corner pills */
	.corners {
		display: flex;
		gap: 8px;
		justify-content: center;
	}
	.corner-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 14px;
		font: 900 16px 'Nunito', sans-serif;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.corner-pill.on {
		background: var(--tab-pink);
		color: #ffffff;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.35);
	}

	.panel {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		gap: 18px;
	}
	.side {
		flex: 1.2;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* shared boxes + buttons */
	.bubble-box {
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 16px;
		padding: 10px 14px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.box-label {
		font-size: 15px;
		font-weight: 900;
		color: #ef4444;
	}
	.box-text {
		font-size: 17px;
		font-weight: 800;
		line-height: 1.35;
	}
	.box-text.big {
		font-size: 20px;
		font-weight: 900;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.another,
	.reveal {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 44px;
		padding: 0 18px;
		font: 900 17px 'Nunito', sans-serif;
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.reveal {
		align-self: center;
		height: 56px;
		padding: 0 30px;
		font-size: 22px;
		background: var(--tab-orange);
		color: #ffffff;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.35);
	}

	/* dino */
	.dino-left,
	.word-left {
		flex: 0.8;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.dino-name {
		font-size: 24px;
		font-weight: 900;
		text-align: center;
		line-height: 1.1;
	}
	.dino-say {
		font-size: 14px;
		font-weight: 800;
		color: #475569;
	}
	.chips {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
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
		font-size: 15px;
		font-weight: 900;
		color: #166534;
	}

	/* joke */
	.teller {
		flex: 0.7;
		display: flex;
		justify-content: center;
		position: relative;
		will-change: transform;
	}
	.teller.laugh {
		animation: laugh 0.9s ease-in-out 3;
		transform-origin: 50% 100%;
	}
	.haha {
		position: absolute;
		top: -6px;
		right: 14%;
	}
	@keyframes laugh {
		0%,
		100% {
			transform: rotate(0deg) translateY(0);
		}
		20% {
			transform: rotate(-7deg) translateY(-8px);
		}
		40% {
			transform: rotate(5deg) translateY(0);
		}
		60% {
			transform: rotate(-5deg) translateY(-5px);
		}
		80% {
			transform: rotate(3deg) translateY(0);
		}
	}
	.joke-a {
		background: #fef08a;
	}

	/* word */
	.word {
		font-size: 34px;
		font-weight: 900;
		line-height: 1.1;
		color: #4338ca;
	}
	.sentence {
		background: #f8fafc;
	}

	/* math */
	.math {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}
	.levels {
		display: flex;
		gap: 8px;
	}
	.level {
		height: 36px;
		padding: 0 18px;
		font: 900 15px 'Nunito', sans-serif;
		background: var(--card-white);
		border: 2.5px solid var(--border-dark);
		border-radius: 999px;
	}
	.level.on {
		background: var(--tab-purple);
	}
	.question {
		font-size: 50px;
		font-weight: 900;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 18px;
		padding: 2px 30px;
		box-shadow: var(--sticker-shadow);
	}
	.choices {
		display: flex;
		gap: 16px;
	}
	.choice {
		width: 96px;
		height: 64px;
		font: 900 32px 'Nunito', sans-serif;
		background: var(--yellow-banner);
		border: 3px solid var(--border-dark);
		border-radius: 16px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.choice.right {
		background: var(--tab-green);
		color: #ffffff;
		text-shadow: 1px 1px 0 rgba(17, 24, 39, 0.4);
	}
	.choice.wrong {
		background: #e2e8f0;
		opacity: 0.6;
		text-decoration: line-through;
	}
	.choice:disabled {
		cursor: default;
	}
	.math-msg {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 18px;
		font-weight: 900;
		min-height: 44px;
	}

	/* facts */
	.fact-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
	}
	.fact-text {
		max-width: 620px;
		text-align: center;
		font-size: 24px;
		font-weight: 900;
		line-height: 1.4;
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 18px;
		padding: 16px 22px;
		box-shadow: var(--sticker-shadow-sm);
	}
	.fact-text :global(img) {
		vertical-align: middle;
		margin-left: 4px;
	}
	.fact-panel .another {
		align-self: center;
	}
</style>
