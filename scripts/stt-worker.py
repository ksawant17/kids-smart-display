"""
Speech to text for the dashboard (src/lib/server/voice.ts starts it).

Loads a faster-whisper model once, then reads one JSON request per line:
  {"wav": "/path/to/question.wav", "prompt": "Alex, Sam"}
(16 kHz, mono, 16-bit) and answers one JSON line: {"ok": true, "text": "..."}.
Everything runs on the Pi: no audio leaves the house.

Run with the voice venv's python: <venv>/bin/python stt-worker.py <model dir>
"""
import json
import sys
import wave

import numpy as np
from faster_whisper import WhisperModel

model = WhisperModel(sys.argv[1], device="cpu", compute_type="int8", cpu_threads=4)
print(json.dumps({"ok": True, "ready": True}), flush=True)

for line in sys.stdin:
    try:
        req = json.loads(line)
        with wave.open(req["wav"]) as w:
            audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
        segments, _ = model.transcribe(
            audio,
            language="en",
            beam_size=1,
            without_timestamps=True,
            # names it should know how to spell
            initial_prompt=req.get("prompt") or None,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
        print(json.dumps({"ok": True, "text": text}), flush=True)
    except Exception as err:  # noqa: BLE001 - report anything back to the server
        print(json.dumps({"ok": False, "error": str(err)}), flush=True)
