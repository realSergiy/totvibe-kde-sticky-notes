# Specs

- [`plan.md`](plan.md) — product + tech plan (the "what" and "why"). All sections `[DECIDED]`.
- Technical Implementation Plans (TIPs) — staged "how", each independently buildable and testable:
  - [`tip1.md`](tip1.md) — **Foundation & Tooling.** Repo scaffold, Bun, Biome, Lefthook, GitHub Actions, license, SPDX. Exit: green CI on an empty repo.
  - [`tip2.md`](tip2.md) — **Core Model Library** (`src/core/`). Pure-TS notes/positions/placement domain with ≥95% coverage. No Plasma yet.
  - [`tip3.md`](tip3.md) — **`sticky` CLI**. Single-file binary via `bun build --compile`, four commands, integration-tested against the on-disk dir.
  - [`tip4.md`](tip4.md) — **Plasma Widget (read-only)**. Installable plasmoid that renders a bound note's markdown with the v1 visual identity. No editing yet.
  - [`tip5.md`](tip5.md) — **Widget Interactivity**. Click-to-edit, save on blur/Esc, `QFileSystemWatcher`, position persistence, right-click delete.
  - [`tip6.md`](tip6.md) — **Daemon, Packaging, Release**. `sticky-watcherd` (inotify + plasmashell D-Bus), XDG autostart, install script, release-please tarball. Closes v1.

Each TIP states its own scope, deliverables, test plan, risks, and acceptance criteria. TIPs are sequential — each assumes its predecessors are merged and green.
