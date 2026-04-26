#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Installs the widget, the CLI, and the watcher daemon for the current user.
set -euo pipefail

cd "$(dirname "$0")/.."

bin_dir="${HOME}/.local/bin"
autostart_dir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
desktop_src="packaging/sticky-watcherd.desktop"
desktop_dst="${autostart_dir}/sticky-watcherd.desktop"

for tool in bun kpackagetool6; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "install: required tool not on PATH: $tool" >&2
    exit 1
  fi
done

bun install --frozen-lockfile
bun run build:cli
bun run build:daemon

mkdir -p "$bin_dir" "$autostart_dir"
install -m 0755 dist/sticky "$bin_dir/sticky"
install -m 0755 dist/sticky-watcherd "$bin_dir/sticky-watcherd"
install -m 0644 "$desktop_src" "$desktop_dst"

bash scripts/install-widget.sh

if pgrep -x sticky-watcherd >/dev/null 2>&1; then
  pkill -TERM -x sticky-watcherd || true
  sleep 1
fi
nohup "$bin_dir/sticky-watcherd" >/dev/null 2>&1 &
disown || true

cat <<EOF
install: done.
  - widget:    com.totvibe.stickynotes (via kpackagetool6)
  - cli:       $bin_dir/sticky
  - daemon:    $bin_dir/sticky-watcherd  (running; autostart: $desktop_dst)
  - notes:     \$HOME/.local/share/totvibe-stickynotes/notes/
EOF
