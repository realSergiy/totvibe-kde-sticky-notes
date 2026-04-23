#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v kpackagetool6 >/dev/null 2>&1; then
  echo "install-widget: kpackagetool6 not on PATH (install plasma-workspace or libkf6package-bin)" >&2
  exit 1
fi

bun run build:widget

mode="--install"
if kpackagetool6 --type Plasma/Applet --show com.totvibe.stickynotes >/dev/null 2>&1; then
  mode="--upgrade"
fi

kpackagetool6 --type Plasma/Applet "$mode" package/
echo "install-widget: $mode complete (com.totvibe.stickynotes)"

env_dir="${XDG_CONFIG_HOME:-$HOME/.config}/plasma-workspace/env"
env_file="$env_dir/totvibe-stickynotes.sh"
mkdir -p "$env_dir"
cat > "$env_file" <<'EOF'
# SPDX-License-Identifier: GPL-3.0-or-later
# Allow the totvibe sticky-notes widget to read and write note files via
# QML's XMLHttpRequest. Required for in-place editing and persistence.
export QML_XHR_ALLOW_FILE_READ=1
export QML_XHR_ALLOW_FILE_WRITE=1
EOF
echo "install-widget: wrote $env_file (log out and back in to apply)"
