# TIP 6 — `sticky-watcherd` Daemon, Packaging & Release

> **Phase goal:** close the loop. Make the directory the actual source of truth: any `.md` file appearing in the notes dir auto-spawns a desktop widget; any deletion auto-despawns. Then turn the whole project into a single installable artefact and wire release-please / GitHub Releases. After this TIP, v1 is shippable to the KDE Store.

## 1. Scope

In:

- `src/daemon/main.ts` — long-lived process: inotify watcher + plasmashell D-Bus client + reconciliation loop.
- `src/core/dbus-plasmashell.ts` — typed wrapper over `org.kde.plasmashell.evaluateScript` (and a tiny vocabulary of QML snippets it sends).
- `bun build --compile` of the daemon → `dist/sticky-watcherd`.
- `~/.config/autostart/sticky-watcherd.desktop` — XDG autostart entry, installed by the install script.
- Reconciliation strategy (see §3): on startup, diff the notes dir against currently-running widgets and converge.
- Cascade-placement: when spawning a new widget for an unknown id, ask the daemon (not the widget) for the cascade position.
- `scripts/install.sh` — top-level installer that:
  - runs `kpackagetool6 --type Plasma/Applet --install package/`,
  - copies `dist/sticky` and `dist/sticky-watcherd` to `~/.local/bin/`,
  - installs the `.desktop` autostart file,
  - starts the daemon for the current session.
- `scripts/uninstall.sh` — clean reverse of install.
- `release-please` upgraded from "simple" to a multi-asset release: tarball with widget package + both binaries + install script + autostart.
- KDE Store metadata stub (`packaging/kde-store.txt`) ready for upload (manual step, not automated).
- End-to-end smoke test on the Plasma 6 container in CI: install everything, `sticky "test"`, screenshot the desktop, assert the screenshot is non-empty.

Out:

- v2 features.
- A systemd user service (XDG autostart is enough for v1 — revisit if reliability bites).
- Auto-update of the widget itself.

## 2. Daemon design

```text
                  ┌──────────────────────┐
                  │  sticky-watcherd     │
                  │  (single user proc)  │
                  └─────────┬────────────┘
                            │ inotify (Bun fs.watch on notes dir)
                            ▼
            ┌───────────────┴────────────────┐
            │ event router                    │
            │ - file added → spawnWidget(id)  │
            │ - file removed → despawn(id)    │
            │ - file renamed → despawn+spawn  │
            └───────────────┬────────────────┘
                            │ D-Bus method call
                            ▼
              org.kde.plasmashell.evaluateScript
                            │
                            ▼
                       plasmashell
```

- **Single instance.** Acquire a `~/.local/state/totvibe-stickynotes/daemon.pid` lock at startup; if held by a live process, exit 0 quietly.
- **Reconciliation on startup.**
  1. Query plasmashell via `evaluateScript`: enumerate all `com.totvibe.stickynotes` applets and read their `noteId` config.
  2. List `*.md` files in the notes dir.
  3. For each file with no matching applet → spawn.
  4. For each applet with no matching file → despawn.
  5. Save discovered position info into `.meta/positions.json` if missing (best-effort).
- **Spawn flow:**
  1. Read `positions.json` for `id`. If absent, compute cascade position via `nextCascadePosition` from `src/core/`.
  2. Build the QML script: add applet to `desktops()[currentScreen]`, set its `currentConfigGroup` to the new applet, write `noteId = <id>`, write geometry.
  3. Send via D-Bus.
- **Despawn flow:**
  1. Find the applet whose `noteId` equals `id`.
  2. Call `applet.action("remove").trigger()` (or equivalent in the QML scripting API).

## 3. D-Bus client

`src/core/dbus-plasmashell.ts`:

```ts
export interface PlasmashellClient {
  evaluateScript(qmlScript: string): Promise<string>;   // returns plasmashell's stdout
  enumerateStickyApplets(): Promise<{ appletId: number; noteId: string }[]>;
  spawnSticky(noteId: string, geom: Geometry): Promise<void>;
  despawnSticky(noteId: string): Promise<void>;
}

export function createPlasmashellClient(): PlasmashellClient;
```

- Underlying transport: `dbus-next` (pure JS) or `bun:ffi` to `libdbus-1`. Prefer `dbus-next` (zero native deps; works under `bun build --compile`).
- All QML snippets live in `src/core/dbus-plasmashell-snippets.ts` as constants. Snippets are short — a few lines each — and parameterised via JS string concatenation with strict id/coord sanitisation (id matches `/^[\w.\-]+$/`; coords coerced to `Number`).

## 4. Autostart `.desktop` file

```ini
[Desktop Entry]
Type=Application
Name=Sticky Notes Watcher
Exec=%h/.local/bin/sticky-watcherd
X-GNOME-Autostart-enabled=true
OnlyShowIn=KDE;
NoDisplay=true
StartupNotify=false
```

Installed by `scripts/install.sh` to `~/.config/autostart/`. The daemon starts on next login; install script also `nohup`s it for the current session.

## 5. Test plan

### Unit (bun test)

- `dbus-plasmashell.test.ts`:
  - QML snippets render with sanitised inputs.
  - Rejects malicious ids (`'); doSomethingNasty(); //`).
- `daemon-router.test.ts`:
  - Injectable `Watcher` and `PlasmashellClient` mocks.
  - File-add event → `spawnSticky` called once with correct geometry.
  - File-delete event → `despawnSticky` called once.
  - Rename event → both calls in order.
  - Reconciliation: given mock state of {files, applets}, the diff produces correct ops.

### Integration (CI on Plasma container)

Run inside `kdeneon/plasma:user` with a virtual X server / Wayland compositor:

1. Install everything via `scripts/install.sh`.
2. Start daemon.
3. `dist/sticky "hello from CI"`.
4. Wait ≤ 2 s.
5. Query plasmashell: assert exactly one `com.totvibe.stickynotes` applet exists with our note id.
6. Screenshot the desktop, assert pixel diff against a baseline (loose threshold — font rendering varies).
7. `dist/sticky -d <id>`.
8. Wait ≤ 2 s.
9. Assert applet count is now 0.

### Manual smoke

- Install on a real KDE Plasma 6.6 desktop.
- Reboot. Confirm daemon auto-starts (`pgrep sticky-watcherd`).
- Drop a hand-written `groceries.md` into the notes dir from a file manager. New widget appears.
- Edit it from `kate`. Widget updates live (TIP 5 wiring).
- `rm groceries.md`. Widget disappears.
- `sticky "from cli"`. Widget appears.
- Right-click → Delete → confirm. File gone, widget gone.

## 6. Implementation steps

1. Add `dbus-next` dep. Spike a minimal `evaluateScript` call from a Bun script to confirm `bun build --compile` keeps it working.
2. Implement `dbus-plasmashell.ts` + snippets + tests.
3. Implement `src/daemon/watcher.ts` (inotify wrapper around Bun `fs.watch`, normalises event types).
4. Implement `src/daemon/router.ts` (pure function: event + state → ops).
5. Implement `src/daemon/main.ts` (wires watcher → router → D-Bus client; pid lock; graceful shutdown).
6. Add `bun run build:daemon` (`bun build --compile --minify src/daemon/main.ts --outfile dist/sticky-watcherd`).
7. Write `scripts/install.sh`, `scripts/uninstall.sh`. Make them idempotent.
8. Update `release-please` to produce the multi-asset tarball: `totvibe-stickynotes-<version>.tar.gz` containing `package/`, `dist/sticky`, `dist/sticky-watcherd`, `scripts/install.sh`, `scripts/uninstall.sh`, `LICENSE`, `README.md`, `sticky-watcherd.desktop`.
9. Wire CI's release-please job to build the assets and attach them to the release.
10. Cut `v1.0.0`.

## 7. Risks

| Risk | Mitigation |
| --- | --- |
| `evaluateScript` is undocumented / unstable across Plasma 6.x | wrap every call in a `try/catch`, log on failure; integration test on minimum Plasma version (6.6) and a current one (6.7+ when available). |
| `dbus-next` doesn't bundle cleanly with `bun build --compile` | fall back to spawning `qdbus6 org.kde.plasmashell /PlasmaShell evaluateScript "$snippet"` as a subprocess. Slower but rock-solid; reserve as plan B. |
| Race between daemon spawn and widget's own first read of `positions.json` | daemon writes geometry into the QML snippet itself (`applet.x = …; applet.y = …`); widget's `positionsStore` then takes over post-spawn. |
| Hand-named files (`groceries.md`) appear with no recorded position | cascade placement applies in this case too; widget then writes its own position on first move. |
| `~/.config/autostart` not honoured on some KDE setups | document a one-liner systemd user service as a fallback in README. |

## 8. Acceptance criteria

- Fresh Plasma 6.6 install: run `scripts/install.sh`, log in, type `sticky "first"`, see widget within 2 s. Reboot, widget reappears in same place.
- All daemon unit tests pass.
- CI integration test on the Plasma container is green.
- `release-please` produces a `v1.0.0` GitHub release with the tarball attached.
- KDE Store upload metadata is filled in (manual upload step is left to the maintainer).

## 9. v1 complete

After TIP 6 merges and `v1.0.0` is tagged, the v1 roadmap from `spec/plan.md` §10 is delivered end-to-end. v2 work (per-note customisation, GFM, search/tags, file-watcher polish) begins under a new TIP set — `spec/tip7.md` onward — when scoped.
