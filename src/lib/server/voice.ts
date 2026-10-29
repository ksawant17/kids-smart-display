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
 * scripts/stt-worker.py keeps it loaded.
 *
 * A voice server on a stronger machine at home (ai-box/voice-server.py, set
 * in Grown-ups -> AI Helper) can do both instead, several times faster. The
 * HAT still records and plays here; only the recording and the words to say
 * go to it, over the home network. If it can't be reached, the Pi's own
 * helpers take over (loaded only then). Recordings are never kept anywhere.
 *
 * The HAT hisses a little whenever its speaker amplifier is open, so the
 * speakers are muted and the mic input is off except while something is
 * being said, or a kid is asking a question (never both at once).
 *
 * Settings in data/voice.json: { enabled, volume (0-100), mic, voice, speed }
 * (volume and the mic switch are in the quick menu that pulls down from the
 * header; the voice and its speed in Grown-ups -> Voice). Other voices than
 * Amy, including the funny ones, come from the voice server; without it the
 * Pi speaks as Amy.
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { getAi } from '#lib/server/ai';
import { sentences } from '#lib/utils/sentences';
import { withoutEmoji } from '#lib/utils/speech';
import { FRAME_MS, GATE_DEFAULTS, SpeechGate } from '#lib/utils/vad';

const run = promisify(execFile);

const DATA = resolve(process.env.DASHBOARD_DATA ?? 'data');
const FILE = resolve(DATA, 'voice.json');
const CACHE = resolve(DATA, 'voice-cache');
const VOICE_DIR = process.env.VOICE_DIR ?? resolve(homedir(), '.local/share/kids-voice');
const PYTHON = resolve(VOICE_DIR, 'venv/bin/python');
const MODEL = resolve(VOICE_DIR, 'voices', `${process.env.VOICE ?? 'en_US-amy-medium'}.onnx`);
const STT_MODEL = resolve(VOICE_DIR, 'whisper', process.env.VOICE_STT ?? 'base.en');
const CARD = process.env.VOICE_CARD ?? 'wm8960soundcard';
const MAX_CACHED = 80; // sentences

export interface VoiceSettings {
	enabled: boolean;
	/** 0-100, mapped onto the speaker amplifier's useful range */
	volume: number;
	/** may the dashboard listen at all (push-to-talk)? off: the mic input stays off */
	mic: boolean;
	/** a voice server voice id (see ai-box/voice-server.py) */
	voice: string;
	/** 0.7 (slower) - 1.4 (faster) */
	speed: number;
}

export const DEFAULT_VOICE = 'amy';
export const SPEEDS = { min: 0.7, max: 1.4 };
const DEFAULTS: VoiceSettings = { enabled: true, volume: 70, mic: true, voice: DEFAULT_VOICE, speed: 1 };
export const voiceIdOk = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9_-]{1,40}$/.test(v);
const clampSpeed = (n: number) => Math.round(Math.min(SPEEDS.max, Math.max(SPEEDS.min, n)) * 100) / 100;

export function getVoice(): VoiceSettings {
	try {
		const s = JSON.parse(readFileSync(FILE, 'utf8'));
		return {
			enabled: s.enabled !== false,
			volume: Number.isFinite(s.volume) ? Math.min(100, Math.max(0, Math.round(s.volume))) : DEFAULTS.volume,
			mic: s.mic !== false,
			voice: voiceIdOk(s.voice) ? s.voice : DEFAULTS.voice,
			speed: Number.isFinite(s.speed) ? clampSpeed(s.speed) : DEFAULTS.speed
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

// ---------------- the voice server (optional) ----------------

/** after a failure the Pi's own helpers are used for a while */
const SERVER_RETRY_MS = 60_000;
let serverDownUntil = 0;

/** the voice server's address and key, or null for "do it on the Pi" */
function server() {
	const { voiceUrl, voiceKey } = getAi();
	return voiceUrl && Date.now() >= serverDownUntil ? { url: voiceUrl.replace(/\/+$/, ''), key: voiceKey } : null;
}
const usesServer = () => !!getAi().voiceUrl;

/** a request to the voice server; null when there is none or it failed */
async function viaServer<T>(
	path: string,
	body: string | Buffer,
	headers: Record<string, string>,
	read: (res: Response) => Promise<T>
): Promise<T | null> {
	const s = server();
	if (!s) return null;
	try {
		const res = await fetch(`${s.url}${path}`, {
			method: 'POST',
			headers: { ...headers, ...(s.key ? { authorization: `Bearer ${s.key}` } : {}) },
			body: new Uint8Array(Buffer.from(body)),
			signal: AbortSignal.timeout(8000)
		});
		if (!res.ok) throw new Error(`it answered ${res.status}`);
		return await read(res);
	} catch (err) {
		serverDownUntil = Date.now() + SERVER_RETRY_MS;
		console.warn(`[voice] voice server: ${err}; using the Pi's own for a minute`);
		return null;
	}
}

/** the voice server's voices (null: no voice server, or it can't be reached) */
export async function serverVoices(): Promise<{ id: string; name: string; funny: boolean }[] | null> {
	const s = server();
	if (!s) return null;
	try {
		const res = await fetch(`${s.url}/voices`, { signal: AbortSignal.timeout(5000) });
		if (!res.ok) return null;
		const body = (await res.json()) as { voices?: { id?: unknown; name?: unknown; funny?: unknown }[] };
		return (body.voices ?? [])
			.filter((v) => voiceIdOk(v.id) && typeof v.name === 'string')
			.map((v) => ({ id: v.id as string, name: v.name as string, funny: v.funny === true }));
	} catch {
		return null;
	}
}

/** makes the WAV; false when the Pi's own voice (Amy) had to stand in */
async function synth(text: string, out: string, voice: string, speed: number): Promise<boolean> {
	const wav = await viaServer(
		'/tts',
		JSON.stringify({ text, voice, speed }),
		{ 'content-type': 'application/json' },
		async (r) => Buffer.from(await r.arrayBuffer())
	);
	if (wav) return writeFileSync(out, wav), true;
	await tts.ask({ text, out, speed }); // the Pi's own voice: Amy
	return false;
}

/** the recording (a WAV) as text, on the voice server or the Pi */
async function transcribe(wav: Buffer, hint: string): Promise<string> {
	const heard = await viaServer(
		'/stt',
		wav,
		// a header can only carry plain ASCII
		{ 'content-type': 'audio/wav', 'x-hint': hint.replace(/[^\x20-\x7e]/g, '') },
		async (r) => String(((await r.json()) as { text?: unknown }).text ?? '')
	);
	if (heard !== null) return heard.trim();
	mkdirSync(CACHE, { recursive: true });
	const file = resolve(CACHE, `heard-${Date.now()}.wav`);
	writeFileSync(file, wav);
	try {
		return ((await stt.ask({ wav: file, prompt: hint })).text ?? '').trim();
	} finally {
		unlinkSync(file);
	}
}

/** the spoken text as a WAV file, made once per text, voice and speed */
async function wavFor(text: string): Promise<string> {
	mkdirSync(CACHE, { recursive: true });
	const { voice, speed } = getVoice();
	const name = (v: string) => resolve(CACHE, `${createHash('sha256').update(`${v}|${speed}|${text}`).digest('hex').slice(0, 16)}.wav`);
	const file = name(voice);
	if (!existsSync(file)) {
		// Amy standing in for another voice is kept under Amy's name, not that voice's
		const fallback = name(`pi:${DEFAULT_VOICE}`);
		if (existsSync(fallback) && !server()) return fallback;
		const made = (await synth(text, `${file}.tmp`, voice, speed)) || voice === DEFAULT_VOICE ? file : fallback;
		renameSync(`${file}.tmp`, made);
		trimCache();
		return made;
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
let stopped = false;
let queue: Promise<void> = Promise.resolve();

/** What is being said right now (null: nothing). */
export const speaking = () => current;

/** Stop talking straight away. */
export function stopSpeaking() {
	if (current) stopped = true;
	player?.kill();
}

function play(wav: string) {
	return new Promise<void>((done) => {
		// plughw: plays the voice at its own rate (22 kHz), which sounds cleanest
		const p = spawn('aplay', ['-q', '-D', `plughw:${CARD}`, wav], { stdio: 'ignore' });
		player = p;
		p.on('exit', () => done());
		p.on('error', () => done());
	});
}

/**
 * Say this (one thing at a time: a new request waits for the one before).
 * Resolves when it has finished (or was stopped).
 */
export function say(text: string): Promise<void> {
	const job = async () => {
		await setUpMixer();
		// sentence by sentence, each made while the one before plays
		let made: Promise<unknown> = Promise.resolve();
		const wavs = sentences(withoutEmoji(text)).map((s) => (made = made.then(() => wavFor(s))) as Promise<string>);
		for (const w of wavs) w.catch(() => {}); // a failure is reported where it's awaited
		if (!wavs.length) return;
		const first = await wavs[0];
		current = text;
		stopped = false;
		try {
			// the speakers only open once there is something to say
			await amixer('Speaker', String(speakerLevel(getVoice().volume)));
			await play(first);
			for (const w of wavs.slice(1)) {
				if (stopped) break;
				const wav = await w;
				if (stopped) break;
				await play(wav);
			}
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
export const canListen = () => voiceOn() && (usesServer() || existsSync(resolve(STT_MODEL, 'model.bin')));
/** ...and the mic switched on in the quick menu (the AI part is checked separately) */
export const micOn = () => canListen() && getVoice().mic;

const RATE = 16000;
const FRAME_BYTES = (RATE * FRAME_MS) / 1000 * 2;
let recorder: ChildProcess | null = null;
let listeningId = '';
/** let go before the listening even started (a quick tap): don't start it */
const letGo = new Set<string>();

/** The 🎤 button was let go: the question ends, and what was heard so far is used. */
export function stopListening(id = '') {
	if (recorder && (!id || id === listeningId)) return void recorder.kill();
	if (id) {
		letGo.add(id);
		if (letGo.size > 10) letGo.delete(letGo.values().next().value!);
	}
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
 * `hold`: the kid holds the 🎤 button while talking, so only letting go
 * (stopListening(id)) ends it, not a pause; there are still time limits in
 * case the let-go never arrives.
 */
export async function listen(hint = '', { hold = false, id = '' } = {}): Promise<string> {
	if (recorder) throw new Error('Already listening');
	listeningId = id;
	stopSpeaking();
	await queue; // never listen while it's talking
	await setUpMixer();
	if (!server()) stt.start().catch(() => {}); // warm up while the kid talks
	const gate = new SpeechGate(hold ? { endSilenceMs: Infinity, noSpeechMs: 8000, maxMs: 20_000 } : {});
	const frames: Buffer[] = [];
	if (id && letGo.delete(id)) return '';
	try {
		await amixer('Speaker', '0');
		await amixer('Capture', 'cap');
		if (id && letGo.delete(id)) return '';
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
	const levels = `${frames.length} frames, speech above ${Math.round(gate.level)}, loudest ${Math.round(gate.loudest)}`;
	let from: number;
	// holding the button: all of it (kids talk straight away), but the mic's first click
	if (hold) from = gate.heardSomething ? 5 : -1;
	else if (gate.speechStart >= 0) from = Math.max(0, gate.speechStart - 15); // a little before the speech started
	else if (gate.heardSomething) {
		// stopped ("I'm done", or the time ran out) before it counted as speech: let speech to text decide
		console.log(`[voice] no clear speech, trying anyway (${levels})`);
		from = GATE_DEFAULTS.settleMs / FRAME_MS;
	} else from = -1;
	if (from < 0) {
		console.log(`[voice] heard nothing (${levels})`);
		return '';
	}
	const audio = Buffer.concat(frames.slice(from));
	return transcribe(Buffer.concat([wavHeader(audio.length), audio]), hint);
}

/** At server start: put the HAT in its quiet state and load the voice in the background. */
export function startVoice() {
	if (!voiceInstalled()) return;
	// with a voice server the Pi's own helpers stay unloaded (about 500 MB) until needed
	setUpMixer()
		.then(() => (getVoice().enabled && !usesServer() ? tts.start() : undefined))
		.then(() => console.log(`[voice] ready${usesServer() ? ` (voice server ${getAi().voiceUrl})` : ''}`))
		.then(() => (micOn() && !usesServer() ? stt.start() : undefined))
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
