# TIP 1 — Foundation & Tooling

> **Phase goal:** stand up the repository skeleton, language toolchain, lint/format/test/CI pipelines, and licensing. **No application code.** Exit criterion is a green CI run on an empty-but-wired project.

## 1. Scope

In:

- Repo layout (`src/`, `package/`, `tools/`, `spec/`, `dist/`, `.github/workflows/`).
- Bun-based dev environment (`package.json`, lockfile, `bunfig.toml` if needed).
- TypeScript strict config (`tsconfig.json`).
- Biome lint + format config (`biome.json`).
- Qt 6 QML toolchain integration (`qmllint`, `qmlformat`).
- `tsc --noEmit` type-check job.
- Bun test runner with one placeholder test that asserts `1 + 1 === 2`.
- Lefthook pre-commit hooks (`lefthook.yml`).
- GitHub Actions workflow on a Plasma 6 container (`kdeneon/plasma:user` or similar) that runs lint, type-check, test.
- `LICENSE` (GPL-3.0-or-later), root `README.md` stub, SPDX header check.
- Conventional Commits enforcement (commitlint via Lefthook commit-msg hook).
- `release-please` config skeleton (no first release yet — no source files to release).
- `.gitignore`, `.editorconfig`.

Out:

- Any business logic.
- Plasma `metadata.json` (TIP 4).
- CLI / daemon / widget code.
- `bun build --compile` setup (TIP 3 introduces the first compiled binary).

## 2. Prerequisites

- Bun ≥ 1.2 installed locally.
- Qt 6 dev tools available locally for the developer (`qmllint`, `qmlformat`). CI provides them via the Plasma container.
- A GitHub repo `totvibe-kde` already exists (current working dir is the clone).

## 3. Deliverables

| Path | Purpose |
| --- | --- |
| `package.json` | name `@totvibe/stickynotes`, private, scripts: `lint`, `format`, `typecheck`, `test`, `qml:lint`, `qml:format`, `check` (runs all). |
| `bun.lock` | committed lockfile. |
| `tsconfig.json` | `strict: true`, `noUncheckedIndexedAccess: true`, `target: ES2023`, `module: ESNext`, `moduleResolution: Bundler`, `lib: [ES2023]`, `noEmit: true` (build emits separately later). |
| `biome.json` | recommended rules + import sort + SPDX header rule (custom or via plugin) + tab width 2 + LF. |
| `lefthook.yml` | `pre-commit`: biome check (staged), tsc --noEmit, qmllint changed `.qml`. `commit-msg`: commitlint. |
| `commitlint.config.mjs` | extends `@commitlint/config-conventional`. |
| `release-please-config.json` + `.release-please-manifest.json` | single package, `release-type: simple` initially (changes in TIP 6). |
| `.github/workflows/ci.yml` | Job `check` on `kdeneon/plasma:user` container: install Bun, `bun install`, `bun run check`. Job `qml` on same container: `qmllint`, `qmlformat --check`. Triggers: `pull_request`, `push` to `main`. |
| `.github/workflows/release-please.yml` | runs on push to `main`, opens release PRs. |
| `LICENSE` | full GPL-3.0-or-later text. |
| `README.md` | one-paragraph description, link to `spec/plan.md`, build status badge placeholder. |
| `.gitignore` | `node_modules/`, `dist/`, `.bun/`, `*.log`, generated `.d.ts`. |
| `.editorconfig` | LF, 2-space indent for TS/JSON, 4-space for QML. |
| `src/.gitkeep`, `package/.gitkeep`, `tools/.gitkeep`, `dist/.gitkeep` | preserve empty dirs. |
| `tests/sanity.test.ts` | the placeholder `1 + 1` test. |

## 4. Implementation steps

1. `bun init -y` then prune the generated `index.ts` / `README.md` and replace with the layout above.
2. Add Biome (`bun add -D @biomejs/biome`) and write `biome.json`. Run `bunx biome check --write` to baseline.
3. Add TypeScript (`bun add -D typescript`) and `tsconfig.json`. Confirm `bunx tsc --noEmit` passes on the empty project.
4. Add `fast-check` and `@types/bun` (dev). Write `tests/sanity.test.ts` and confirm `bun test` is green.
5. Install Lefthook (`bun add -D lefthook`) and write `lefthook.yml`. Run `bunx lefthook install`.
6. Install commitlint (`bun add -D @commitlint/cli @commitlint/config-conventional`) and config.
7. Write GitHub Actions workflows. Use `oven-sh/setup-bun@v2`. Container: `kdeneon/plasma:user`. Cache: Bun's lockfile-keyed cache action.
8. Add `LICENSE` (fetch from <https://spdx.org/licenses/GPL-3.0-or-later.html>). Add SPDX header rule to Biome (use the `noRestrictedSyntax`-style rule or a custom regex via Biome's `style/useSpdxHeader` if available; fall back to a tiny `tools/check-spdx.ts` script invoked from CI if Biome lacks it).
9. Initial commit with `chore: scaffold repo (TIP 1)`. Push, watch CI go green.

## 5. Acceptance criteria

- `bun run check` exits 0 locally.
- `bunx lefthook run pre-commit` passes on a clean tree.
- A trivial `feat:`-prefixed commit on `main` opens a release-please PR (no actual release yet — no code to release).
- CI workflow on a fresh PR completes green within ~3 min.
- `qmllint --version` and `qmlformat --version` callable from the CI container.

## 6. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| `kdeneon/plasma:user` container drifts or disappears | pin a digest in CI; mirror to GHCR if upstream tag becomes unstable. |
| Biome doesn't ship an SPDX-header rule | implement the 20-line `tools/check-spdx.ts` fallback now. |
| Lefthook conflicts with global git hooks | document the `lefthook install --force` step in README. |

## 7. Done = ready for TIP 2

When CI is green and `bun run check` is green locally, hand off to TIP 2 (Core Model Library), which is the first phase to introduce real logic.
