import { describe, expect, it } from 'vitest';
import { FRAME_MS, SpeechGate } from '../src/lib/utils/vad';
import { readQuestion } from '../src/lib/server/ask';

const SAMPLES = (16000 * FRAME_MS) / 1000;
const frame = (level: number) => Int16Array.from({ length: SAMPLES }, (_, i) => (i % 2 ? level : -level));
const feed = (gate: SpeechGate, level: number, ms: number) => {
	let s = gate.state;
	for (let t = 0; t < ms; t += FRAME_MS) s = gate.push(frame(level));
	return s;
};

describe('SpeechGate', () => {
	it('waits for speech, then ends after a pause', () => {
		const g = new SpeechGate();
		expect(feed(g, 20000, 500)).toBe('waiting'); // the mic opening: ignored
		expect(feed(g, 100, 300)).toBe('waiting'); // room noise
		expect(feed(g, 100, 500)).toBe('waiting');
		expect(feed(g, 3000, 800)).toBe('speech');
		expect(g.speechStart).toBeGreaterThan(0);
		expect(feed(g, 3000, 1000)).toBe('speech');
		expect(feed(g, 100, 600)).toBe('speech'); // a short pause between words
		expect(feed(g, 3000, 300)).toBe('speech');
		expect(feed(g, 100, 1200)).toBe('done');
	});

	it('gives up when nobody talks', () => {
		const g = new SpeechGate({ noSpeechMs: 2000 });
		expect(feed(g, 100, 2100)).toBe('nothing');
	});

	it('ignores a click shorter than a word', () => {
		const g = new SpeechGate({ settleMs: 0 });
		feed(g, 100, 300);
		expect(feed(g, 5000, 60)).toBe('waiting');
		expect(feed(g, 100, 200)).toBe('waiting');
	});

	it('measures a noisy room and needs speech above it', () => {
		const g = new SpeechGate({ settleMs: 0, maxLevel: 5000 });
		feed(g, 1000, 300);
		expect(feed(g, 2000, 500)).toBe('waiting'); // below 3x the noise
		expect(feed(g, 4000, 300)).toBe('speech');
	});

	it('stops at the time limit', () => {
		const g = new SpeechGate({ settleMs: 0, maxMs: 3000 });
		feed(g, 100, 300);
		expect(feed(g, 3000, 3000)).toBe('done');
	});

	it('never sets the bar so high it goes deaf', () => {
		const g = new SpeechGate({ settleMs: 0 });
		feed(g, 4000, 300); // a loud start
		expect(feed(g, 2000, 300)).toBe('speech');
	});

	it('does not count a steady offset as sound', () => {
		const g = new SpeechGate({ settleMs: 0 });
		const offset = Int16Array.from({ length: 320 }, () => -1200);
		for (let i = 0; i < 40; i++) g.push(offset);
		expect(g.state).toBe('waiting');
		expect(g.loudest).toBe(0);
	});
});

describe('readQuestion', () => {
	it('tidies what was heard and drops whisper noise', () => {
		expect(readQuestion('  Why is the   sky blue? ')).toBe('Why is the sky blue?');
		expect(readQuestion('Thank you.')).toBe('');
		expect(readQuestion(' . ')).toBe('');
		expect(readQuestion(42)).toBe('');
		expect(readQuestion('a'.repeat(500))).toHaveLength(200);
	});
});
