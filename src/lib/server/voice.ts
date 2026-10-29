/**
 * The voice: speaks text through the WM8960 audio HAT (speakers + mics).
 *
 * Piper (free text to speech, runs on the Pi) lives in its own Python venv,
 * kept outside the repo (VOICE_DIR, default ~/.local/share/kids-voice):
 *   <VOICE_DIR>/venv/bin/python     with `pip install piper-tts`
 *   <VOICE_DIR>/voices/<VOICE>.onnx  (+ .onnx.json), default en_US-amy-medium
 * scripts/tts-worker.py is started once and kept running, so a sentence
 * takes well under a second after the first one.
 *
 * Listening (push-to-talk "Ask"): faster-whisper, in the same venv
 * (`pip install faster-whisper`), with the model in <VOICE_DIR>/whisper/base.en;
 * scripts/stt-worker.py keeps it loaded. The recording never leaves the Pi
 * and is deleted as soon as it has been turned into text.
 *
 * The HAT hisses a little whenever its speaker amplifier is open, so the
 * speakers are muted and the mic input is off except while something is
 * being said, or a kid is asking a question (never both at once).
 *
 * Settings in data/voice.json: { enabled, volume (0-100), mic } (volume and
 * the mic switch are in the quick menu that pulls down from the header).
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { FRAME_MS, SpeechGate } from '#lib/utils/vad';

const run = promisify(execFile);

const DATA = resolve(process.env.DASHBOARD_DATA ?? 'data');
const FILE = resolve(DATA, 'voice.json');
const CACHE = resolve(DATA, 'voice-cache');
const VOICE_DIR = process.env.VOICE_DIR ?? resolve(homedir(), '.local/share/kids-voice');
const PYTHON = resolve(VOICE_DIR, 'venv/bin/python');
const MODEL = resolve(VOICE_DIR, 'voices', `${process.env.VOICE ?? 'en_US-amy-medium'}.onnx`);
const STT_MODEL = resolve(VOICE_DIR, 'whisper', process.env.VOICE_STT ?? 'base.en');
const CARD = process.env.VOICE_CARD ?? 'wm8960soundcard';
const MAX_CACHED = 40;

export interface VoiceSettings {
	enabled: boolean;
	/** 0-100, mapped onto the speaker amplifier's useful range */
	volume: number;
	/** may the dashboard listen at all (push-to-talk)? off: the mic input stays off */
	mic: boolean;
}

const DEFAULTS: VoiceSettings = { enabled: true, volume: 70, mic: true };

export function getVoice(): VoiceSettings {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		return {
			enabled: s.enabled !== false,
			volume: Number.isFinite(s.volume) ? Math.min(100, Math.max(0, Math.round(s.volume))) : DEFAULTS.volume,
			mic: s.mic !== false
		};
	} catch {
		return { ...DEFAULTS };
	}
}

export function saveVoice(patch: Partial<VoiceSettings>): VoiceSettings {
	const s = { ...getVoice(), ...patch };
	mkdirSync(DATA, { recursive: true });
	writeFileSync(`${FILE}.tmp`, JSON.stringify(s, null, '\t') + '\n');
	renameSync(`${FILE}.tmp`, FILE);
	return s;
}

/** Is the HAT there and Piper installed? */
export function voiceInstalled(): boolean {
	try {
		return existsSync(PYTHON) && existsSync(MODEL) && readFileSync('/proc/asound/cards', 'utf8').includes(CARD);
	} catch {
		return false;
	}
}

/** Can the kiosk offer "Read me" buttons? */
export const voiceOn = () => getVoice().enabled && voiceInstalled();

// ---------------- the HAT's mixer ----------------

const amixer = (...args: string[]) => run('amixer', ['-q', '-c', CARD, 'sset', ...args], { timeout: 5000 });

// Waveshare's tuned levels (their wm8960_asound.state), plus zero-cross
// volume changes so opening / closing the speakers doesn't click as much
const BASE: string[][] = [
	['Left Output Mixer PCM', 'on'],
	['Right Output Mixer PCM', 'on'],
	['Left Output Mixer Boost Bypass', 'off'],
	['Right Output Mixer Boost Bypass', 'off'],
	['Left Output Mixer LINPUT3', 'off'],
	['Right Output Mixer RINPUT3', 'off'],
	['Playback', '255'],
	['Headphone', '109'],
	['Speaker AC', '4'],
	['Speaker DC', '4'],
	['Speaker Playback ZC', 'on'],
	['Headphone Playback ZC', 'on'],
	['Left Boost Mixer LINPUT1', 'on'],
	['Right Boost Mixer RINPUT1', 'on'],
	['Left Input Mixer Boost', 'on'],
	['Right Input Mixer Boost', 'on'],
	['Left Input Boost Mixer LINPUT1', '3'],
	['Right Input Boost Mixer RINPUT1', '3'],
	['ADC PCM', '195'],
	['ADC High Pass Filter', 'on']
];

/** speaker amplifier level: below 48 the chip mutes, 121 is 0 dB */
const speakerLevel = (volume: number) => (volume <= 0 ? 0 : Math.round(85 + (36 * volume) / 100));

let mixerReady: Promise<void> | null = null;
function setUpMixer() {
	mixerReady ??= (async () => {
		for (const [control, value] of BASE) await amixer(control, value).catch(() => {});
		await quiet();
	})();
	return mixerReady;
}

/** speakers muted, mic input off: no hiss between sentences */
const quiet = () =>
	Promise.all([amixer('Speaker', '0').catch(() => {}), amixer('Capture', '39', 'nocap').catch(() => {})]);

// ---------------- the Python helpers ----------------

interface Reply {
	ok: boolean;
	error?: string;
	text?: string;
}

/**
 * A helper process kept running (it loads its model once): one JSON request
 * per line in, one JSON reply per line out, answered in order.
 */
class Helper {
	private proc: ChildProcess | null = null;
	private starting: Promise<void> | null = null;
	private waiting: ((r: Reply) => void)[] = [];

	constructor(
		private name: string,
		private args: string[]
	) {}

	start(): Promise<void> {
		if (this.proc) return Promise.resolve();
		this.starting ??= new Promise<void>((ok, fail) => {
			const p = spawn(PYTHON, this.args, { stdio: ['pipe', 'pipe', 'pipe'] });
			this.proc = p;
			this.waiting = [(r) => (r.ok ? ok() : fail(new Error(r.error)))];
			createInterface({ input: p.stdout! }).on('line', (line) => {
				let reply;
				try {
					reply = JSON.parse(line);
				} catch {
					return; // a stray print from a library
				}
				this.waiting.shift()?.(reply);
			});
			let err = '';
			p.stderr!.on('data', (d) => (err = (err + d).slice(-400)));
			p.on('exit', (code) => {
				if (this.proc === p) this.proc = null;
				for (const done of this.waiting.splice(0))
					done({ ok: false, error: `the ${this.name} stopped (${code}) ${err.trim()}` });
			});
		}).finally(() => (this.starting = null));
		return this.starting;
	}

	async ask(req: object): Promise<Reply> {
		await this.start();
		const reply = await new Promise<Reply>((done) => {
			this.waiting.push(done);
			this.proc!.stdin!.write(JSON.stringify(req) + '\n');
		});
		if (!reply.ok) throw new Error(reply.error ?? `the ${this.name} failed`);
		return reply;
	}

	stop() {
		this.proc?.kill();
	}
}

const tts = new Helper('voice', [resolve('scripts/tts-worker.py'), MODEL]);
const stt = new Helper('listener', [resolve('scripts/stt-worker.py'), STT_MODEL]);

const synth = (text: string, out: string) => tts.ask({ text, out });

/** the spoken text as a WAV file, made once per text */
async function wavFor(text: string): Promise<string> {
	mkdirSync(CACHE, { recursive: true });
	const file = resolve(CACHE, `${createHash('sha256').update(text).digest('hex').slice(0, 16)}.wav`);
	if (!existsSync(file)) {
		await synth(text, `${file}.tmp`);
		renameSync(`${file}.tmp`, file);
		trimCache();
	}
	return file;
}

function trimCache() {
	const files = readdirSync(CACHE)
		.filter((f) => f.endsWith('.wav') && !f.startsWith('heard-'))
		.map((f) => ({ f, t: statSync(resolve(CACHE, f)).mtimeMs }))
		.sort((a, b) => b.t - a.t);
	for (const { f } of files.slice(MAX_CACHED)) unlinkSync(resolve(CACHE, f));
}

// ---------------- speaking ----------------

let player: ChildProcess | null = null;
let current: string | null = null;
let queue: Promise<void> = Promise.resolve();

/** What is being said right now (null: nothing). */
export const speaking = () => current;

/** Stop talking straight away. */
export function stopSpeaking() {
	player?.kill();
}

/**
 * Say this (one thing at a time: a new request waits for the one before).
 * Resolves when it has finished (or was stopped).
 */
export function say(text: string): Promise<void> {
	const job = async () => {
		await setUpMixer();
		const wav = await wavFor(text);
		current = text;
		try {
			await amixer('Speaker', String(speakerLevel(getVoice().volume)));
			await new Promise<void>((done) => {
				// plughw: plays the voice at its own rate (22 kHz), which sounds cleanest
				const p = spawn('aplay', ['-q', '-D', `plughw:${CARD}`, wav], { stdio: 'ignore' });
				player = p;
				p.on('exit', () => done());
				p.on('error', () => done());
			});
		} finally {
			player = null;
			current = null;
			await quiet();
		}
	};
	const next = queue.then(job, job);
	queue = next.catch(() => {});
	return next;
}

/** Text the dashboard wrote itself that may be read aloud (answers to questions). */
const speakable = new Set<string>();
export function allowSpeech(text: string) {
	speakable.add(text);
	if (speakable.size > 30) speakable.delete(speakable.values().next().value!);
}
export const maySay = (text: string) => speakable.has(text);

// ---------------- listening ----------------

/** Is the speech-to-text model there (and the voice on)? */
export const canListen = () => voiceOn() && existsSync(resolve(STT_MODEL, 'model.bin'));
/** ...and the mic switched on in the quick menu (the AI part is checked separately) */
export const micOn = () => canListen() && getVoice().mic;

const RATE = 16000;
const FRAME_BYTES = (RATE * FRAME_MS) / 1000 * 2;
let recorder: ChildProcess | null = null;

/** End the question now (the "I'm done" button): what was heard so far is used. */
export function stopListening() {
	recorder?.kill();
}

function wavHeader(bytes: number) {
	const h = Buffer.alloc(44);
	h.write('RIFF', 0);
	h.writeUInt32LE(36 + bytes, 4);
	h.write('WAVEfmt ', 8);
	h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20); // PCM
	h.writeUInt16LE(1, 22); // mono
	h.writeUInt32LE(RATE, 24);
	h.writeUInt32LE(RATE * 2, 28);
	h.writeUInt16LE(2, 32);
	h.writeUInt16LE(16, 34);
	h.write('data', 36);
	h.writeUInt32LE(bytes, 40);
	return h;
}

/**
 * Listen for one question: the speakers are muted and the mic opened, it
 * records until the kid stops talking, then turns it into text.
 * '' when nobody said anything. `hint`: words it should spell right (names).
 */
export async function listen(hint = ''): Promise<string> {
	if (recorder) throw new Error('Already listening');
	stopSpeaking();
	await queue; // never listen while it's talking
	await setUpMixer();
	stt.start().catch(() => {}); // warm up while the kid talks
	const gate = new SpeechGate();
	const frames: Buffer[] = [];
	try {
		await amixer('Speaker', '0');
		await amixer('Capture', 'cap');
		await new Promise<void>((done) => {
			const r = spawn('arecord', ['-q', '-D', `plughw:${CARD}`, '-f', 'S16_LE', '-r', String(RATE), '-c', '1', '-t', 'raw'], {
				stdio: ['ignore', 'pipe', 'ignore']
			});
			recorder = r;
			let rest = Buffer.alloc(0);
			r.stdout!.on('data', (chunk: Buffer) => {
				rest = Buffer.concat([rest, chunk]);
				while (rest.length >= FRAME_BYTES) {
					const frame = rest.subarray(0, FRAME_BYTES);
					rest = rest.subarray(FRAME_BYTES);
					frames.push(frame);
					const state = gate.push(new Int16Array(frame.buffer, frame.byteOffset, FRAME_BYTES / 2));
					if (state === 'done' || state === 'nothing') r.kill();
				}
			});
			r.on('exit', () => done());
			r.on('error', () => done());
		});
	} finally {
		recorder = null;
		await quiet();
	}
	if (gate.speechStart < 0) {
		console.log(`[voice] heard nothing (${frames.length} frames, speech above ${Math.round(gate.level)}, loudest ${Math.round(gate.loudest)})`);
		return '';
	}
	// from a little before the speech started
	const audio = Buffer.concat(frames.slice(Math.max(0, gate.speechStart - 15)));
	mkdirSync(CACHE, { recursive: true });
	const file = resolve(CACHE, `heard-${Date.now()}.wav`);
	writeFileSync(file, Buffer.concat([wavHeader(audio.length), audio]));
	try {
		return ((await stt.ask({ wav: file, prompt: hint })).text ?? '').trim();
	} finally {
		unlinkSync(file);
	}
}

/** At server start: put the HAT in its quiet state and load the voice in the background. */
export function startVoice() {
	if (!voiceInstalled()) return;
	setUpMixer()
		.then(() => (getVoice().enabled ? tts.start() : undefined))
		.then(() => console.log('[voice] ready'))
		.then(() => (micOn() ? stt.start() : undefined))
		.catch((err) => console.warn(`[voice] ${err}`));
	const stop = () => {
		player?.kill();
		recorder?.kill();
		tts.stop();
		stt.stop();
	};
	process.once('SIGTERM', stop);
	process.once('exit', stop);
}
