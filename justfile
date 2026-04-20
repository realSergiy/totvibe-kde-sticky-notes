set shell := ["bash", "-cu"]

alias t := test
alias tc := typecheck
alias l := lint
alias m := merge
alias r := release

default:
    @just --list

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

typecheck *flags: (lint flags)
    bun run typecheck

test *flags: (typecheck flags)
    bun run test

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
