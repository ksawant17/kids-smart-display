#!/usr/bin/env bash
# Kids Smart Dashboard — manual launcher (same as the two systemd units,
# for running by hand from a console when the services are not installed).
# Settings live in config/dashboard.json.
#
# Usage: ./start-dashboard.sh
set -euo pipefail

export NODE_ENV=production
export PORT="${PORT:-3000}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
export SEATD_SOCKET="${SEATD_SOCKET:-unix:path=/run/seatd.sock}"
NODE="${NODE:-$HOME/.local/share/pi-node/current/bin/node}"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# --- 1. Start the SvelteKit server (if not already running) ---
if curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
	echo "[start-dashboard] server already running on :${PORT}"
else
	echo "[start-dashboard] starting SvelteKit server…"
	LOG="${XDG_RUNTIME_DIR}/kids-smart-dashboard.log"
	"$NODE" build/index.js > "$LOG" 2>&1 &
	SERVER_PID=$!

	for _ in $(seq 1 20); do
		curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1 && break
		sleep 1
	done
	if ! curl -sf "http://localhost:${PORT}/" > /dev/null 2>&1; then
		echo "[start-dashboard] ERROR: server did not come up (see $LOG)" >&2
		exit 1
	fi
	echo "[start-dashboard] server up (pid ${SERVER_PID})"
fi

# --- 2. Launch the kiosk (same flags as systemd/kids-smart-kiosk.service) ---
echo "[start-dashboard] launching kiosk…"
exec cage -s -- chromium \
	--kiosk \
	--incognito \
	--ozone-platform=wayland \
	--force-device-scale-factor=1 \
	--enable-features=OverlayScrollbar \
	--no-first-run \
	--no-default-browser-check \
	--disable-pinch \
	--touch-events=enabled \
	--no-sandbox \
	--disable-gpu \
	--disable-dev-shm-usage \
	--disable-infobars \
	--disable-session-crashed-bubble \
	--disable-features=Translate \
	--start-maximized \
	"http://localhost:${PORT}"
