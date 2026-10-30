# AI box: the dashboard's helpers on a stronger machine

The Pi runs the screen. A PC with an NVIDIA GPU on the same home network can
do the heavy work much faster:

| Service | Port | What it does | Pi setting (Grown-ups → AI Helper) |
|---|---|---|---|
| `kids-ai` | 8080 | llama.cpp serving Qwen3 14B (Q4_K_M), an OpenAI-style chat server | **Server** `http://<box>:8080`, **Key**, model `qwen3-14b` |
| `kids-voice` | 8090 | `voice-server.py`: Whisper `small.en` (GPU) listening, Piper Amy speaking | **Voice server** `http://<box>:8090`, **Key** |

The HAT still records and plays on the Pi. Only the question's recording and
the words to say travel to the box, over the home network, and nothing is kept.
If the box is off, the Pi falls back to its own helpers (slower) after one
failed try, and tries the box again a minute later.

Measured on an RTX 4060 Ti 16 GB, from the Pi 5:

| | On the Pi | On the box |
|---|---|---|
| Speech to text (short question) | 2.3 s (base.en) | 0.15 s (small.en) |
| Speaking one sentence | 1.0 s | 0.2 s |
| 🎤 Ask answer (AI) | – | 0.7–1.2 s |
| Bedtime story (AI) | – | ~8 s |

GPU memory: about 9.7 GB for the AI and 1 GB for Whisper.

## Setup (Debian/Ubuntu, NVIDIA driver installed)

```sh
# a user for both services
useradd --system --home /opt/kids-ai --shell /usr/sbin/nologin kids-ai
install -d -m 0750 -g kids-ai /etc/kids-ai
# one key per service (the Pi needs both)
(umask 027; echo "AI_KEY=$(openssl rand -hex 24)" > /etc/kids-ai/ai.env; echo "VOICE_KEY=$(openssl rand -hex 24)" > /etc/kids-ai/voice.env)
chgrp kids-ai /etc/kids-ai/*.env

# the AI: llama.cpp with CUDA (89 = RTX 40xx; drop the flag to detect it), and the model
mkdir -p /opt/kids-ai/models && cd /opt/kids-ai
git clone --depth 1 https://github.com/ggml-org/llama.cpp
cmake -S llama.cpp -B llama.cpp/build -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=89 -DLLAMA_CURL=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build llama.cpp/build -j --target llama-server
curl -L -o models/Qwen3-14B-Q4_K_M.gguf https://huggingface.co/Qwen/Qwen3-14B-GGUF/resolve/main/Qwen3-14B-Q4_K_M.gguf

# the voice: a venv with faster-whisper (+ the CUDA 12 libraries it needs) and Piper
python3 -m venv /opt/kids-voice/venv
/opt/kids-voice/venv/bin/pip install faster-whisper piper-tts nvidia-cublas-cu12 'nvidia-cudnn-cu12==9.*'
/opt/kids-voice/venv/bin/python -c 'from faster_whisper import download_model; download_model("small.en", output_dir="/opt/kids-voice/whisper/small.en")'
mkdir -p /opt/kids-voice/voices   # copy en_US-amy-medium.onnx and .onnx.json here (the same voice as the Pi)
cp voice-server.py /opt/kids-voice/

# the services (fix the python3.13 paths in kids-voice.service if your Python differs)
cp kids-ai.service kids-voice.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now kids-ai kids-voice
```

Both services only accept connections from `localhost` and `192.168.10.0/24`
(`IPAddressAllow=` in the unit files; change it to your network), and every
request needs its key. `curl http://<box>:8090/health` should answer
`{"ok": true, ...}`.
