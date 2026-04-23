set shell := ["bash", "-cu"]

alias t := test
alias tc := typecheck
alias l := lint
alias p := push
alias r := release

# show available recipes
default:
    @just --list

# run eslint, QML lint/format, and SPDX check (pass -f/--fix to auto-fix)
lint *flags:
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ " {{flags}} " == *" -f "* || " {{flags}} " == *" --fix "* ]]; then
        bun run lint:fix
        bun run qml:format:fix
    else
        bun run lint
        bun run qml:lint
        bun run qml:format
    fi
    bun run spdx

# run lint, then tsc typecheck
typecheck *flags: (lint flags)
    bun run typecheck

# run typecheck, then the test suite (bun + qml)
test *flags: (typecheck flags)
    bun run test
    bun run qml:test

# push branch and open/update PR; pass -r/--ready to mark ready and auto-merge into main
push *flags:
    #!/usr/bin/env bash
    set -euo pipefail
    branch="$(git branch --show-current)"
    if [[ "$branch" == "main" ]]; then
        echo "refusing to run on main" >&2
        exit 1
    fi
    ready=0
    if [[ " {{flags}} " == *" -r "* || " {{flags}} " == *" --ready "* ]]; then
        ready=1
    fi
    git push -u origin "$branch"
    if ! gh pr view --json number >/dev/null 2>&1; then
        if [[ "$ready" == "1" ]]; then
            gh pr create --base main --fill
        else
            gh pr create --base main --fill --draft
        fi
    elif [[ "$ready" == "1" ]]; then
        gh pr ready 2>/dev/null || true
    fi
    read -r pr_number url <<< "$(gh pr view --json number,url -q '"\(.number) \(.url)"')"
    if [[ "$ready" == "0" ]]; then
        echo "PR (draft): $url"
        exit 0
    fi
    echo "PR: $url"
    echo "waiting for checks..."
    gh pr checks "$pr_number" --watch --fail-fast
    gh pr merge "$pr_number" --squash --delete-branch

# bump version (major|minor|patch), tag, push, and create a GitHub release
release bump="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    case "{{bump}}" in
        major|minor|patch) ;;
        *) echo "bump must be major|minor|patch (got: {{bump}})" >&2; exit 1 ;;
    esac
    if [[ "$(git symbolic-ref --short HEAD)" != "main" ]]; then
        echo "release must be run on main" >&2
        exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "working tree not clean" >&2
        exit 1
    fi
    git pull --ff-only origin main
    current="$(bun -e 'console.log(require("./package.json").version)')"
    IFS='.' read -r maj min pat <<< "$current"
    case "{{bump}}" in
        major) maj=$((maj+1)); min=0; pat=0 ;;
        minor) min=$((min+1)); pat=0 ;;
        patch) pat=$((pat+1)) ;;
    esac
    new="${maj}.${min}.${pat}"
    tag="v${new}"
    echo "bumping ${current} -> ${new}"
    bun pm pkg set version="${new}"
    git add package.json
    git commit -m "chore(release): ${tag}"
    git tag -a "${tag}" -m "${tag}"
    git push origin main "${tag}"
    gh release create "${tag}" --generate-notes --title "${tag}"
