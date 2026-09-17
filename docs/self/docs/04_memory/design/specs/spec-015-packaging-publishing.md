---
id: spec-015-packaging-publishing
type: tech-spec
title: "npm packaging & publishing pipeline (package.json publish surface + CI publish flow)"
status: approved
scope: "package.json (publish metadata + scripts) and .github/workflows/publish.yml + scripts/publish-staging"
supersedes: ""
release: "v0.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

REQ-SYS-09 requires WingFoil to ship as an installable npm package (`npm install -g wingfoil` puts the
`wingfoil` CLI on PATH). `adr-009` fixes the *architecture* of how that happens — GitHub Actions CI/CD,
an ephemeral Verdaccio staging step driven by a local-first script, promotion to npm with
provenance/OIDC, secrets only in the CI store. This spec fixes the *file-level contract* that
architecture implies, so the v0.2 publishing tasks implement one agreed surface rather than each
task inventing its own `package.json` fields, script names, and workflow shape.

Today (`main`) `package.json` delivers packability only (`task-007`): it has `name`, `version`,
`bin.wingfoil`, `files`, `main`, `types`, `engines`, `license`, `keywords`, and `build`/`prepack`
scripts, so `npm pack` yields a valid tarball. It is missing every field and gate needed to *publish*:
no `repository`/`author`/`homepage`/`bugs`/`publishConfig`, no `prepublishOnly`, no `--dry-run` gate,
no staging script, and no `.github/workflows/`. Without a single definition, three tasks (publish
metadata, publish flow, secrets) would diverge on names and layout, and the `dl-023` init+CLI e2e
smoke gate could not be reused as the staging smoke.

## Specification

### 1. `package.json` publish metadata (added by the publish-metadata task)

Required additions (values are the contract; exact URLs confirmed at implementation):

- `repository`: `{ "type": "git", "url": "git+https://github.com/<owner>/wingfoil.git" }`
- `author`: `"Roberto Pompermaier <robypomper@gmail.com>"`
- `homepage`: the repo README/pages URL
- `bugs`: `{ "url": "https://github.com/<owner>/wingfoil/issues" }`
- `publishConfig`: `{ "registry": "https://registry.npmjs.org/", "access": "public", "provenance": true }`
  — the **target (prod) registry**, public access, and provenance (npm ≥ 9.5 + GitHub OIDC). The
  registry URL is non-secret and lives here in git; omitting it falls back to the npm default. The
  **staging** registry is never stored here — it is passed transiently as `--registry
  http://localhost:4873` by the `publish:staging` script (§3). See §5 for the full config-location map.
- `files` review: stays `["dist", "README.md"]`; add `LICENSE` and (if present) `COLLABORATION.md`
  only if intended in the tarball. **No `.npmignore`** — `files` is the allowlist (single source;
  avoids the `files`/`.npmignore` double-negative).

- `bin.wingfoil`: **`dist/cli.js`** — no leading `./`. npm rejects a `./`-prefixed `bin` target,
  rewrites the manifest at publish and warns `"bin[wingfoil]" script name dist/cli.js was invalid and
  removed` (misleading wording: the command is normalised, not dropped). Amended after `task-059`'s
  review isolated it with two probe packages — `./dist/cli.js` emits the warning, `dist/cli.js` does
  not — and confirmed by probe install that the shim works either way, so this is signal hygiene, not
  a functional fix: §3 stage 1 runs `npm publish --dry-run` as a CI gate, and a gate whose output
  carries permanent expected noise is a gate people stop reading. Previously listed under *Unchanged*
  with the `./` form, which is why `task-059` correctly declined to fix it in code. Tracked by
  `bug-020-bin-path-autocorrected-at-publish`.

Unchanged: `name: wingfoil`, `main`, `types`, `engines: node >=18`, `license: MIT`. `version` is
driven by the release/tag scheme (§4), not hand-edited at publish time.

### 2. Scripts (publish gate)

- `prepublishOnly`: `npm run build && npm test && npm run lint` — the hard gate npm runs before any
  publish (staging or prod). Must exit non-zero on any failure.
- `publish:staging`: the **local-first** entry point (`scripts/publish-staging.*`) that runs the full
  staging→smoke flow (§3) against a Verdaccio instance, usable identically on a dev machine and in CI.
- Existing `build`/`prepack`/`test`/`lint` unchanged; `prepack → build` still produces `dist/`.

### 3. Publish pipeline (`.github/workflows/publish.yml` + `scripts/publish-staging`)

Stages, in order (the CI job invokes the same `scripts/publish-staging` a developer runs locally):

1. **build + gate** — `npm ci`, then `prepublishOnly` (build/test/lint) + `npm publish --dry-run`
   (manifest visibility; must be exactly `dist` + docs per `files`).
2. **stage** — start **Verdaccio** (`npx verdaccio` locally / official image as a CI service on
   `http://localhost:4873`), `npm publish` the packed tarball to it (throwaway auth token).
3. **smoke** — in a clean environment, `npm install -g wingfoil --registry http://localhost:4873`,
   then run the `dl-023` init+CLI e2e smoke (assert `wingfoil --help` on PATH exits 0, and the
   fresh-init CLI surface is schema-valid). Verdaccio is torn down after.
4. **promote** — only if smoke passes, publish the **same** tarball to the public npm registry with
   **provenance** (GitHub OIDC; `id-token: write` permission). Triggered on a `vX.Y.Z` tag on `main`.

`act` (nektos/act) SHOULD be documented as the local way to exercise `publish.yml` before pushing, so
the workflow is not debugged through throwaway commits (`adr-009`).

### 4. Version / tag scheme

- `package.json` `version` is semver (`MAJOR.MINOR.PATCH`); v0.2 publishes `0.2.z`.
- The publish trigger is an annotated git tag `vX.Y.Z` created **on `main`** after the release branch
  merges (`dl-024`; never on a `design/*` branch). Tag ↔ `package.json` `version` must match (CI
  asserts this before promote).

### 5. Config locations, secrets & rollback

**Where each piece of publish config lives** — the security boundary: public config in git, anything
that authenticates never in git (`security-secrets` / `spec-007`):

- **Non-secret, in `package.json` (git):** package `name`/`version`, target registry
  (`publishConfig.registry`), `access`, `provenance`, and `repository`/`author`/`homepage`/`bugs`.
- **Staging registry URL:** transient only — the `http://localhost:4873` Verdaccio address passed as
  `--registry` by `publish:staging`; not persisted anywhere.
- **Auth token (the publish secret):** the GitHub Actions **secret store** as `NPM_TOKEN`; at publish
  time the job writes a **transient `.npmrc`** in the runner workspace
  (`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`) that is never committed. Locally, a developer's
  token lives in their own `~/.npmrc`, outside the repo.
- **No username/password is stored:** npm authenticates by token, and provenance is signed via GitHub
  **OIDC** — an ephemeral identity, no long-lived credential for the provenance claim.

The human `approver` role provides/rotates `NPM_TOKEN` and authorizes the tagged release (`adr-006`).

Rollback posture: prefer `npm deprecate` + a follow-up patch over `npm unpublish` (restricted); a
failed staging smoke blocks promotion, so a bad build never reaches the public registry.

## Consequences

- The three publishing tasks (metadata, flow, secrets) implement against these exact names
  (`prepublishOnly`, `publish:staging`, `.github/workflows/publish.yml`, `NPM_TOKEN`) and the §1 field
  set — no per-task divergence.
- The `dl-023` init+CLI e2e smoke sub-workflow is reused verbatim as the §3 staging smoke; a change to
  that smoke propagates here.
- v0.2's `release-cycle` `publishing` phase becomes runnable (`agent.execute # build + npm publish`
  maps onto §3 stages 1→4).
- If the staging tool later changes (e.g. to GitHub Packages, the `adr-009` alternative) the
  **pattern** (gate → stage → smoke → promote) is unchanged, so only this spec's §3 is revised — no new
  ADR needed unless the architecture (CI/CD, provenance) itself changes.
- Making `version` tag-driven (§4) means a manual `package.json` version bump outside the tag flow is
  an error the CI catches.

## Process Notes

Discovered proactively by `release-planning/identify-specs` (v0.2), exactly the gap `dl-018` T2 named
(REQ-SYS-09 had no governing packaging spec after `spec-014` was repurposed for the MCP entry point).
Companion to `adr-009` (architecture) — this spec is the file-level contract. Feature-side v0.2
artefacts (directive frontmatter, MCP Prompts) are already covered by approved `spec-013` / `spec-004`,
so no additional specs were scaffolded this phase. Filed `pending` for the `dl-022` spec-review +
approver sign-off before `approved`.
