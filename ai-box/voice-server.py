"""
Voice server for the dashboard: speech to text and text to speech over HTTP,
for a stronger machine on the home network (see ai-box/README.md). The Pi
still records and plays through its HAT; it only sends the work here, and
falls back to its own helpers (scripts/stt-worker.py, tts-worker.py) when
this server can't be reached.

  GET  /health                      {"ok": true, "stt": "...", "tts": "..."}
  GET  /voices                      {"voices": [{"id", "name", "funny"}], "default": "amy"}
  POST /stt   body: WAV (16 kHz mono 16-bit), header X-Hint: names to spell
              -> {"text": "..."}
  POST /tts   body: {"text": "...", "voice": "amy", "speed": 1.0} -> audio/wav

Voices (VOICES below): Piper voices (fast, in VOICE_DIR) and Kokoro voices
(more natural, KOKORO_DIR), plus funny ones made from them with a pitch
change or a sound effect.

Every request except /health and /voices needs "Authorization: Bearer <VOICE_KEY>".
Nothing is saved: audio is decoded in memory and dropped after each request.

Settings (environment): VOICE_KEY, VOICE_PORT (8090), STT_MODEL (a
faster-whisper model dir), STT_DEVICE (cuda), VOICE_DIR (Piper voices),
KOKORO_DIR (kokoro-v1.0.onnx + voices-v1.0.bin).
"""
import hmac
import io
import json
import os
import threading
import time
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
from piper import PiperVoice, SynthesisConfig

KEY = os.environ.get("VOICE_KEY", "")
if len(KEY) < 16:
    raise SystemExit("VOICE_KEY must be set (at least 16 characters)")
PORT = int(os.environ.get("VOICE_PORT", "8090"))
STT_MODEL = os.environ.get("STT_MODEL", "/opt/kids-voice/whisper/small.en")
STT_DEVICE = os.environ.get("STT_DEVICE", "cuda")
VOICE_DIR = os.environ.get("VOICE_DIR", "/opt/kids-voice/voices")
KOKORO_DIR = os.environ.get("KOKORO_DIR", "/opt/kids-voice/kokoro")
DEFAULT_VOICE = "amy"

MAX_AUDIO = 2_000_000  # bytes: about a minute at 16 kHz, far longer than a question
MAX_TEXT = 2000

# id -> name, engine, model; funny ones add pitch (x higher, same talking speed) and/or an effect
VOICES = {
    "amy": dict(name="Amy", engine="piper", model="en_US-amy-medium"),
    "lessac": dict(name="Lessac", engine="piper", model="en_US-lessac-medium"),
    "holly": dict(name="Holly", engine="piper", model="en_US-hfc_female-medium"),
    "kristin": dict(name="Kristin", engine="piper", model="en_US-kristin-medium"),
    "jenny": dict(name="Jenny (British)", engine="piper", model="en_GB-jenny_dioco-medium"),
    "heart": dict(name="Heart", engine="kokoro", model="af_heart"),
    "bella": dict(name="Bella", engine="kokoro", model="af_bella"),
    "emma": dict(name="Emma (British)", engine="kokoro", model="bf_emma"),
    "puck": dict(name="Puck", engine="kokoro", model="am_puck"),
    "michael": dict(name="Michael", engine="kokoro", model="am_michael"),
    "chipmunk": dict(name="Chipmunk", engine="kokoro", model="af_bella", pitch=1.45, funny=True),
    "bear": dict(name="Big Bear", engine="kokoro", model="am_michael", pitch=0.72, funny=True),
    "robot": dict(name="Robot", engine="piper", model="en_US-lessac-medium", effect="robot", funny=True),
    "alien": dict(name="Space Alien", engine="kokoro", model="am_puck", pitch=1.25, effect="wobble", funny=True),
}

stt = WhisperModel(STT_MODEL, device=STT_DEVICE, compute_type="float16" if STT_DEVICE == "cuda" else "int8")
kokoro = Kokoro(f"{KOKORO_DIR}/kokoro-v1.0.onnx", f"{KOKORO_DIR}/voices-v1.0.bin")
piper: dict[str, PiperVoice] = {}  # loaded when first used
# one request at a time per model: they aren't safe to share between threads
stt_lock = threading.Lock()
tts_lock = threading.Lock()
NAMES = {"stt": os.path.basename(STT_MODEL), "tts": f"{len(VOICES)} voices"}


def transcribe(body: bytes, hint: str) -> str:
    with wave.open(io.BytesIO(body)) as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError("send 16 kHz mono 16-bit WAV")
        audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    with stt_lock:
        segments, _ = stt.transcribe(
            audio, language="en", beam_size=1, without_timestamps=True, initial_prompt=hint or None
        )
        return " ".join(s.text.strip() for s in segments).strip()


def make(v: dict, text: str, speed: float) -> tuple[np.ndarray, int]:
    """the voice's audio (floats, -1..1) and its sample rate"""
    if v["engine"] == "piper":
        voice = piper.get(v["model"]) or piper.setdefault(v["model"], PiperVoice.load(f"{VOICE_DIR}/{v['model']}.onnx"))
        chunks = list(voice.synthesize(text, syn_config=SynthesisConfig(length_scale=1 / speed)))
        if not chunks:
            return np.zeros(1, dtype=np.float32), 22050
        return np.concatenate([c.audio_float_array for c in chunks]), chunks[0].sample_rate
    audio, rate = kokoro.create(text, voice=v["model"], speed=speed, lang="en-gb" if v["model"][0] == "b" else "en-us")
    return audio, rate


def shift_pitch(audio: np.ndarray, factor: float) -> np.ndarray:
    """played back `factor` times faster: higher (and quicker, which make() made up for)"""
    return np.interp(np.arange(0, len(audio) - 1, factor), np.arange(len(audio)), audio).astype(np.float32)


def robot(audio: np.ndarray, rate: int) -> np.ndarray:
    t = np.arange(len(audio)) / rate
    ringing = audio * (0.45 + 0.55 * np.sin(2 * np.pi * 55 * t))  # the beep-boop buzz
    d = int(rate * 0.004)
    metal = ringing.copy()
    metal[d:] += 0.5 * ringing[:-d]  # a tiny echo sounds like a tin can
    return metal


def wobble(audio: np.ndarray, rate: int) -> np.ndarray:
    t = np.arange(len(audio)) / rate
    return audio * (0.75 + 0.25 * np.sin(2 * np.pi * 7 * t)) * (0.85 + 0.15 * np.sin(2 * np.pi * 120 * t))


def speak(text: str, voice: str, speed: float) -> bytes:
    v = VOICES.get(voice) or VOICES[DEFAULT_VOICE]
    pitch = v.get("pitch", 1.0)
    with tts_lock:
        # a higher voice is made slower first, so it ends up at the asked-for speed
        audio, rate = make(v, text, min(2.0, max(0.5, speed / pitch)))
    if pitch != 1.0:
        audio = shift_pitch(audio, pitch)
    if v.get("effect") == "robot":
        audio = robot(audio, rate)
    elif v.get("effect") == "wobble":
        audio = wobble(audio, rate)
    peak = float(np.max(np.abs(audio))) if len(audio) else 0
    if peak > 0.98:
        audio = audio * (0.98 / peak)
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((audio * 32767).astype(np.int16).tobytes())
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def reply(self, status: int, body: bytes, kind="application/json"):
        self.send_response(status)
        self.send_header("content-type", kind)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def error(self, status: int, message: str):
        self.reply(status, json.dumps({"error": message}).encode())

    def do_GET(self):
        if self.path == "/health":
            self.reply(200, json.dumps({"ok": True, **NAMES}).encode())
        elif self.path == "/voices":
            voices = [{"id": k, "name": v["name"], "funny": v.get("funny", False)} for k, v in VOICES.items()]
            self.reply(200, json.dumps({"voices": voices, "default": DEFAULT_VOICE}).encode())
        else:
            self.error(404, "not found")

    def do_POST(self):
        token = self.headers.get("authorization", "").removeprefix("Bearer ").strip()
        if not hmac.compare_digest(token.encode(), KEY.encode()):
            return self.error(401, "wrong key")
        size = int(self.headers.get("content-length") or 0)
        if size <= 0 or size > MAX_AUDIO:
            return self.error(413, "empty or too big")
        body = self.rfile.read(size)
        started = time.monotonic()
        try:
            if self.path == "/stt":
                text = transcribe(body, self.headers.get("x-hint", "")[:200])
                self.reply(200, json.dumps({"text": text}).encode())
            elif self.path == "/tts":
                req = json.loads(body)
                text = str(req.get("text", "")).strip()[:MAX_TEXT]
                if not text:
                    return self.error(400, "no text")
                speed = min(1.4, max(0.7, float(req.get("speed", 1.0))))
                self.reply(200, speak(text, str(req.get("voice") or DEFAULT_VOICE), speed), "audio/wav")
            else:
                return self.error(404, "not found")
        except (ValueError, wave.Error, json.JSONDecodeError) as err:
            return self.error(400, str(err))
        except Exception as err:  # noqa: BLE001 - report anything back to the Pi
            return self.error(500, str(err))
        print(f"{self.path} {time.monotonic() - started:.2f}s", flush=True)

    def log_message(self, *args):  # the per-request line above is enough
        pass


if __name__ == "__main__":
    # warm both models up so the first question is as quick as the rest
    speak("Hello.", DEFAULT_VOICE, 1.0)
    speak("Hello.", "heart", 1.0)
    with stt_lock:
        list(stt.transcribe(np.zeros(16000, dtype=np.float32), language="en")[0])
    print(f"voice server ready on :{PORT} ({NAMES['stt']} on {STT_DEVICE}, {NAMES['tts']})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
