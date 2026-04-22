#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  if [ -d package ]; then
    mapfile -t files < <(find package -type f -name '*.qml')
  else
    files=()
  fi
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "qml-lint: no .qml files to lint"
  exit 0
fi

if ! command -v qmllint >/dev/null 2>&1; then
  echo "qml-lint: qmllint not on PATH; skipping (required from TIP 4 onwards)" >&2
  exit 0
fi

qmllint "${files[@]}"
