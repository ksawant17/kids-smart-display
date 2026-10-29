"""
Voice server for the dashboard: speech to text and text to speech over HTTP,
for a stronger machine on the home network (see ai-box/README.md). The Pi
still records and plays through its HAT; it only sends the work here, and
falls back to its own helpers (scripts/stt-worker.py, tts-worker.py) when
this server can't be reached.

  GET  /health                      {"ok": true, "stt": "...", "tts": "..."}
  POST /stt   body: WAV (16 kHz mono 16-bit), header X-Hint: names to spell
              -> {"text": "..."}
  POST /tts   body: {"text": "...", "length_scale": 1.0} -> audio/wav

Every request except /health needs "Authorization: Bearer <VOICE_KEY>".
Nothing is saved: audio is decoded in memory and dropped after each request.

Settings (environment): VOICE_KEY, VOICE_PORT (8090), STT_MODEL (a
faster-whisper model dir), STT_DEVICE (cuda), TTS_VOICE (a Piper .onnx).
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
from piper import PiperVoice, SynthesisConfig

KEY = os.environ["VOICE_KEY"]
PORT = int(os.environ.get("VOICE_PORT", "8090"))
STT_MODEL = os.environ.get("STT_MODEL", "/opt/kids-voice/whisper/small.en")
STT_DEVICE = os.environ.get("STT_DEVICE", "cuda")
TTS_VOICE = os.environ.get("TTS_VOICE", "/opt/kids-voice/voices/en_US-amy-medium.onnx")

MAX_AUDIO = 2_000_000  # bytes: about a minute at 16 kHz, far longer than a question
MAX_TEXT = 2000

stt = WhisperModel(STT_MODEL, device=STT_DEVICE, compute_type="float16" if STT_DEVICE == "cuda" else "int8")
tts = PiperVoice.load(TTS_VOICE)
# one request at a time per model: they aren't safe to share between threads
stt_lock = threading.Lock()
tts_lock = threading.Lock()
NAMES = {"stt": os.path.basename(STT_MODEL), "tts": os.path.basename(TTS_VOICE).removesuffix(".onnx")}


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


def speak(text: str, length_scale: float) -> bytes:
    out = io.BytesIO()
    with tts_lock, wave.open(out, "wb") as w:
        tts.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=length_scale))
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
                scale = min(1.4, max(0.7, float(req.get("length_scale", 1.0))))
                self.reply(200, speak(text, scale), "audio/wav")
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
    speak("Hello.", 1.0)
    with stt_lock:
        list(stt.transcribe(np.zeros(16000, dtype=np.float32), language="en")[0])
    print(f"voice server ready on :{PORT} ({NAMES['stt']} on {STT_DEVICE}, {NAMES['tts']})", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
