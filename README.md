# totvibe-kde — Sticky Notes for KDE Plasma 6

A files-as-source-of-truth sticky notes app for KDE Plasma 6 (Wayland).

Notes live as plain Markdown files under `~/.local/share/totvibe-stickynotes/notes/`;
a small daemon and a Plasma widget make each one visible on the desktop.

## Status

Pre-1.0. See [`spec/plan.md`](spec/plan.md) for the product/tech plan and
[`spec/README.md`](spec/README.md) for the staged Technical Implementation
Plans (TIPs). Landed: TIP 1 (Foundation & Tooling), TIP 2 (Core Model
Library — `src/core/`), TIP 3 (`sticky` CLI — `src/cli/`), TIP 4 (read-only
Plasma widget skeleton — `package/`). Next: TIP 5.

## Build

```sh
bun install
just test
```

Recipes (via [`just`](https://github.com/casey/just)):

- `just l` — lint (Biome + QML + SPDX). `-f` to auto-fix.
- `just tc` — typecheck (runs `lint` first).
- `just t` — test (runs `typecheck` first).
- `just p` — push branch, open **draft** PR, print PR URL, exit.
- `just p -r` — mark PR ready (or create non-draft), arm squash auto-merge, wait for merge, delete remote + local branch.
- `just r [patch|minor|major]` — bump version, tag, publish GitHub release.

## Widget

```sh
bun run build:widget        # transpile TS to package/contents/js/, regenerate Plasmoid d.ts
bash scripts/install-widget.sh   # kpackagetool6 --install (or --upgrade) into ~/.local/share/plasma/plasmoids/
plasmoidviewer -a package/  # smoke-test without installing
```

## License

GPL-3.0-or-later. See [`LICENSE`](LICENSE).

The bundled [Caveat](https://github.com/googlefonts/caveat) font
(`package/contents/fonts/Caveat-Regular.ttf`) is © The Caveat Project Authors,
licensed under the SIL Open Font License 1.1 — see
[`package/contents/fonts/OFL.txt`](package/contents/fonts/OFL.txt).
