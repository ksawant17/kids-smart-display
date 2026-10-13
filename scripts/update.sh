#!/usr/bin/env bash
# Update the dashboard from GitHub (the admin tab's "Update now" runs this):
#   1. git pull (fast-forward only: never touches local changes)
#   2. npm ci, if package-lock.json changed
#   3. build into build-next/ while the old copy keeps running
#   4. swap build-next/ -> build/ (the old one is kept as build-old/)
#   5. restart the server; systemd brings it back and the kiosk page reloads
#      itself when it sees the new version
# Progress goes to stdout (data/update.log when started from the admin tab).
set -uo pipefail
cd "$(dirname "$0")/.."

DATA=${DASHBOARD_DATA:-data}
LOCK="$DATA/update.lock"
mkdir -p "$DATA"
if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
	echo "FAILED: an update is already running"
	exit 1
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

step() { echo "== $*"; }
fail() { echo "FAILED: $*"; exit 1; }

step "Downloading the latest version"
before=$(git rev-parse HEAD)
git pull --ff-only 2>&1 || fail "couldn't download (no internet, or local changes in the way)"
after=$(git rev-parse HEAD)
if [ "$before" = "$after" ] && [ "${FORCE:-}" != 1 ]; then
	echo "DONE: already up to date ($(git log -1 --format='%h %s'))"
	exit 0
fi

if ! git diff --quiet "$before" "$after" -- package-lock.json; then
	step "Installing packages"
	npm ci --no-audit --no-fund 2>&1 || fail "npm ci failed"
fi

step "Building (takes a minute or two)"
rm -rf build-next
BUILD_OUT=build-next npm run build 2>&1 | tail -n 5
[ -f build-next/index.js ] || fail "the build failed; still running the old version"

step "Switching to the new version"
rm -rf build-old
mv build build-old && mv build-next build || fail "couldn't swap the build folders"
echo "DONE: updated to $(git log -1 --format='%h %s')"

# last: restart the server (this script runs inside its service, so it ends here too)
rm -f "$LOCK"
pid=$(systemctl show kids-smart-server -p MainPID --value 2>/dev/null)
if [ "${NO_RESTART:-}" != 1 ] && [ "${pid:-0}" -gt 0 ] 2>/dev/null; then
	kill "$pid"
else
	echo "(restart the server to use the new version)"
fi
