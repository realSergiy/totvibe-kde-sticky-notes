set shell := ["bash", "-cu"]

alias t := test
alias tc := typecheck
alias l := lint
alias m := merge

default:
    @just --list

lint *flags:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ " {{flags}} " == *" -f "* || " {{flags}} " == *" --fix "* ]]; then
        bun x biome check --write .
        bash tools/qml-format.sh --write
    else
        bun x biome check .
        bash tools/qml-lint.sh
        bash tools/qml-format.sh --check
    fi

format:
    bun x biome format --write .

typecheck *flags: (lint flags)
    bun x tsc --noEmit

test *flags: (typecheck flags)
    bun test

spdx *args:
    bun run tools/check-spdx.ts {{args}}

qml-lint:
    bash tools/qml-lint.sh

qml-format:
    bash tools/qml-format.sh --check

merge:
    #!/usr/bin/env bash
    set -euo pipefail
    branch="$(git symbolic-ref --short HEAD)"
    if [[ "$branch" == "main" ]]; then
        echo "refusing to run on main" >&2
        exit 1
    fi
    git push -u origin "$branch"
    if gh pr view --json number >/dev/null 2>&1; then
        echo "PR already exists for $branch"
    else
        gh pr create --base main --fill
    fi
    gh pr merge --auto --squash --delete-branch
