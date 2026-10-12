/**
 * Math of the day: small puzzles with three answer buttons. Seeded, so the
 * whole family sees the same puzzle on the same day; "another" bumps the seed.
 *   easy   - adding and taking away within 20
 *   tricky - times tables, missing numbers, two-step problems
 */
export type MathLevel = 'easy' | 'tricky';

export interface MathPuzzle {
	question: string;
	answer: number;
	choices: number[];
}

/** Tiny seeded random number generator (mulberry32). */
function rng(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function mathPuzzle(seed: number, level: MathLevel): MathPuzzle {
	const r = rng(seed * 7919 + (level === 'easy' ? 1 : 2));
	const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
	let question: string;
	let answer: number;

	if (level === 'easy') {
		if (r() < 0.5) {
			const a = int(1, 10);
			const b = int(1, 10);
			question = `${a} + ${b} = ?`;
			answer = a + b;
		} else {
			const a = int(5, 20);
			const b = int(1, a);
			question = `${a} − ${b} = ?`;
			answer = a - b;
		}
	} else {
		const kind = int(0, 2);
		if (kind === 0) {
			const a = int(2, 10);
			const b = int(2, 10);
			question = `${a} × ${b} = ?`;
			answer = a * b;
		} else if (kind === 1) {
			const a = int(3, 25);
			const total = a + int(3, 25);
			question = `? + ${a} = ${total}`;
			answer = total - a;
		} else {
			const a = int(2, 9);
			const b = int(2, 5);
			const c = int(1, 10);
			question = `${a} × ${b} + ${c} = ?`;
			answer = a * b + c;
		}
	}

	// two near-miss wrong answers, never negative, never duplicates
	const choices = new Set<number>([answer]);
	while (choices.size < 3) {
		const wrong = answer + (r() < 0.5 ? -1 : 1) * int(1, 3);
		if (wrong >= 0) choices.add(wrong);
	}
	const shuffled = [...choices].sort(() => r() - 0.5);
	return { question, answer, choices: shuffled };
}
