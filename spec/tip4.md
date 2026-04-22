# TIP 4 — Plasma Widget (read-only skeleton)

> **Phase goal:** ship a working Plasma 6 widget (plasmoid) that can be installed via `kpackagetool6` and displays the content of an assigned note file — **read-only**, with correct fonts, colours, and markdown rendering. No editing, no file watcher, no deletion, no position persistence yet. This is the minimum viable widget on the desktop.

## 1. Scope

In:

- `package/metadata.json` — KDE plasmoid manifest (id `com.totvibe.stickynotes`, min Plasma 6.6, Wayland).
- `package/contents/ui/main.qml` — root `PlasmoidItem` that loads a note file by id and renders its markdown.
- `package/contents/config/main.xml` — KConfigXT schema with a single `noteId` string property.
- `package/contents/config/config.qml` — empty for v1 (no user-visible config page yet; decision was "no customisation in v1"). Skip unless KDE requires a placeholder.
- `package/contents/fonts/Caveat-Regular.ttf` — bundled font (SIL OFL 1.1). Licence file alongside.
- `package/contents/ui/StickyNote.qml` — the visual component (paper rectangle, FontLoader, TextEdit with `MarkdownText`).
- `package/contents/js/` — compiled JS from `src/widget/**/*.ts` + `src/core/**/*.ts`, ES-module imports into QML.
- `src/widget/` — widget-side TypeScript: `bootstrap.ts` (locates note id, reads file once, emits text to QML via a property proxy), `palette.ts` (single `const PALETTE = {...}`).
- `scripts/gen-types.ts` — generates `.d.ts` stubs from `main.xml`.
- Build pipeline: `bun run build:widget` transpiles TS to JS, copies QML/XML/fonts into a staged `package/` ready for `kpackagetool6 --install`.
- `qmllint` + `qmlformat --check` pass on all `.qml` files.
- Local smoke test: `plasmoidviewer -a package/`.
- Install script: `scripts/install-widget.sh` (wraps `kpackagetool6 --type Plasma/Applet --install package/`).

Out:

- Editing (TIP 5).
- File watcher (TIP 5).
- Position persistence (TIP 5).
- Delete menu (TIP 5).
- Gallery-create flow (TIP 5 or 6 — needs a first-note bootstrap when `noteId` is empty).
- Daemon (TIP 6).

## 2. Runtime behaviour (v1 read-only phase)

1. User drags the widget onto desktop via Plasma Edit Mode → "Add widgets".
2. On first load, `Plasmoid.configuration.noteId` is empty.
3. **TIP 4 fallback:** widget shows placeholder text `"No note bound — set Plasmoid.configuration.noteId manually or wait for TIP 5 gallery-create wiring."` (This is the only code path that displays placeholder text; it is removed in TIP 5.)
4. If `noteId` is set (e.g. by editing the applet config via `~/.config/plasma-org.kde.plasma.desktop-appletsrc`), widget reads `notesDir()/<id>.md` once and renders its content via `TextEdit` with `textFormat: TextEdit.MarkdownText`.
5. `readOnly: true`, `selectByMouse: true` — user can select-and-copy but not edit.

## 3. Visual spec (locked from plan §6)

- Shape: rounded rectangle, radius 6 px.
- Background: `#FFF8B8`.
- Border: 1 px `#E8DC8A`.
- Text colour: `#1F3A93`.
- Font family: `"Caveat"` loaded via `FontLoader { source: "../fonts/Caveat-Regular.ttf" }`. Fallback chain `"Caveat", "Patrick Hand", "Comic Sans MS", sans-serif`.
- Base font size: 16 px scaled by Plasma's `Kirigami.Units.fontMetrics` factor.
- Padding: 12 px around the text block.
- Drop shadow: subtle, consistent with Plasma's shadow model — lean on Kirigami where possible.

## 4. Widget module surface (compiled JS imported by QML)

```ts
// src/widget/bootstrap.ts
export interface BoundNote {
  id: string;
  content: string;
  missing: boolean;   // true if the file does not exist
}
export async function loadBoundNote(noteId: string): Promise<BoundNote>;

// src/widget/palette.ts
export const PALETTE = {
  background: "#FFF8B8",
  border: "#E8DC8A",
  text: "#1F3A93",
} as const;
```

QML side:

```qml
import "../js/bootstrap.js" as Bootstrap
import "../js/palette.js" as Palette
```

## 5. TypeScript → JS pipeline

- Input: `src/widget/**/*.ts` + `src/core/**/*.ts`.
- Output: `package/contents/js/**/*.js` (ES modules, no bundler, preserve module graph so QML `import` paths stay stable).
- Command: `bun build --target=browser --format=esm --outdir package/contents/js src/widget/main.ts` *or* a pair of `tsc --outDir` calls with `--module ESNext`. Prefer `tsc` here — simpler, no bundler surprises, since QML imports files one by one.
- **Important:** the QML engine's JS subset does not support `top-level await`. All async code must live inside functions that QML calls and awaits via `Promise.then`.

## 6. Type generation

`scripts/gen-types.ts`:

- Parses `package/contents/config/main.xml` (KConfigXT schema).
- Emits `src/widget/generated/configuration.d.ts`:

  ```ts
  declare namespace Plasmoid {
    interface Configuration {
      noteId: string;
    }
    const configuration: Configuration;
  }
  ```

- Runs as a `prebuild` step in `package.json`.

## 7. Test plan

### Lint / type

- `qmllint package/contents/ui/*.qml` passes.
- `qmlformat --check` passes.
- `tsc --noEmit` passes.

### Component tests (qmltestrunner)

- `package/contents/ui/tests/tst_StickyNote.qml`:
  - Given `noteId` empty → placeholder text visible.
  - Given `noteId` set + a fixture file on disk → rendered text contains the file content (after markdown stripping).

### Manual smoke

- `plasmoidviewer -a package/` launches the widget and it displays the fixture note. Screenshot captured, attached to the PR.
- `kpackagetool6 --type Plasma/Applet --install package/`; add widget on desktop; verify appearance matches the screenshot.

## 8. Implementation steps

1. Write `package/metadata.json` (plugin id, name, description, category "Utilities", Plasma API min 6.6, icon placeholder).
2. Write `main.xml` (KConfigXT) with the single `noteId` entry.
3. Write `gen-types.ts` and wire as `prebuild`.
4. Implement `src/widget/bootstrap.ts` + `palette.ts` against `src/core/` APIs.
5. Build pipeline: `bun run build:widget` → `tsc` outputs JS into `package/contents/js/`.
6. Download Caveat-Regular.ttf (SIL OFL 1.1) into `package/contents/fonts/`. Commit its `OFL.txt`.
7. Write `StickyNote.qml` (visual) and `main.qml` (root `PlasmoidItem` wiring noteId → StickyNote).
8. Write qmltestrunner tests.
9. Write `scripts/install-widget.sh`.
10. CI: add a job that runs `bun run build:widget`, `qmllint`, `qmlformat --check`, and qmltestrunner on the Plasma 6 container.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| `TextEdit.MarkdownText` renders poorly or ignores a CommonMark feature we need | confirm rendering of bold, italics, lists, headings, code spans against a fixture file. Fall-back plan is `markdown-it` bundled into the widget JS; keep that off-ramp documented. |
| QML JS engine rejects `async/await` in some Qt 6.x patches | keep all async helpers in TS files loaded via `import … as X`, and call them via `.then(...)` from QML (never `await` at top level in QML). |
| Plasma 6.6 gallery rejects our `metadata.json` schema | cross-check against `kdeneon/plasma:user` at build time in CI. |
| Caveat licence obligations missed | commit `OFL.txt` and add a line to `README.md` attributing the font. |

## 10. Acceptance criteria

- Widget installs via `kpackagetool6`, appears in the Plasma widget gallery.
- Dragged onto the desktop, it renders the Caveat font, correct palette, no errors in `journalctl -u plasma-plasmashell`.
- When `noteId` points to an existing fixture, the note markdown is rendered in view mode.
- All CI checks pass (`qmllint`, `qmlformat --check`, `tsc --noEmit`, `bun test`, qmltestrunner).

## 11. Done = ready for TIP 5

Widget is visible on the desktop and binds to a note id. TIP 5 adds editability and position persistence.
