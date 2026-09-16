---
id: "task-059-publish-metadata"
type: task
title: "Publish metadata: complete package.json publish surface (dl-018 T1)"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Deliver **dl-018 T1**: add the npm publish metadata `package.json` currently lacks so the package is publishable (not just packable). Implements `spec-015` §1.

## Acceptance Criteria

Per `spec-015` §1:
- Add `repository`, `author`, `homepage`, `bugs`.
- Add `publishConfig: { registry, access: public, provenance: true }`.
- Review `files` (stays `[dist, README.md]` + `LICENSE`/`COLLABORATION.md` if intended); **no** `.npmignore`.
- `npm pack` manifest = exactly `dist` + docs.

## Implementation Notes

Source: `dl-018` `## Actions` T1; governed by `spec-015` (approved) + `adr-009`; requirement REQ-SYS-09. First publishing task (others depend on it).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### `design` — role: architect

Branch `task/task-059-publish-metadata`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-059-publish-metadata`. Task `in-progress` from `start`.

**`agent.read_related` (`dl-015`) — no-op.** `depends_on: []`. Nothing to acknowledge. The dependency
edge runs the other way: `task-060-publish-pipeline` `depends_on` this task and `task-061-publish-secrets`
depends on `task-060`, so the handoff obligations are *outbound* — collected under "Handoff to
task-060 / task-061" below rather than read in.

**`agent.verify_specs` — no gap; design is a pass-through (no approver gate).** Every artefact this
task needs already exists at the required state:

| Artefact | State | Covers |
|---|---|---|
| `spec-015-packaging-publishing` §1 | `approved` | the field-level contract — this task's whole scope |
| `adr-009-npm-publishing-pipeline` | `accepted` | the CI/CD architecture §1 feeds (GH Actions + Verdaccio + provenance/OIDC) |
| `dl-018-release-publishing-strategy` T1 | `ready` | the task seed |
| `REQ-SYS-09` (`docs/02_requirements/03_sard/01_architecture.md`) | — | npm distribution; fit criterion = `npm install -g wingfoil` puts `wingfoil` on PATH, `--help` exits 0, README ships |

No `tech-spec` scaffolded (`memory.add(type: tech-spec)` not invoked) — `spec-015` §1 is complete and
unambiguous for every field. Per plan §3.2 the `approver` gate applies **only** when a new spec was
scaffolded, so `design` passes straight through.

Scope boundary confirmed against the spec's own section split: §1 is this task; **§2 (`prepublishOnly`,
`publish:staging` scripts), §3 (`.github/workflows/publish.yml` + `scripts/publish-staging`) and §4
(tag scheme) are `task-060`; §5 (`NPM_TOKEN`, transient `.npmrc`, rollback) is `task-061`.** Nothing in
this task adds a script, a workflow file, a registry credential, or a CI file.

**T1 — acceptance-criteria classification (`dl-014`, `testing` directive).**

| # | Acceptance criterion (`spec-015` §1) | Classification | Justification |
|---|---|---|---|
| AC1 | `repository`, `author`, `homepage`, `bugs` | **red-first** | all four are absent from `package.json` on `main`; a test asserting them fails today |
| AC2 | `publishConfig: { registry, access: public, provenance: true }` | **red-first** | absent today; likewise fails before the change |
| AC3 | `files` review (`["dist", "README.md"]` ± `LICENSE`/`COLLABORATION.md`); **no `.npmignore`** | **characterization** | the review verdict is "unchanged" (reasoning below) and the no-`.npmignore` invariant already holds on `main`. Forcing a red here would mean fabricating a failure — the `testing` directive's exemption applies; the test is written as a regression guard |
| AC4 | `npm pack` manifest = exactly `dist` + docs | **characterization** | already true on `main` — the observed manifest is 266 files, all under `dist/` plus `README.md` and `package.json`. `task-007`'s `test/cli/npm-distribution.test.ts` asserts *inclusion*; this task tightens it to an **exhaustive allowlist**, which is a stricter guard on pre-existing behaviour, not new behaviour |

Two red-first ACs, two characterization ACs. `red` must show AC1+AC2 failing for the stated reason
(missing fields), not a fabricated failure for AC3/AC4.

**Field-value decisions (the spec leaves two values to "confirmed at implementation").**

1. **`<owner>` in `repository`/`homepage`/`bugs` — derived, NOT observed. Needs approver confirmation.**
   `spec-015` §1 writes the URLs with a literal `<owner>` placeholder and says "exact URLs confirmed at
   implementation". There is **no git remote configured in this repository** — observed:

   ```
   $ git remote -v
   (no output)
   ```

   and `grep -rn "github.com"` over `docs/`, `README.md`, `COLLABORATION.md`, `CLAUDE.md` returns only
   `spec-015`'s own two placeholder lines. So the owner cannot be read off anything in the repo. It is
   **derived** from the author identity the spec itself pins (`robypomper@gmail.com`, also
   `dna.yaml:127` `team` block) as `robypomper`, giving
   `https://github.com/robypomper/wingfoil`. This is the single guessed value in the change and it is
   flagged for the `approver`: if the GitHub org/owner differs, all three URLs change together. It
   matters beyond cosmetics — npm **provenance** (`adr-009` step 4) verifies the attested source
   repository against `repository.url`, so a wrong owner breaks promote, not just a link.
2. **`homepage`** — `spec-015` §1 says "the repo README/pages URL"; no GitHub Pages site exists, so the
   README anchor form (`…/wingfoil#readme`, npm's own convention for a repo-hosted readme) is used.
3. **`author`** — taken verbatim from `spec-015` §1. Not a new disclosure: the same
   name+address is already public in git (`docs/self/.wingfoil/dna.yaml` `team`, `spec-002` §, and
   `spec-015` itself) and is the repo's git author identity. No token, registry credential, or
   non-public address is introduced anywhere in this task (`security-secrets`).

**`files` review (AC3) — verdict: leave `["dist", "README.md"]` unchanged.** `spec-015` §1 makes the
two additions conditional ("add `LICENSE` and (if present) `COLLABORATION.md` **only if intended** in
the tarball"), so a review may legitimately conclude "no change". Reasons:

- **`LICENSE` — cannot be added: the file does not exist.** `ls -a` at the repo root shows no
  `LICENSE`/`LICENSE.md`/`COPYING`. Listing a non-existent path in `files` is a no-op at best. Recorded
  as a finding below, because `package.json` declares `"license": "MIT"` and `README.md` §License says
  "MIT" while the tarball carries no licence text. (Note: npm ships `LICENSE*` automatically regardless
  of `files`, so the fix is to *create* the file — not to edit `files`.) Authoring a licence text means
  fixing a copyright holder and year, which is an `approver` decision, not a developer one, and it is
  not publish *metadata* — so it is **not** done here.
- **`COLLABORATION.md` — present, but not intended in the tarball.** Its links are repo-relative into
  trees that deliberately do not ship (`docs/self/docs/04_memory/design/dls/dl-020-contribution-model.md`,
  `docs/`), so inside the tarball it would be a page of dead links. REQ-SYS-09's fit criterion asks for
  "README + command docs"; npmjs.com renders `README.md` only. Contribution flow is reached from the
  README, which does ship.

Net effect: the AC4 manifest ("exactly `dist` + docs") is already satisfied by the current `files`, and
AC3's operative assertion becomes the **absence** of `.npmignore` plus an exhaustive manifest allowlist.

**Findings that are out of this task's scope — flagged, not silently fixed.** Both were observed while
running the AC4 baseline; neither is a `spec-015` §1 field, so neither is fixed here (see
"Deviations" under `review`).

1. **`npm publish` auto-corrects `bin.wingfoil` (`./dist/cli.js`).** Observed verbatim on `main`,
   *before* any change in this task:

   ```
   npm warn publish npm auto-corrected some errors in your package.json when publishing.  Please run "npm pkg fix" to address these errors.
   npm warn publish errors corrected:
   npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
   ```

   Isolated to the leading `./`: an identical probe package with `"bin": {"wingfoil": "./dist/cli.js"}`
   reproduces the warning and one with `"dist/cli.js"` does not. It is **cosmetic, not a break** —
   verified by packing the probe and installing it into a throwaway prefix, which produced a working
   shim (`wingfoil -> ../lib/node_modules/probe-pkg/dist/cli.js`), so REQ-SYS-09's fit criterion still
   holds. Not fixed here because `spec-015` §1 lists `bin.wingfoil: ./dist/cli.js` explicitly under
   **"Unchanged"**; changing it would contradict an approved spec. Resolution is the approver's: either
   amend `spec-015` §1 and drop the `./`, or accept the warning. It matters for `task-060`, whose
   `spec-015` §3 stage-1 gate runs `npm publish --dry-run` and will carry this warning into CI output.
2. **No `LICENSE` file** — see the `files` review above.

**Handoff to `task-060` / `task-061` (things this task deliberately leaves them).**

- `publishConfig.provenance: true` is set here per §1, but provenance is produced by the **pipeline**
  (GitHub OIDC, `id-token: write`), which `task-060` owns. Verified locally that it does **not** break
  the §3 stage-1 gate outside CI: a probe package with the exact `publishConfig` object ran
  `npm publish --dry-run` to exit 0 (output below under `green`). `task-060` should note that, being in
  `publishConfig`, `provenance` applies to *every* publish including the §3 stage-2 Verdaccio staging
  publish, which has no OIDC issuer — that stage will need to override it explicitly rather than
  inherit it. Not asserted here (untestable without standing a registry up, which is `task-060`'s work).
- `publishConfig.registry` is the **prod** registry only, per §1/§5. The staging address stays transient
  (`--registry http://localhost:4873`, passed by `publish:staging`) and is written nowhere in git.
- No `prepublishOnly`, no `publish:staging`, no `.github/`, no `NPM_TOKEN`, no `.npmrc`: §2/§3/§5.
- The `<owner>` value (finding 1 of the field decisions) must be confirmed before `task-060`'s promote
  step can attest provenance.
