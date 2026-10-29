<script lang="ts">
	/**
	 * 🎤 Ask: opened by pressing the 🎤 button in the header or on the idle
	 * screen. The kid talks while holding it, and letting go ends the question
	 * (the mic is only on while this says "I'm listening"). Shows what it
	 * heard, then the AI helper's answer, which it reads aloud. Holding 🎤
	 * again carries on the same conversation, so follow-ups like "why?" work.
	 * See /api/ask: the recording stays on the Pi and is deleted right after.
	 */
	import { onDestroy, onMount } from 'svelte';
	import Emoji from '#lib/components/Emoji.svelte';
	import MicButton from '#lib/components/MicButton.svelte';
	import ReadAloud from '#lib/components/ReadAloud.svelte';
	import { askOpen, micHeld, reading } from '#lib/screen';

	let { facts }: { facts: string } = $props();

	/** hold: let go too quickly to say anything */
	type Step = 'listening' | 'nothing' | 'hold' | 'thinking' | 'answer' | 'oops';
	const QUICK_TAP_MS = 700;
	let step = $state<Step>('listening');
	let question = $state('');
	let reply = $state('');
	let talking = $state(false);
	let closed = false;
	let answered = 0; // questions answered since the sheet opened
	let listenId = ''; // this recording: letting go stops exactly this one
	let pressedAt = 0;
	let quickTap = false;

	const post = (body: object) =>
		fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

	// letting go of 🎤 ends the question
	$effect(() => {
		if (!$micHeld && step === 'listening' && listenId) letGo();
	});

	function letGo() {
		quickTap = Date.now() - pressedAt < QUICK_TAP_MS;
		post({ action: 'stop', id: listenId }).catch(() => {});
		listenId = '';
	}

	async function ask() {
		step = 'listening';
		question = reply = '';
		pressedAt = $micHeld || Date.now();
		quickTap = false;
		const id = (listenId = Math.random().toString(36).slice(2));
		try {
			const heard = await post({ action: 'listen', hold: true, id });
			if (closed) return;
			if (!heard.ok) throw new Error();
			question = (await heard.json()).question;
			if (!question) return void (step = quickTap ? 'hold' : 'nothing');
			step = 'thinking';
			const res = await post({
				action: 'answer',
				question,
				facts: facts ? JSON.parse(facts) : null,
				fresh: answered === 0
			});
			if (closed) return;
			if (!res.ok) throw new Error();
			reply = (await res.json()).answer;
			answered++;
			step = 'answer';
			talking = true;
			await fetch('/api/speak', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ text: reply })
			}).catch(() => {});
			talking = false;
		} catch {
			if (!closed) step = 'oops';
		}
	}

	function close() {
		closed = true;
		if (listenId) letGo();
		if (talking) fetch('/api/speak', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"stop":true}' });
		askOpen.set(false);
	}

	onMount(() => {
		reading.set(true); // don't jump back to the idle screen mid-answer
		ask();
	});
	onDestroy(() => {
		closed = true;
		reading.set(false);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="scrim" onclick={(e) => e.target === e.currentTarget && close()} role="presentation">
	<div class="sheet card anim-pop" role="dialog" aria-modal="true" aria-label="Ask a question">
		{#if step === 'listening'}
			<div class="big listening"><Emoji code="1f3a4" size={96} alt="" /></div>
			<div class="title">I'm listening…</div>
			<div class="sub">Let go of <Emoji code="1f3a4" size={22} alt="the mic" shadow="none" /> when you're done.</div>
		{:else if step === 'nothing'}
			<div class="big"><Emoji code="1f442" size={84} alt="" /></div>
			<div class="title">I didn't hear anything</div>
			<div class="sub">Come close and talk loudly.</div>
			<div class="row">
				<MicButton look="pill" label="Hold to try again" onpress={ask} />
				<button class="btn pressable" onclick={close}>Close</button>
			</div>
		{:else if step === 'hold'}
			<div class="big"><Emoji code="1f3a4" size={84} alt="" /></div>
			<div class="title">Hold <Emoji code="1f3a4" size={30} alt="the mic" shadow="none" /> while you talk</div>
			<div class="sub">Press, ask your question, then let go.</div>
			<div class="row">
				<MicButton look="pill" label="Hold and ask" onpress={ask} />
				<button class="btn pressable" onclick={close}>Close</button>
			</div>
		{:else if step === 'thinking'}
			<div class="asked">“{question}”</div>
			<div class="big thinking"><Emoji code="1f914" size={84} alt="" /></div>
			<div class="title">Thinking…</div>
		{:else if step === 'answer'}
			<div class="asked">“{question}”</div>
			<p class="answer">{reply}</p>
			<div class="row">
				<ReadAloud text={reply} label="Again" bind:talking />
				<MicButton look="pill" label="Hold to ask more" onpress={ask} />
				<button class="btn pressable" onclick={close}>Done</button>
			</div>
		{:else}
			<div class="big"><Emoji code="1f914" size={84} alt="" /></div>
			<div class="title">Oops, that didn't work</div>
			<div class="sub">Let's try again in a minute.</div>
			<div class="row">
				<MicButton look="pill" label="Hold to try again" onpress={ask} />
				<button class="btn pressable" onclick={close}>Close</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.5);
	}
	.sheet {
		width: 640px;
		max-height: 440px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 22px 28px;
		background: #ecfeff;
		font-family: 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
	}
	.big {
		display: flex;
	}
	.listening {
		animation: listen 1.2s ease-in-out infinite;
	}
	.thinking {
		animation: think 1.6s ease-in-out infinite;
	}
	@keyframes listen {
		50% {
			transform: scale(1.12);
		}
	}
	@keyframes think {
		25% {
			transform: rotate(-8deg);
		}
		75% {
			transform: rotate(8deg);
		}
	}
	.title {
		font-size: 34px;
		font-weight: 900;
	}
	.sub {
		font-size: 20px;
		font-weight: 800;
		color: #475569;
	}
	.asked {
		max-width: 100%;
		font-size: 20px;
		font-weight: 800;
		font-style: italic;
		color: #0e7490;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.answer {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		margin: 0;
		font-size: 26px;
		font-weight: 900;
		line-height: 1.35;
		text-align: center;
	}
	.row {
		display: flex;
		gap: 12px;
		margin-top: 6px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 54px;
		padding: 0 20px;
		font: 900 21px 'Nunito', 'Baloo 2', sans-serif;
		color: var(--text-dark);
		white-space: nowrap;
		background: #e5e7eb;
		border: 3px solid var(--border-dark);
		border-radius: 999px;
		box-shadow: var(--sticker-shadow-sm);
	}
</style>
