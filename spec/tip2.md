# TIP 2 — Core Model Library

> **Phase goal:** ship `src/core/` — a pure-TypeScript, framework-free module that owns the entire notes-on-disk domain. Everything that follows (CLI, daemon, widget JS) imports from here. **No Plasma, no QML, no D-Bus** in this phase.

## 1. Scope

In:

- Note id generation (`<YYYY-MM-DD>-<HHMMSS>-<4-hex>.md`).
- Note model types (`NoteId`, `Note`, `Geometry`, `Position`, `NoteSummary`).
- Notes directory I/O: list, read, create, update, delete.
- Positions store: load, save (debounced + atomic), upsert, lookup, delete-by-id, viewport-clamp.
- Cascade placement algorithm.
- Pure helpers: filename ↔ id, summary line extraction (first non-empty line, stripped of markdown markers, truncated to N chars).
- Path resolution honouring `XDG_DATA_HOME` (default `~/.local/share/totvibe-stickynotes/notes/`).
- Comprehensive `bun test` unit tests + `fast-check` property tests.

Out:

- Watcher logic (TIP 6).
- Any process-level concerns (autostart, signals).
- D-Bus client (TIP 6).
- Anything UI-related.

## 2. Module surface (`src/core/index.ts` re-exports)

```ts
// types.ts
export type NoteId = string & { readonly __brand: "NoteId" };
export interface Geometry { x: number; y: number; width: number; height: number; }
export interface Note { id: NoteId; content: string; }
export interface NoteSummary { id: NoteId; firstLine: string; mtime: Date; }
export interface PositionsMap { [id: string]: Geometry; }

// paths.ts
export function notesDir(): string;
export function positionsFile(): string;
export function noteFilePath(id: NoteId): string;

// id.ts
export function generateNoteId(now?: Date, rng?: () => number): NoteId;
export function isNoteId(s: string): s is NoteId;
export function idFromFilename(filename: string): NoteId | null;

// notes-store.ts
export async function listNotes(): Promise<NoteSummary[]>;
export async function readNote(id: NoteId): Promise<Note>;
export async function writeNote(id: NoteId, content: string): Promise<void>;
export async function deleteNote(id: NoteId): Promise<void>;
export async function createNote(content: string, now?: Date): Promise<NoteId>;

// summary.ts
export function summaryLine(content: string, maxChars?: number): string;

// positions-store.ts
export interface PositionsStore {
  load(): Promise<PositionsMap>;
  upsert(id: NoteId, geom: Geometry): Promise<void>;
  remove(id: NoteId): Promise<void>;
  flush(): Promise<void>;          // force-write any debounced state
}
export function createPositionsStore(opts?: { debounceMs?: number }): PositionsStore;

// placement.ts
export function nextCascadePosition(
  taken: Geometry[],
  screen: { width: number; height: number },
  defaults?: { width: number; height: number; offset: number }
): Geometry;
export function clampToScreen(geom: Geometry, screen: { width: number; height: number }): Geometry;
```

## 3. Implementation notes

- **Atomic writes.** All disk writes use the temp-file + rename pattern (`writeFile(tmp); rename(tmp, target)`). Notes themselves AND `.meta/positions.json`. Avoids torn reads by daemon/widget watchers.
- **Positions debounce.** `createPositionsStore({ debounceMs: 500 })`. `upsert` updates an in-memory map and arms a timer; the timer flushes via atomic write. `flush()` is awaitable for shutdown paths.
- **Concurrency.** Two writers may race on `positions.json`. Use a per-process lock (in-memory) plus the atomic-rename pattern; if the temp filename includes pid + counter, parallel writers from the same process don't collide. Cross-process races are accepted (last-writer-wins); v1 has at most one writer per machine in practice (the focused widget).
- **Id format.** `2026-04-20-133412-7f2a` — generated from a `Date` and a 16-bit `Math.random()` source. Inject both for testability.
- **Filename validation.** `idFromFilename` rejects anything not matching `/^\d{4}-\d{2}-\d{2}-\d{6}-[0-9a-f]{4}\.md$/`. Foreign `.md` files in the dir are still listed (the daemon will spawn widgets for them) but get a synthesised id of the filename minus `.md` — *Q: do we accept arbitrary filenames as ids?* See §6.
- **Path resolution.** `notesDir()` reads `process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local/share")` then appends `totvibe-stickynotes/notes`. Auto-create on first write.
- **`.meta/`.** Lives inside `notes/`. Hidden so external "list my notes" tools that glob `*.md` ignore it. `listNotes` skips dotfiles and the `.meta` directory.

## 4. Test plan

### Unit (bun test)

- `id.test.ts`
  - generated id round-trips via `idFromFilename(generateNoteId() + ".md")`.
  - rejects malformed strings (wrong date, missing hex, extra dots).
- `summary.test.ts`
  - strips leading `#`, `*`, `-`, blockquote `>`, link syntax.
  - truncates with ellipsis at `maxChars`.
  - empty / whitespace-only content → `"(empty)"`.
- `notes-store.test.ts` (uses tmp dir via `bun test`'s `beforeEach`):
  - `createNote → listNotes → readNote` round-trip.
  - `deleteNote` removes file; subsequent `readNote` rejects with a typed error.
  - `writeNote` is atomic: simulate by introspecting that no `.tmp` lingers.
- `positions-store.test.ts`
  - debounce coalesces N rapid `upsert`s into one disk write (count fs writes).
  - `flush` writes pending state.
  - missing file → empty map.
  - corrupt JSON → empty map + warn (does not throw).
- `placement.test.ts`
  - first note → top-left at (0, 0) (or screen origin).
  - subsequent notes offset by `defaults.offset`.
  - wraps when next position would exceed screen.
  - `clampToScreen` keeps notes inside even when input is off-screen.

### Property (fast-check)

- For any sequence of `upsert`/`remove` ops, after `flush` the on-disk file matches the in-memory state.
- For any list of geometries, `nextCascadePosition` returns a geometry that does not exactly overlap an existing one (within reason — collisions allowed if the cascade fully wraps).
- For any string, `summaryLine` returns a string of length ≤ `maxChars` and never contains `\n`.

### Coverage target

- ≥ 95 % line coverage on `src/core/` (enforced via `bun test --coverage` threshold once Bun supports it; otherwise wire `c8`).

## 5. Implementation steps

1. Create `src/core/{types,paths,id,summary,notes-store,positions-store,placement,index}.ts`. SPDX header on each.
2. Add `tests/core/` mirroring the source layout.
3. Implement type-only files first (`types.ts`, `paths.ts`).
4. Implement `id.ts` + tests.
5. Implement `summary.ts` + tests.
6. Implement `notes-store.ts` + tests (atomic write helper lives here or in a small `fs-atomic.ts`).
7. Implement `positions-store.ts` + tests (debounce + atomic).
8. Implement `placement.ts` + tests.
9. Add fast-check properties.
10. Wire coverage threshold into CI's `check` script.

## 6. Open questions for this TIP

- **Q-T2-1.** Should `listNotes` include foreign-named `.md` files (e.g. `groceries.md` dropped in by hand)? **Recommendation:** yes — that is consistent with "files are the source of truth". Their id is the basename. The validating regex applies only to *generated* ids, not to *accepted* ids.
- **Q-T2-2.** Where does `tmp/` for atomic-write temp files live? Same dir as target (avoids cross-fs `rename`). Confirm OK on `~/.local/share` (always same fs in practice).

Defaults proceed unless the user objects.

## 7. Acceptance criteria

- `bun test src/core` is green.
- Coverage ≥ 95 % lines.
- `tsc --noEmit` is green.
- A small playground script (`scripts/playground-core.ts`) can `createNote("hello")`, `listNotes()`, `upsert` a position, and `flush` without error against `/tmp/totvibe-test/`.
- No `import` outside `node:*`, `bun:*`, `fast-check` (zero runtime deps in `src/core/`).

## 8. Done = ready for TIP 3

`src/core/` is a stable library other phases consume.
