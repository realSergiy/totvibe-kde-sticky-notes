# TIP 3 — `sticky` CLI

> **Phase goal:** ship the `sticky` CLI as a single-file native executable. The CLI is purely a thin wrapper over `src/core/` filesystem operations — it does **not** talk to plasmashell. Once installed, `sticky create <text>` writes a file; the daemon (TIP 6) and widget (TIPs 4–5) make it appear on the desktop. Until those land, the CLI is fully testable against the on-disk directory.

## 1. Scope

In:

- `src/cli/main.ts` entry point.
- Argument parsing for the four documented subcommands (via `cac`).
- Help / version output.
- Stable, machine-readable `--json` output mode for `list` (helps shell scripting and tests).
- `bun build --compile` producing `dist/sticky` (single static binary, ~100 MB — see Binary size below).
- Integration tests that spawn the binary against a temp `XDG_DATA_HOME`.
Out:

- D-Bus to plasmashell (intentionally — daemon owns that).
- `$EDITOR` invocation (CLI replaces content directly per spec).
- A subcommand to start/stop the daemon (TIP 6).
- Shell completions and man page (deferred post-v1 — both add surface area with no load-bearing value pre-v1; `sticky --help` already documents the surface).

## 2. Command surface

Subcommand-shaped (following `cac` conventions). Absolute simplicity trumps any particular flag shape:

```text
sticky create [text]      Create a new note containing <text>. Prints the new id.
                          If [text] is omitted, the note body is read from standard input.
sticky list [--json]      List all notes (id and truncated first line). --json for machine output.
sticky delete <id>        Delete the note with <id>. Removes file; daemon will despawn the widget.
sticky edit <id> [text]   Replace contents of <id> with <text>. Reads stdin if [text] is omitted.
sticky -h, --help         Show help.
sticky -V, --version      Show version (synced from package.json).
```

Behavioural rules:

- Exit code 0 on success, 1 on user error (unknown subcommand/option, unknown id, missing required arg), 2 on internal error.
- Either positional `[text]` or piped stdin supplies the note body — there is no `-` sentinel; omitting the positional reads from stdin directly (standard Unix idiom).
- All writes go through `src/core/` — CLI contains zero filesystem code of its own.
- `sticky` with no subcommand prints help and exits 1 (so a forgotten subcommand is an error, not a no-op).

## 3. Implementation notes

- **Argument parser.** Use [`cac`](https://github.com/cacjs/cac) (v7.x, ~8 KB, zero transitive deps). `cac` is subcommand-shaped, which is why the surface above is subcommand-shaped too — matching the library's grain removes ~200 lines of hand-rolled parsing and dispatch. Avoid `commander`/`yargs` (heavy, slow startup, awkward to compile).
- **Startup.** `bun build --compile --minify --target=bun-linux-x64 src/cli/main.ts --outfile dist/sticky`. Cold-start budget ≤ 50 ms on a 2026-class laptop; ≤ 100 ms on GitHub-hosted CI runners. Enforced as a real (failing) guard in CI, not an informational log line.
- **Binary size.** Bun's single-file compile output is the Bun runtime (~100 MB on 1.3.x) plus our ~10 KB bundle — the runtime is a hard floor, not something `--minify` can shrink. Ceilings: **soft 150 MB** (CI warns, humans investigate before release), **hard 200 MB** (CI fails). `strip` breaks the embedded-bundle trailer, so the binary cannot be post-processed. If the soft ceiling is ever breached by a Bun upgrade, the human raises the ceilings deliberately rather than silently accepting bloat.
- **Output.** Default human output for `list`:

  ```text
  2026-04-20-133412-7f2a  Buy milk
  2026-04-19-091205-b3d0  Refactor positions store…
  ```

  `list --json` output:

  ```json
  [{"id":"2026-04-20-133412-7f2a","firstLine":"Buy milk","mtime":"2026-04-20T13:34:12.000Z"}]
  ```

- **Error UX.** Unknown id → `sticky: no note with id 'xyz'` to stderr, exit 1. `cac`-originated errors (unknown subcommand, missing required arg, unknown option) are re-prefixed with `sticky: ` on stderr, exit 1.
- **Concurrency.** CLI is short-lived; no debounce concern. `createPositionsStore` is not used by the CLI at all — only the widget writes positions.

## 4. Test plan

### Unit (bun test, in-process)

- `commands.test.ts`: each command function (`runCreate`, `runList`, `runDelete`, `runEdit`) is called directly and asserts the right exit code + filesystem state in a tmp `XDG_DATA_HOME`. Argument parsing itself is not unit-tested — we trust `cac` and cover parser/dispatch behaviour via the integration suite.

### Integration (bun test, spawning the compiled binary)

- Build `dist/sticky` once in `beforeAll`.
- Cases:
  - `sticky create hello` → exit 0, file appears, stdout is the new id.
  - `sticky list` after creating 3 notes → 3 lines, sorted by mtime desc.
  - `sticky list --json` parses as JSON array of length 3.
  - `sticky delete <id>` → file is gone.
  - `sticky delete badid` → exit 1, error on stderr.
  - `sticky edit <id> "new content"` → file content equals "new content".
  - `echo "stdin note" | sticky create` → file content equals "stdin note".
  - `echo "piped" | sticky edit <id>` → file content equals "piped".
  - `sticky bogus` → exit 1 (unknown subcommand).

### Property (fast-check)

- For any sequence of `create`/`delete`/`edit` ops on random ids/texts, `sticky list --json` matches the in-memory expected state.

## 5. Implementation steps

1. Create `src/cli/{main,commands,output}.ts`. SPDX headers.
2. `bun add cac`.
3. Implement `commands.ts` (one function per subcommand: `runCreate`, `runList`, `runDelete`, `runEdit`; each takes an `IO` and typed args, returns `Promise<number>`) + tests.
4. Implement `main.ts` — wires `cac` subcommands → `commands.*` → exit code.
5. Add `bun run build:cli` script: `bun build --compile --minify src/cli/main.ts --outfile dist/sticky`.
6. Add CI step that builds the binary and runs the integration suite against it. Cache the binary as a workflow artifact.

## 6. Acceptance criteria

- `bun run build:cli` produces `dist/sticky` ≤ 200 MB (hard ceiling); CI warns above 150 MB (soft ceiling).
- All integration tests pass against the compiled binary.
- `dist/sticky --help` lists the four subcommands (`create`, `list`, `delete`, `edit`) plus `--help` / `--version`.
- `dist/sticky --version` prints a string containing the `package.json` version (`cac` decorates with runtime info, which is fine).
- Cold-start (`time dist/sticky --version`) ≤ 50 ms on dev machine; CI enforces a failing ≤ 100 ms guard (median of 5 runs).

## 7. Done = ready for TIP 4

CLI is the first end-user-visible artefact. Even before the widget ships, a power user could `sticky create "hello"` and inspect the file by hand. TIP 4 brings the desktop visible.
