<script lang="ts">
	/**
	 * Full-screen on-screen keyboard for typing on the kiosk (it has no
	 * keyboard): kid names, notes, Wi-Fi passwords, links. The text box is a
	 * real <input>, so a phone or a plugged-in keyboard can type into it too.
	 */
	import Emoji from '#lib/components/Emoji.svelte';

	let {
		title,
		value = '',
		maxLength = 70,
		minLength = 1,
		placeholder = '',
		capitalize = false,
		saveLabel = 'Save',
		onsave,
		oncancel
	}: {
		title: string;
		value?: string;
		maxLength?: number;
		minLength?: number;
		placeholder?: string;
		/** capital letter after a space or at the start (names, notes) */
		capitalize?: boolean;
		saveLabel?: string;
		onsave: (text: string) => void;
		oncancel: () => void;
	} = $props();

	// starts from the given text, then it's ours
	// svelte-ignore state_referenced_locally
	let text = $state(value);
	// svelte-ignore state_referenced_locally
	let shift = $state(capitalize && !value);
	let symbols = $state(false);
	let input: HTMLInputElement | undefined = $state();

	const LETTERS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
	const SYMBOLS = ['1234567890', "-/:;()&@'\"", ',?!#=+_*'];
	const rows = $derived((symbols ? SYMBOLS : LETTERS).map((r) => [...r]));

	function type(ch: string) {
		if (text.length >= maxLength) return;
		text += shift && !symbols ? ch.toUpperCase() : ch;
		shift = false;
		if (capitalize && ch === ' ') shift = true;
	}
	function back() {
		text = text.slice(0, -1);
		shift = capitalize && (text === '' || text.endsWith(' '));
	}
	const ok = $derived(text.trim().length >= minLength);
</script>

<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
	<div class="top">
		<button class="a-btn small pressable" onclick={oncancel}>Cancel</button>
		<div class="field">
			<div class="title">{title} <span class="a-muted">{text.length}/{maxLength}</span></div>
			<input
				bind:this={input}
				bind:value={text}
				maxlength={maxLength}
				{placeholder}
				autocomplete="off"
				autocapitalize={capitalize ? 'words' : 'off'}
				spellcheck="false"
				onkeydown={(e) => e.key === 'Enter' && ok && onsave(text.trim())}
			/>
		</div>
		<button class="a-btn small go pressable" disabled={!ok} onclick={() => onsave(text.trim())}>{saveLabel}</button>
	</div>

	<div class="keys">
		{#each rows as row, r (r)}
			<div class="krow">
				{#if r === 2 && !symbols}
					<button class="key wide pressable" class:on={shift} onclick={() => (shift = !shift)} aria-label="Capital letter">
						<Emoji code="2b06" size={22} alt="" shadow="none" />
					</button>
				{/if}
				{#each row as ch (ch)}
					<button class="key pressable" onclick={() => type(ch)}>{shift && !symbols ? ch.toUpperCase() : ch}</button>
				{/each}
				{#if r === 2}
					<button class="key wide back pressable" onclick={back} aria-label="Delete">
						<Emoji code="2b05" size={22} alt="" shadow="none" />
					</button>
				{/if}
			</div>
		{/each}
		<div class="krow">
			<button class="key wide pressable" onclick={() => (symbols = !symbols)}>{symbols ? 'ABC' : '123'}</button>
			<button class="key space pressable" onclick={() => type(' ')}>space</button>
			<button class="key pressable" onclick={() => type('.')}>.</button>
			<button class="key wide go pressable" disabled={!ok} onclick={() => onsave(text.trim())}>{saveLabel}</button>
		</div>
	</div>
</div>

<style>
	.sheet {
		position: fixed;
		inset: 0;
		z-index: 46;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 12px 14px 10px;
		background: #fef9c3;
	}
	.top {
		display: flex;
		align-items: flex-end;
		gap: 10px;
	}
	.field {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.title {
		font-size: 16px;
		font-weight: 900;
	}
	input {
		height: 50px;
		padding: 0 12px;
		font: 900 24px 'Nunito', sans-serif;
		color: var(--text-dark);
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		outline: none;
		user-select: text;
		-webkit-user-select: text;
	}
	.keys {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.krow {
		flex: 1;
		display: flex;
		justify-content: center;
		gap: 7px;
	}
	.key {
		flex: 0 0 68px;
		font: 900 24px 'Nunito', sans-serif;
		color: var(--text-dark);
		background: var(--card-white);
		border: 3px solid var(--border-dark);
		border-radius: 12px;
		box-shadow: var(--sticker-shadow-sm);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.key.wide {
		flex-basis: 100px;
		font-size: 18px;
		background: #e0f2fe;
	}
	.key.on {
		background: var(--yellow-banner);
	}
	.key.back {
		background: #fde68a;
	}
	.key.space {
		flex-basis: 360px;
		font-size: 18px;
	}
	.key.go {
		background: var(--tab-green);
	}
	.key:disabled {
		opacity: 0.45;
	}
</style>
