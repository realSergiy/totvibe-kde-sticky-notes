# Sticky Notes for KDE Plasma 6 — Plan

> **Status:** draft, in progress. Items marked `[OPEN]` await user decision; `[DECIDED]` are confirmed; `[PROPOSED]` is my recommendation pending sign‑off.
> **Last updated:** 2026‑04‑20

---

## 1. Vision

A native KDE Plasma 6 desktop sticky‑notes widget — lightweight, themed, draggable, persistent across sessions. App logic written in TypeScript for type safety; runtime is QML/JavaScript (the only language plasmashell loads for widgets).

## 2. Goals

- Feel native to Plasma: theming, contextual menu, configuration UI, KConfig persistence.
- Type‑safe app logic.
- Modern, fast dev/test loop with linting and automated checks in CI.
- Distributable as a standard Plasma 6 widget package.

## 3. Non‑goals (current scope)

- Mobile / Plasma Mobile support.
- Cross‑desktop‑environment support (GNOME, XFCE, …).
- Cloud sync as a first‑party feature.
- Standalone Qt application without the Plasma widget shell.

## 4. Target platform

- `[DECIDED]` KDE Plasma 6 (Qt 6, KF6, Kirigami).
- `[DECIDED]` Minimum Plasma version: **6.6** (released Feb 2026). Implies KF6 ≥ 6.21 and Qt ≥ 6.9. Stated as `X-Plasma-API-Minimum-Version: "6.6"` in `metadata.json`.
- `[DECIDED]` Linux only, **Wayland session only**. X11 sessions are out of scope for v1 — Plasma is increasingly Wayland‑first and we won't spend effort on X11 testing or edge cases.

## 5. Functional requirements

- `[DECIDED]` **Note granularity:** independent widgets — one widget instance = one note. Each note is created on the desktop and persists independently.
- `[DECIDED]` **Note creation paths:** (a) standard Plasma "Add widgets" gallery; (b) **CLI tool** `sticky <note text>` that creates a new note on the user's desktop containment.
- `[DECIDED]` **Drag behaviour:** notes are draggable via standard Plasma desktop widget movement (Plasma Edit Mode handle). v1 does not introduce a custom drag handle.
- `[DECIDED]` **Persistence model:** every note is serialised to its own file in a single user‑level directory. Default location `[PROPOSED]` `~/.local/share/totvibe-stickynotes/notes/` (XDG_DATA_HOME). Files are the source of truth; widget instance config holds only the note id (foreign key).
- `[DECIDED]` **Content type:** Markdown. View mode renders the markdown (bold, italics, lists, headings, links, inline code); edit mode shows the raw markdown source.
- `[DECIDED]` **Edit/view UX:** click anywhere on the note body to enter edit mode and place the cursor. Press `Esc` or click outside the note to leave edit mode; the note is persisted to disk on exit. A freshly created empty note auto‑enters edit mode so the user can start typing immediately.
- `[DECIDED]` **File format on disk:** plain markdown (`.md`), no frontmatter, no per‑note sidecar metadata file. The note's content IS the file. The id is the filename without `.md`. Other "metadata" we'd otherwise store is constant in v1 (colour, font) or implicit (timestamps via filesystem mtime/ctime).
- `[DECIDED]` **Files are the source of truth.** The notes directory is the application's state; widget instances are derivative views. External edits to any file (in `nano`, `vim`, `kate`, …) are picked up by the widget showing it. New files dropped into the directory cause new widgets to appear on the desktop. Deleted files cause their widgets to vanish.
- `[DECIDED]` **Position storage:** a single sidecar JSON file at `~/.local/share/totvibe-stickynotes/notes/.meta/positions.json` mapping `{ <id>: { x, y, width, height } }`. Chosen over Plasma's built‑in geometry persistence because Plasma's mechanism is keyed by its internal applet id (lost when the daemon respawns a widget for the same note). Bonus: positions sync along with notes via Syncthing. Viewport‑clamp on load to handle cross‑machine screen‑size differences.
- `[DECIDED]` **Initial placement (no recorded position yet):** cascade from the top‑left of the primary screen — each new note offset ~30 px down/right from the most recently spawned note, wrapping back to the top‑left when the cascade would run off‑screen. Default new‑note size: 240 × 200 px (user can resize via Plasma's standard widget resize handles).
- `[DECIDED]` **v1 visual identity (no per‑note customization).** All notes share a fixed pale yellow background, a handwriting‑style typeface that is easy to read at note sizes, and a deep ink‑blue text colour. Specific font and colour choices are recorded in §6. None of this is user‑configurable in v1 — customization is deferred to v2.
- `[DECIDED]` **v1 feature set: bare minimum.** Create (gallery + CLI), edit (click to enter edit mode, `Esc` or click‑outside to leave + persist), delete. **No** pin / always‑on‑top, **no** collapse, **no** quick‑capture global shortcut, **no** in‑note search, **no** tags, **no** reminders. All of these move to v2 or later.
- `[DECIDED]` **Delete UX:** the note's right‑click contextual menu gains a **"Delete this note"** entry that opens a confirmation dialog ("Delete this note? This will remove it from the desktop and erase its file."). On confirm: the widget instance is removed AND the underlying note file is erased. No archive, no trash. (Plasma's standard "Remove widget" action remains; if used it removes the widget and orphans the file — may revisit later if this confuses users.)
- `[DECIDED]` **CLI surface (v1):** four commands.
  - `sticky <text>` — create a new note containing `<text>`. CLI generates the filename.
  - `sticky -l` — list all notes (id and a truncated first line).
  - `sticky -d <id>` — delete the note with the given id (removes the file; the daemon then removes the widget).
  - `sticky -e <id> <text>` — replace the contents of the note with `<text>` (no `$EDITOR` invocation; the widget refreshes via its file watcher).
- `[DECIDED]` **Standalone floating window mode (v1): no.** Desktop‑widget mode is the only display mode in v1. May revisit in v3+ if users ask for an "open in window" option for full‑screen‑app workflows.
- `[DECIDED]` **i18n (v1): English only.** UI strings (right‑click menu, delete confirmation dialog, CLI `--help`) live as plain literals. Wiring `ki18n` later is a mechanical refactor; deferred to v2.

## 6. Architecture

- `[DECIDED]` Distributed as a Plasma 6 widget (Plasmoid) loaded by `plasmashell`, plus a small companion CLI binary `sticky`.
- `[DECIDED]` Runtime languages inside the widget: QML for views, JavaScript (ES module) for logic.
- `[DECIDED]` Source language for all app logic and the CLI: **TypeScript**, transpiled to ES‑module JS that QML files import as JS modules. CLI is shipped as a single executable (compilation strategy `[OPEN]` — depends on package‑manager choice).
- `[DECIDED]` **Storage backend:** plain markdown files on disk in `~/.local/share/totvibe-stickynotes/notes/`, one file per note. **Filename (sans `.md`) = note id.** Per‑note KConfig stores only the bound `noteId`. All other state lives either in the file (content), in `.meta/positions.json` (per‑note geometry), or as constants in v1 (colour, font). Notes are portable, syncable (Syncthing/Nextcloud/git), and editable in any text editor.
- `[DECIDED]` **CLI architecture:** the `sticky` CLI is a thin wrapper over filesystem operations on the notes directory. It does **not** talk to plasmashell. `sticky <text>` writes a new file; `sticky -d <id>` deletes a file; `sticky -e <id> <text>` rewrites a file; `sticky -l` reads the directory. All "appear / disappear / refresh on the desktop" behaviour is driven by the daemon (below) and by the widget's own file watcher.
- `[DECIDED]` **Daemon (`sticky-watcherd`, new component):** a small background process that runs on user session login (via XDG autostart, `~/.config/autostart/sticky-watcherd.desktop`). Watches the notes directory with inotify (Bun/Node `fs.watch`). On new file: looks up `.meta/positions.json` and calls plasmashell's D‑Bus interface (`org.kde.plasmashell` → `evaluateScript`) to add a new widget instance bound to the new id at the recorded coordinates (or default placement). On file deletion: finds the widget bound to that id and removes it. On rename: handled as delete + create. Daemon shipped as a single executable alongside the CLI.
- `[DECIDED]` **Widget‑side file watcher:** each widget instance uses Qt's `QFileSystemWatcher` (exposed to QML) to watch its own note file. On change, it re‑reads the file and updates the displayed text/markdown. Avoids stale view if the user edited externally.
- `[DECIDED]` **Position persistence (impl):** the widget writes its `(x, y, width, height)` to `.meta/positions.json` (debounced, ~500 ms) on every geometry change. The daemon reads this file when spawning a widget. On read, geometries are clamped to the current screen bounds.
- `[DECIDED]` **Note id generation (CLI side):** filenames generated as `<YYYY‑MM‑DD>-<HHMMSS>-<4‑hex>.md`, e.g. `2026-04-20-133412-7f2a.md`. Stable, sortable, low‑collision, human‑readable in `sticky -l` output. Users may freely `mv` any file; the watcher treats rename as delete‑then‑create.
- `[DECIDED]` **Markdown rendering:** Qt's native `TextEdit.MarkdownText` text format (built into Qt 6) for v1 — zero JS dependencies, native Qt rendering, CommonMark‑ish subset. v2 may swap to a JS library (`markdown-it`) if GitHub Flavoured Markdown extras (tables, footnotes, task list checkboxes) are required.
- `[DECIDED]` **Typeface:** **Caveat** (SIL OFL 1.1, ~50 KB regular weight; very readable handwriting style). Bundled inside the plasmoid package at `package/contents/fonts/Caveat-Regular.ttf` and loaded via QML `FontLoader` so it works regardless of system fonts. Fallback chain: `"Caveat", "Patrick Hand", "Comic Sans MS", sans-serif`. Body size scales with Plasma's font factor; baseline ~16 px.
- `[DECIDED]` **Colour palette (v1, baked in):** background `#FFF8B8` (pale yellow paper), text `#1F3A93` (deep ink blue), 1‑px border `#E8DC8A` (slightly darker than background) for a paper edge. No user override in v1.
- `[DECIDED]` Auto‑generated `.d.ts` stubs from the KConfigXT schema (`config/main.xml`) and any QML singletons we expose, so the TS layer types its QML‑facing APIs. Generator script lives in `tools/gen-types.ts`, runs as a build step before `bun build`.
- `[DECIDED]` **No C++/QML plugin in v1.** Pure QML + JavaScript (compiled from TypeScript) is sufficient for the MVP. Reconsider only if a needed primitive (e.g. tray binding, KGlobalAccel) requires it in v2+.

## 7. Tech stack

- `[DECIDED]` TypeScript for all app logic.
- `[DECIDED]` Package manager: **Bun** (dev‑only dependency; end users install the plasmoid as a normal KDE package).
- `[DECIDED]` Build tool: **Bun's built‑in transpiler/bundler** for both the widget's JS modules and the single‑file CLI / daemon executables (`bun build --compile`).
- `[DECIDED]` Linter + formatter: **Biome** (single Rust binary, one config file `biome.json`, includes import sorter). Aligns with the Bun single‑tool ethos.
- `[DECIDED]` Test runner: **`bun test`** (Jest‑compatible API, fast). Property‑based tests on the model layer via **`fast-check`**.
- `[DECIDED]` QML tooling: official Qt 6 toolchain — **`qmllint`** (lint), **`qmlformat`** (format), **`qmlls`** (LSP for editor support), **`qmltestrunner`** (component tests). All four wired into pre‑commit and CI.
- `[DECIDED]` Pre‑commit hooks: **Lefthook** (`lefthook.yml` at repo root). CI: **GitHub Actions** running on a `kdeneon/plasma:user` (or equivalent) container — lint (`biome check`, `qmllint`, `qmlformat --check`), type‑check (`tsc --noEmit`), test (`bun test`, `qmltestrunner`), build (widget package + CLI binary + daemon binary), and **release‑please** on `main` branch pushes.
- `[DECIDED]` Versioning / release: **Conventional Commits** + **release‑please** (auto CHANGELOG generation, semver bumps, GitHub releases driven by commit messages).
- `[DECIDED]` License: **GPL‑3.0‑or‑later** (KDE‑canonical for plasmoids and applications). `LICENSE` file at repo root + SPDX header `SPDX-License-Identifier: GPL-3.0-or-later` in every source file (enforced by Biome / a small REUSE check in CI).
- `[DECIDED]` KDE plugin id: **`com.totvibe.stickynotes`** (used in `metadata.json` `KPlugin.Id` and as the install directory under `~/.local/share/plasma/plasmoids/`).
- `[DECIDED]` CLI and daemon binary distribution: single‑file native executables via **`bun build --compile`** (~50 MB each, no Node runtime required on the user's machine).

## 8. Repository layout

- `[DECIDED]` Single package. `src/widget/` holds widget TypeScript; `src/cli/` holds CLI TypeScript; `src/daemon/` holds the watcher daemon TypeScript; `src/core/` holds shared note model + file I/O + plasmashell D‑Bus client + positions store. `package/` holds the installable Plasma package (with `metadata.json`, `contents/ui/*.qml`, `contents/config/*.xml`, `contents/js/*.js`, `contents/fonts/Caveat-Regular.ttf`). `tools/` holds build helpers (`gen-types.ts`). `spec/` holds plan and design docs. The build copies QML and emits compiled JS into `package/contents/js/`, the CLI binary into `dist/sticky`, the daemon binary into `dist/sticky-watcherd`. At runtime, notes live at `~/.local/share/totvibe-stickynotes/notes/*.md` with positions sidecar at `~/.local/share/totvibe-stickynotes/notes/.meta/positions.json`.

## 9. Build / test / release pipeline

- `[DECIDED]` Concrete tools resolved: **Bun** (run/build/test/install), **Biome** (lint + format), **Qt 6 toolchain** (`qmllint`, `qmlformat`, `qmltestrunner`, `qmlls`), **`tsc`** (`--noEmit` for strict type‑check), **`kpackagetool6`** (Plasma package install), **Lefthook** (pre‑commit), **GitHub Actions** (CI), **release‑please** (release automation), **`fast-check`** (property‑based tests), **`plasmoidviewer`** (manual smoke‑test).
- Skeleton:
  1. Lint TS (Biome / ESLint+Prettier) and QML (`qmllint`, `qmlformat`).
  2. Type‑check (`tsc --noEmit`).
  3. Unit‑test the TS model layer.
  4. Component‑test QML with `qmltestrunner`; manual smoke via `plasmoidviewer -a .`.
  5. Build:
     - transpile `src/widget/**/*.ts` + `src/core/**/*.ts` → `package/contents/js/**/*.js` (ES modules, no bundler).
     - build CLI: bundle `src/cli/**/*.ts` + `src/core/**/*.ts` into a single `dist/sticky` binary.
     - build daemon: bundle `src/daemon/**/*.ts` + `src/core/**/*.ts` into a single `dist/sticky-watcherd` binary.
  6. Package: `kpackagetool6 --type Plasma/Applet --install package/` for the widget; `dist/sticky` → `~/.local/bin/sticky`; `dist/sticky-watcherd` → `~/.local/bin/sticky-watcherd`; install `~/.config/autostart/sticky-watcherd.desktop` so the daemon runs on login. Tarball for KDE Store / GitHub release contains all three plus the autostart `.desktop` file and the install script.
  7. CI: GitHub Actions on a Plasma 6 container — lint, type‑check, test, build artifacts (widget package + CLI binary + daemon binary).

## 10. Roadmap (high‑level, subject to revision)

- **v1 (MVP)** — minimal but polished sticky note: markdown editing (click to edit, `Esc`/click‑outside to save), pale yellow paper background, **Caveat** handwriting typeface in deep ink‑blue, plain `.md` files in `~/.local/share/totvibe-stickynotes/notes/` as the source of truth, geometries in `.meta/positions.json` (synced with the notes), drag and resize via Plasma, delete via right‑click menu with confirmation, bidirectional sync with the directory (external edits update widgets; new files spawn widgets; deleted files remove widgets) via the `sticky-watcherd` daemon autostarted on login, and a `sticky` CLI with four commands (`<text>`, `-l`, `-d <id>`, `-e <id> <text>`). No pin, collapse, search, tags, reminders, or quick‑capture in v1.
- **v2** — visual customization (per‑note colour picker + presets, per‑note font family/size, optional opacity), content extras (checklists, GitHub‑Flavoured Markdown via JS markdown lib if needed), cross‑note search/tags, file‑watcher for external edits.
- **v3** — reminders, sync helpers, import/export, theming presets at desktop scope.

## 11. Open questions (rolling log)

- **Q1.** Note granularity model — **answered.** Independent widgets, one instance = one note, files on disk, `sticky` CLI to spawn.
- **Q2.** Content type — **answered.** Markdown with edit/view toggle; rendered via Qt's native `TextEdit.MarkdownText`.
- **Q3.** Visual customization scope — **answered.** None in v1; fixed pale yellow background, uniform system font. All customization deferred to v2.
- **Q4.** v1 feature‑set tier — **answered.** Bare minimum: create, edit, delete. No pin, collapse, quick‑capture, search, tags, or reminders in v1. Edit UX is click‑to‑edit, `Esc`/click‑outside to save. Visual identity: pale yellow paper, **Caveat** handwriting font, deep ink‑blue text.
- **Q5.** Delete UX — **answered.** Right‑click → "Delete this note" with confirmation; removes both widget and file. Wayland‑only target locked in (X11 dropped).
- **Q6.** CLI scope for v1 — **answered.** `sticky <text>`, `sticky -l`, `sticky -d <id>`, `sticky -e <id> <text>`. Bigger architectural shift confirmed: **files are the source of truth**, filenames are ids, plain `.md` no frontmatter; bidirectional directory↔widget sync handled by a new `sticky-watcherd` daemon plus widget‑side `QFileSystemWatcher`; positions stored in `.meta/positions.json` sidecar (chosen over Plasma's built‑in geometry persistence so positions survive widget respawns and travel with the notes).
- **Q7.** Initial placement — **answered.** Cascade from top‑left of primary screen, ~30 px offset per new note, wrap on overflow. Default new‑note size: 240 × 200 px.
- **Q8.** Standalone floating window mode in v1 — **answered.** No. Desktop‑widget only.
- **Q9.** i18n in v1 — **answered.** English only; defer translatability to v2. *Auto‑decided alongside:* min Plasma version locked at **6.6**; **no C++/QML plugin in v1**.
- **Q10.** Package manager + build/test toolchain — **answered.** Bun single‑tool stack: install, transpile, bundle, test (`bun test` + `fast-check`), single‑file CLI/daemon via `bun build --compile`.
- **Q11.** TypeScript linter / formatter — **answered.** Biome. *Auto‑decided alongside:* official Qt QML toolchain (`qmllint`, `qmlformat`, `qmlls`, `qmltestrunner`); Conventional Commits + release‑please for versioning; KDE plugin id `com.totvibe.stickynotes`.
- **Q12.** License — **answered.** GPL‑3.0‑or‑later. SPDX headers in every source file; REUSE‑style check in CI.
- **Q13.** Pre‑commit hooks + CI host — **answered.** Lefthook + GitHub Actions on a Plasma 6 container.
- *Promoted from `[PROPOSED]` to `[DECIDED]`:* markdown rendering via Qt's `TextEdit.MarkdownText`; auto‑generated `.d.ts` stubs from KConfigXT schema; final repo structure in §8; concrete build/test tools listed in §9.
- **All sections now `[DECIDED]`. Plan ready for review and scaffolding.**
