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
