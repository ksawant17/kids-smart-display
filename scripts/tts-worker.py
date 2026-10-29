"""
Text to speech for the dashboard (src/lib/server/voice.ts starts it).

Loads a Piper voice once, then reads one JSON request per line on stdin:
  {"text": "Hello!", "out": "/path/to/file.wav"}
and answers one JSON line on stdout: {"ok": true} or {"ok": false, "error": "..."}.

Run with the voice venv's python: <venv>/bin/python tts-worker.py <voice.onnx>
"""
import json
import sys
import wave

from piper import PiperVoice, SynthesisConfig

voice = PiperVoice.load(sys.argv[1])
# normal speed: 1.08 (a touch slower) sounded sluggish on the kiosk
config = SynthesisConfig(length_scale=1.0)
print(json.dumps({"ok": True, "ready": True}), flush=True)

for line in sys.stdin:
    try:
        req = json.loads(line)
        with wave.open(req["out"], "wb") as wav:
            voice.synthesize_wav(req["text"], wav, syn_config=config)
        print(json.dumps({"ok": True}), flush=True)
    except Exception as err:  # noqa: BLE001 - report anything back to the server
        print(json.dumps({"ok": False, "error": str(err)}), flush=True)
