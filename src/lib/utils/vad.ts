/**
 * When has a kid finished asking? A small energy-based voice detector for
 * push-to-talk: the first moments set the room's noise level, speech is
 * anything well above it, and a pause after speech ends the question.
 * The HAT thumps for a moment when its mic input opens (and the signal sits
 * a little off zero), so the start is skipped and each frame's offset removed.
 * Feed it 16-bit mono samples, 20 ms at a time.
 */

export const FRAME_MS = 20;

export interface GateOptions {
	/** ignored at the very start, while the mic input settles */
	settleMs: number;
	/** how long the noise level is measured for, after that */
	calibrateMs: number;
	/** this many times the noise level counts as speech */
	ratio: number;
	/** ...but never below this RMS (16-bit samples) */
	minLevel: number;
	/** ...or above this one (a noisy start mustn't make it deaf) */
	maxLevel: number;
	/** speech has to last this long to count (not a cough or a click) */
	minSpeechMs: number;
	/** ...allowing dips this short between syllables */
	maxDipMs: number;
	/** a pause this long after speech ends the question */
	endSilenceMs: number;
	/** give up when nobody has said anything by then */
	noSpeechMs: number;
	/** hard stop */
	maxMs: number;
}

export const GATE_DEFAULTS: GateOptions = {
	settleMs: 500,
	calibrateMs: 300,
	ratio: 3,
	minLevel: 300,
	maxLevel: 1500,
	minSpeechMs: 160,
	maxDipMs: 80,
	endSilenceMs: 800,
	noSpeechMs: 6000,
	maxMs: 12000
};

export type GateState = 'waiting' | 'speech' | 'done' | 'nothing';

/** loudness of one frame, around its own average (so an offset doesn't count) */
export const rms = (frame: Int16Array) => {
	if (!frame.length) return 0;
	let mean = 0;
	for (const v of frame) mean += v;
	mean /= frame.length;
	let sum = 0;
	for (const v of frame) sum += (v - mean) ** 2;
	return Math.sqrt(sum / frame.length);
};

export class SpeechGate {
	state: GateState = 'waiting';
	/** frame index where speech started (for trimming the silence before it) */
	speechStart = -1;
	private o: GateOptions;
	private frames = 0;
	private noise: number[] = [];
	level = Infinity;
	/** the loudest frame so far (for the log when nothing was heard) */
	loudest = 0;
	private loudRun = 0;
	private dipRun = 0;
	private runStart = -1;
	private quietRun = 0;

	constructor(options: Partial<GateOptions> = {}) {
		this.o = { ...GATE_DEFAULTS, ...options };
	}

	/**
	 * Something above the speech bar was heard, even if it never counted as
	 * speech: worth letting speech to text decide (after "I'm done").
	 */
	get heardSomething() {
		return this.loudest >= this.level;
	}

	/** one 20 ms frame in; the state after it */
	push(frame: Int16Array): GateState {
		if (this.state === 'done' || this.state === 'nothing') return this.state;
		const o = this.o;
		const e = rms(frame);
		const ms = ++this.frames * FRAME_MS;
		if (ms <= o.settleMs) return this.state;
		this.loudest = Math.max(this.loudest, e);
		if (ms <= o.settleMs + o.calibrateMs) {
			this.noise.push(e);
			if (ms + FRAME_MS > o.settleMs + o.calibrateMs) {
				// the quieter frames: a click, or a kid who starts talking straight away, doesn't spoil it
				const sorted = [...this.noise].sort((a, b) => a - b);
				const level = sorted[Math.floor(sorted.length / 4)] * o.ratio;
				this.level = Math.min(o.maxLevel, Math.max(o.minLevel, level));
			}
			return this.state;
		}
		const loud = e >= this.level;
		if (this.state === 'waiting') {
			if (loud) {
				if (!this.loudRun) this.runStart = this.frames - 1;
				this.loudRun++;
				this.dipRun = 0;
			} else if (this.loudRun && ++this.dipRun * FRAME_MS > o.maxDipMs) {
				this.loudRun = this.dipRun = 0;
			}
			if (this.loudRun * FRAME_MS >= o.minSpeechMs) {
				this.state = 'speech';
				this.speechStart = this.runStart;
			} else if (ms >= o.noSpeechMs) this.state = 'nothing';
		} else {
			// the end of a word is quieter than its middle: a lower bar to stay "speaking"
			this.quietRun = e >= this.level * 0.7 ? 0 : this.quietRun + 1;
			if (this.quietRun * FRAME_MS >= o.endSilenceMs) this.state = 'done';
		}
		if (ms >= o.maxMs && this.state !== 'done') this.state = this.state === 'speech' ? 'done' : 'nothing';
		return this.state;
	}
}
