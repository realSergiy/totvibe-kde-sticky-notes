# TIP 5 — Widget Interactivity

> **Phase goal:** make the widget fully interactive on its own — without the daemon. Editing, persistence-on-save, file-watching for external changes, position persistence, and right-click delete with confirmation. After this TIP, a single widget pinned to one fixed `noteId` is a complete sticky note. The daemon (TIP 6) automates *creation* of widget instances; this TIP makes *each* widget production-ready.

## 1. Scope

In:

- Click-to-edit / Esc-to-leave / click-outside-to-leave UX.
- Auto-save on leaving edit mode (and on widget destruction).
- Markdown view ↔ raw edit toggle (view = `TextEdit.MarkdownText`, edit = plain text).
- `QFileSystemWatcher` integration: external edits update the widget's content live.
- Position persistence: write `(x, y, width, height)` to `.meta/positions.json` on geometry change (debounced 500 ms via `src/core/positions-store`).
- Right-click contextual menu: "Delete this note" → confirmation dialog → deletes file (Plasma daemon despawns the widget once TIP 6 lands; until then, the widget hides itself and KConfig clears).
- New-empty-note auto-enter-edit-mode behaviour.
- qmltestrunner coverage for the new states.
- Manual smoke-test checklist in PR.

Out:

- Daemon-driven create/spawn/despawn (TIP 6).
- Per-note customisation (deferred to v2).
- Multi-note search (deferred).

## 2. UX state machine

```text
┌──────────┐  click body / hotkey   ┌──────────┐
│   VIEW   │ ─────────────────────► │   EDIT   │
│ markdown │ ◄───── Esc ─────────── │ raw text │
│ rendered │ ◄── click outside ──── │ TextArea │
└──────────┘                        └──────────┘
       ▲                                  │
       │  (writeNote on transition)       │
       └──────────────────────────────────┘
```

- View mode: `TextEdit { textFormat: TextEdit.MarkdownText; readOnly: true; selectByMouse: true }`.
- Edit mode: `TextArea { textFormat: TextEdit.PlainText; focus: true; cursorPosition: <where the click landed> }`.
- Transition VIEW→EDIT: clicking anywhere on the body (not the chrome). Cursor placement uses `positionAt(mouseX, mouseY)` mapped from the rendered text to the raw markdown — *fallback:* place at end if mapping is unreliable.
- Transition EDIT→VIEW: pressing Esc (`Keys.onEscapePressed`); or losing focus to a click outside the widget (`onActiveFocusChanged`); or widget being destroyed.
- On transition EDIT→VIEW: call `writeNote(id, text)` from `src/core/`.
- Empty-note bootstrap: if `content === ""` on first load, start in EDIT mode.

## 3. File watcher integration

- One `QFileSystemWatcher` per widget instance, watching exactly its own note file.
- On `fileChanged`:
  - If widget is in VIEW mode → re-read file, replace displayed text.
  - If widget is in EDIT mode → **do not clobber the user's in-progress edit.** Stash the new on-disk content in a "stale" marker; show a small unobtrusive badge ("file changed externally — discard your edits to reload"). On EDIT→VIEW transition, prefer the user's edits (they win), then drop the badge.
- File deletion: widget hides itself and clears `noteId` from its KConfig. (Daemon will remove the applet instance once TIP 6 lands; this is the read-side cleanup until then.)
- Debounce noisy editors: collapse `fileChanged` bursts within 100 ms.

## 4. Position persistence

- Wire `Plasmoid.x`, `Plasmoid.y`, `width`, `height` change handlers to `positionsStore.upsert(noteId, { x, y, width, height })`.
- `positionsStore` is the singleton from TIP 2; instantiated once per widget process. The store debounces to 500 ms — meaning the user can drag freely and we write at most twice per second.
- On `Component.onDestruction`: `positionsStore.flush()` to guarantee final position is on disk.
- On widget `Component.onCompleted`: read positions, apply geometry to widget. If no entry, leave Plasma's default placement (cascade math is the daemon's job in TIP 6).

## 5. Delete UX

- Right-click on the note shows the standard Plasma context menu plus a custom action: **"Delete this note"** (icon `edit-delete`).
- Action handler opens `Kirigami.PromptDialog` (or `MessageDialog`):
  - Title: "Delete this note?"
  - Body: "This will remove it from the desktop and erase its file."
  - Buttons: **Delete** (destructive, default-no-focus) and **Cancel** (default focus).
- On **Delete**:
  - `await deleteNote(noteId)` from `src/core/`.
  - `positionsStore.remove(noteId); await positionsStore.flush()`.
  - Hide the widget. (TIP 6's daemon will fully despawn the applet via D-Bus on the file-deletion event.)

## 6. Test plan

### qmltestrunner

- `tst_EditFlow.qml`:
  - Click body → cursor visible, edit mode entered.
  - Type "x" → Esc → file content equals previous + "x".
  - Type "y" → click outside (simulated) → file content updated.
- `tst_FileWatcher.qml`:
  - VIEW mode + external write to file → widget text updates.
  - EDIT mode + external write → "stale" badge appears, edits not clobbered.
  - VIEW mode + external delete → widget hides.
- `tst_DeleteDialog.qml`:
  - Right-click → menu shows "Delete this note".
  - Click → dialog opens.
  - Confirm → `deleteNote` called once, widget hidden.
  - Cancel → no I/O.
- `tst_Position.qml`:
  - Move widget → after 600 ms, `positions.json` contains expected coordinates.
  - Destruction → `flush` called, last position present.

### Bun unit tests

- New helpers in `src/widget/` are testable in isolation against tmp dirs.

### Manual smoke checklist (PR template)

- [ ] Drag widget onto desktop, type text, Esc → reload Plasma → text preserved.
- [ ] Open the underlying `.md` in `kate`, change it, save → widget updates.
- [ ] `rm` the underlying file → widget vanishes.
- [ ] Move widget around the desktop, re-login → position preserved.
- [ ] Right-click → Delete → Cancel → nothing happens.
- [ ] Right-click → Delete → Confirm → file gone, widget gone.

## 7. Implementation steps

1. Refactor `StickyNote.qml` from TIP 4 into a state machine (a `StateGroup` or mode property + two child views).
2. Add `Keys.onEscapePressed` and `onActiveFocusChanged` handlers.
3. Add `writeNote` call on EDIT→VIEW.
4. Bridge `QFileSystemWatcher` into QML (use `Qt.labs` or expose via a tiny QML JS helper — research first; if `Qt.labs.platform` doesn't expose it cleanly we may need a pure-QML poller, ~2 s interval, accepted as v1 fallback).
5. Wire `positionsStore` instantiation in `bootstrap.ts`; expose `upsert` / `remove` / `flush` to QML via JS bindings.
6. Add geometry change handlers in `main.qml`.
7. Implement delete menu + dialog in `main.qml`.
8. Write the new qmltestrunner tests.
9. Update CI to run them.
10. Update README screenshot section.

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| `QFileSystemWatcher` not directly exposed to QML in Plasma 6.6 | fall back to a 2 s polling timer that compares `mtime`; document the trade-off. Replace with native watcher if a Qt singleton becomes available in 6.7+. |
| Cursor-position mapping from markdown-rendered click to raw markdown source is ambiguous | fall back to placing the cursor at end-of-text on click; revisit in a v1.x patch if users complain. |
| `Kirigami.PromptDialog` unavailable on Plasma 6.6 stable | use `MessageDialog` from `QtQuick.Dialogs`. |
| Plasma applet "Remove widget" still leaves an orphan file | document this in README; add a v1.x telemetry-free check that warns in `journalctl` when an applet is removed without our delete dialog. |

## 9. Acceptance criteria

- All qmltestrunner tests pass.
- Manual smoke checklist all-checked in PR.
- After TIP 5 merges, a power user can: install widget, hand-write a `.md` file, point the widget's `noteId` config at it, edit it from either side, see live updates, save positions across sessions, and delete via right-click.

## 10. Done = ready for TIP 6

Each individual widget is a fully working sticky note. TIP 6 automates lifecycle (create/spawn/despawn) so users don't have to hand-edit `appletsrc`.
