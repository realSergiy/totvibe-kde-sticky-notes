#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail

mode="--check"
files=()
for arg in "$@"; do
  case "$arg" in
    --check|--write) mode="$arg" ;;
    *) files+=("$arg") ;;
  esac
done

if [ "${#files[@]}" -eq 0 ]; then
  if [ -d package ]; then
    mapfile -t files < <(find package -type f -name '*.qml')
  fi
fi

if [ "${#files[@]}" -eq 0 ]; then
  echo "qml-format: no .qml files to format"
  exit 0
fi

if ! command -v qmlformat >/dev/null 2>&1; then
  echo "qml-format: qmlformat not on PATH; skipping (required from TIP 4 onwards)" >&2
  exit 0
fi

if [ "$mode" = "--check" ]; then
  fail=0
  for f in "${files[@]}"; do
    if ! diff -q "$f" <(qmlformat "$f") >/dev/null 2>&1; then
      echo "qml-format: would reformat $f"
      fail=1
    fi
  done
  exit "$fail"
else
  qmlformat -i "${files[@]}"
fi
