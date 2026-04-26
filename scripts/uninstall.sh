#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Reverses scripts/install.sh. Leaves notes untouched.
set -euo pipefail

bin_dir="${HOME}/.local/bin"
autostart_dir="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
env_dir="${XDG_CONFIG_HOME:-$HOME/.config}/plasma-workspace/env"

if pgrep -x sticky-watcherd >/dev/null 2>&1; then
  pkill -TERM -x sticky-watcherd || true
fi

rm -f "$bin_dir/sticky" "$bin_dir/sticky-watcherd"
rm -f "$autostart_dir/sticky-watcherd.desktop"
rm -f "$env_dir/totvibe-stickynotes.sh"

if command -v kpackagetool6 >/dev/null 2>&1; then
  if kpackagetool6 --type Plasma/Applet --show com.totvibe.stickynotes >/dev/null 2>&1; then
    kpackagetool6 --type Plasma/Applet --remove com.totvibe.stickynotes || true
  fi
fi

echo "uninstall: done. Notes at \$HOME/.local/share/totvibe-stickynotes/notes/ were left intact."
