# totvibe-kde — Sticky Notes for KDE Plasma 6

A files-as-source-of-truth sticky notes app for KDE Plasma 6 (Wayland).

Notes live as plain Markdown files under `~/.local/share/totvibe-stickynotes/notes/`;
a small daemon and a Plasma widget make each one visible on the desktop.

## Status

Pre-1.0. See [`spec/plan.md`](spec/plan.md) for the product/tech plan and
[`spec/README.md`](spec/README.md) for the staged Technical Implementation
Plans (TIPs). This commit lands TIP 1 (Foundation & Tooling) only — no
application code yet.

## Build

```sh
bun install
bun run check
```

`bun run check` runs Biome lint, `tsc --noEmit`, the SPDX-header check, and
the Bun test suite.

QML lint/format are wired separately and only run when `.qml` files exist
(TIP 4 onwards):

```sh
bun run qml:lint
bun run qml:format
```

## License

GPL-3.0-or-later. See [`LICENSE`](LICENSE).

The Caveat font (bundled in TIP 4) is licensed under SIL OFL 1.1.
