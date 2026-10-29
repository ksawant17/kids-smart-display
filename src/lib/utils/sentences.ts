/**
 * Text split into sentences for speaking: the first one can play while the
 * next is being made. Very short pieces ("Hi!", "Wow.") ride along with the
 * next sentence so the voice doesn't sound choppy.
 */
const MIN_LEN = 25;

export function sentences(text: string): string[] {
	// a sentence ends at . ! or ? (plus any closing quote) followed by a space: "48.5" stays whole
	const parts = text.split(/(?<=[.!?]+["”’')]*)\s+/).map((s) => s.trim()).filter(Boolean);
	const out: string[] = [];
	let carry = '';
	for (const p of parts) {
		const s = carry ? `${carry} ${p}` : p;
		if (s.length < MIN_LEN) carry = s;
		else (out.push(s), (carry = ''));
	}
	if (carry) out.length ? (out[out.length - 1] += ` ${carry}`) : out.push(carry);
	return out.length ? out : [text.trim()].filter(Boolean);
}
