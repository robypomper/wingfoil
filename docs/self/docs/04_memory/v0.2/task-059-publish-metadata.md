---
id: "task-059-publish-metadata"
type: task
title: "Publish metadata: complete package.json publish surface (dl-018 T1)"
status: done
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

### `red` — role: developer

New suite `test/cli/publish-metadata.test.ts` (11 cases). It is a **new file**, not an extension of
`task-007`'s `test/cli/npm-distribution.test.ts`: that suite asserts packaging, this one asserts the
publish surface, and keeping them apart avoids colliding with `task-065-fix-commander-esm-jest-harness`,
which is outside this dev-loop group and may touch `package.json` later.

Commit: `0e93d24 test(cli): task-059-publish-metadata — failing test for spec-015 §1 publish metadata`.

**Observed red — `npx jest test/cli/publish-metadata.test.ts --maxWorkers=2`:**

```
Test Suites: 1 failed, 1 total
Tests:       7 failed, 4 passed, 11 total
```

The 7/4 split is exactly the T1 classification, which is the point of recording it: the **7 failures are
the two red-first ACs** (5 attribution cases + 2 `publishConfig` cases) and the **4 passes are the two
characterization ACs** (the `files` allowlist, the absent `.npmignore`, the exhaustive manifest, and the
`dist/cli.js` + `README.md` presence check). No failure was fabricated to make a characterization AC look
red. Representative verbatim failures:

```
● publish metadata (task-059) — spec-015 §1 attribution fields › declares `repository` as a git URL pointing at the project repo

  expect(received).toEqual(expected) // deep equality

  Expected: {"type": "git", "url": "git+https://github.com/robypomper/wingfoil.git"}
  Received: undefined

● publish metadata (task-059) — spec-015 §1 attribution fields › declares `author` with the maintainer identity

  expect(received).toBe(expected) // Object.is equality

  Expected: "Roberto Pompermaier <robypomper@gmail.com>"
  Received: undefined

● publish metadata (task-059) — spec-015 §1 publishConfig › targets the public npm registry with public access and provenance

  expect(received).toEqual(expected) // deep equality

  Expected: {"access": "public", "provenance": true, "registry": "https://registry.npmjs.org/"}
  Received: undefined
```

Every red-first failure is `Received: undefined` — the field is genuinely absent, which is precisely the
gap `dl-018` T1 describes ("packable but not publishable").

**Baseline captured before any change (the AC4 characterization evidence).**
`npm publish --dry-run` on the branch point:

```
npm warn publish npm auto-corrected some errors in your package.json when publishing.  Please run "npm pkg fix" to address these errors.
npm warn publish errors corrected:
npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
npm notice 📦  wingfoil@0.1.0
npm notice name: wingfoil
npm notice version: 0.1.0
npm notice filename: wingfoil-0.1.0.tgz
npm notice package size: 219.4 kB
npm notice unpacked size: 754.6 kB
npm notice total files: 266
npm warn This command requires you to be logged in to https://registry.npmjs.org/ (dry-run)
npm notice Publishing to https://registry.npmjs.org/ with tag latest and default access (dry-run)
+ wingfoil@0.1.0
```

and the corresponding manifest, grouped: `{"README.md":1,"dist":264,"package.json":1}` — 266 files, no
other top-level entry.

### `green` — role: developer

Commit: `84b2773 feat(cli): task-059-publish-metadata — add spec-015 §1 publish metadata to package.json`.

The change is a **pure insertion** — four attribution fields after `license`, `publishConfig` after
`files`. No existing key was reordered, no formatting changed, and `scripts` was not touched (it belongs
to `task-060` per `spec-015` §2, and `package.json` is a file `task-065` may also edit later). The full
diff is 14 added lines, 0 removed.

**`npm publish --dry-run` AFTER (verbatim, `npm` 11.6.2 / Node v22.21.0, exit 0):**

```
> wingfoil@0.1.0 prepack
> npm run build

> wingfoil@0.1.0 build
> tsc -p tsconfig.build.json

npm warn publish npm auto-corrected some errors in your package.json when publishing.  Please run "npm pkg fix" to address these errors.
npm warn publish errors corrected:
npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
npm notice
npm notice 📦  wingfoil@0.1.0
npm notice Tarball Contents
npm notice Tarball Details
npm notice name: wingfoil
npm notice version: 0.1.0
npm notice filename: wingfoil-0.1.0.tgz
npm notice package size: 219.6 kB
npm notice unpacked size: 755.0 kB
npm notice shasum: f81267a4820b92edc380c072c7fe05cd3de563f8
npm notice total files: 266
npm notice
npm warn This command requires you to be logged in to https://registry.npmjs.org/ (dry-run)
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ wingfoil@0.1.0
```

**Read the diff between the two runs literally — only one line changed meaning:**

| Line | Before | After |
|---|---|---|
| `Publishing to … with tag latest and …` | `default access` | **`public access`** |
| package size | 219.4 kB | 219.6 kB (the added JSON) |
| total files | 266 | 266 (unchanged — metadata adds no files) |
| `bin[wingfoil]` auto-correct warning | present | **still present** (pre-existing; not this task's, see the design finding) |
| `npm warn … requires you to be logged in` | present | still present — expected, and *not* a defect: this is `--dry-run` with no auth, which is the whole point of an offline gate |

So the single **observable** proof in the dry-run is `default access → public access`. The registry line
was already `https://registry.npmjs.org/` beforehand because that is npm's default, so setting
`publishConfig.registry` explicitly is **not** observable here — `spec-015` §1 anticipates this
("omitting it falls back to the npm default"); it is set for explicitness and so `task-060` has one
declared prod target.

**`provenance` is NOT exercised by the dry-run — do not read this run as proof it works.** Two things
were checked rather than assumed:

1. It is in the manifest npm reads — `npm pkg get publishConfig`:
   ```
   {
     "registry": "https://registry.npmjs.org/",
     "access": "public",
     "provenance": true
   }
   ```
2. It does not break the offline gate. A probe package carrying the identical `publishConfig` object ran
   `npm publish --dry-run` to **exit 0** outside CI, and re-running this repo's own dry-run under a
   faked CI environment (`GITHUB_ACTIONS=true CI=true`) **also exited 0 with no provenance line at all**
   in the output.

That second result is the honest one: `--dry-run` never attempts provenance generation, so nothing here
demonstrates that provenance will succeed at promote time. It demonstrates only that the field is
declared and does not regress the §3 stage-1 gate. Actually generating an attestation needs a real OIDC
issuer and is `task-060`'s to verify.

**Packed contents AFTER (`npm pack --dry-run --json --ignore-scripts`, grouped):**

```
MANIFEST BY TOP-LEVEL: {"README.md":1,"dist/**":264,"package.json":1}
total files: 266
ships docs/self?   false
ships test/?       false
ships dist/cli.js? true
ships README.md?   true
```

Matches AC4 ("exactly `dist` + docs") and `spec-015` §1/§3 stage 1 ("must be exactly `dist` + docs per
`files`"). `package.json` is npm's own mandatory tarball member, not a `files` entry. Unchanged from the
baseline, as expected for a metadata-only change — AC4 is a characterization guard, and it held.

### `refactor` — role: developer

Commit: `11c3833 refactor(cli): task-059-publish-metadata — memoize the packed manifest so npm pack is
spawned once`. Two cases both needed the manifest and each spawned its own ~1s `npm pack`; the helper now
memoizes. Safe because the manifest is a pure function of the working tree (`determinism`), so both cases
observe the same tarball by construction rather than by luck. No production code was refactored — the
`green` change is four JSON keys with nothing to restructure.

**Gate results (all run from this worktree, after the refactor commit):**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | **70 suites / 891 tests, all passed** (55.8 s) |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | **98.17 % stmts · 88.88 % branches · 98.2 % funcs · 98.73 % lines** — all four ≥ 80, no threshold failure |
| `docs.api.build` / `docs.api.public-complete` | `npm run docs:api` | **exit 0** |
| build | `npx tsc -p tsconfig.build.json` | **exit 0** |
| `lint.clean` (`dl-034`, hard-reject) | `npx eslint .` | **exit 0**, zero errors |

Coverage is effectively unchanged from `main`'s: this task adds no `src/` code, so its tests contribute
assertions without contributing covered lines.

### `review` — role: reviewer (developer side only)

`tests.bdd.run` — **there is no BDD feature to run for this task, by design, not by omission.** Checked:
`grep -rln "npm\|packag\|publish" docs/02_requirements/02_bdd/features/` returns **nothing**, which
matches REQ-SYS-09's own traceability note — "distribution requirement with **no behavioral BDD
feature**; verified directly against the npm-publish acceptance test". The acceptance contract for
REQ-SYS-09 is therefore the two packaging suites, both green:
`test/cli/npm-distribution.test.ts` (5 cases, `task-007`) and `test/cli/publish-metadata.test.ts`
(11 cases, this task) — 16 tests, 2 suites, all passing.

**Acceptance criteria — final state.**

| AC | Verdict | Evidence |
|---|---|---|
| `repository`, `author`, `homepage`, `bugs` | met | 4 cases + a cross-field coherence case; red→green |
| `publishConfig: { registry, access: public, provenance: true }` | met | 2 cases; `default access → public access` in the dry-run; `npm pkg get publishConfig` |
| `files` reviewed; **no `.npmignore`** | met — verdict "unchanged" | reasoning under `design`; 2 guard cases |
| `npm pack` manifest = exactly `dist` + docs | met | exhaustive-allowlist case; manifest is 264 × `dist/**` + `README.md` + `package.json` |

**Deviations / findings handed to the approver (NOT fixed here, deliberately).**

1. **`<owner>` is derived, not observed** — `robypomper/wingfoil`, from the author identity, because the
   repo has no git remote. If this is wrong, all three URLs are wrong *and* provenance attestation at
   `task-060`'s promote step fails. This is the one value in the change that needs confirming.
2. **`bin.wingfoil`'s `./` triggers an npm publish auto-correction warning** — pre-existing on `main`,
   reproduced and isolated (design finding 1), cosmetic (a real global install still produced a working
   shim), and left alone because `spec-015` §1 lists `bin.wingfoil: ./dist/cli.js` under "Unchanged".
   Needs either a `spec-015` §1 amendment or an explicit accept. Flagged now rather than left to be
   rediscovered when `task-060` wires the §3 stage-1 gate and the warning shows up in CI logs.
3. **No `LICENSE` file exists** while `package.json` declares `"license": "MIT"` and `README.md` §License
   says MIT — so the published tarball carries no licence text. Not fixed here: authoring a licence
   means fixing a copyright holder and year (an `approver` call), and it is not publish *metadata*.

Findings 2 and 3 are defects against `main` that no `spec-015` §1 field covers, so they are not this
task's to silently absorb. They should become `bug` elements (or a `spec-015` amendment for 2) rather
than remain only in these notes — a `done` task's Execution Notes reschedule nothing.

**Out of scope, confirmed untouched:** no `scripts` change, no `prepublishOnly`, no `publish:staging`, no
`.github/`, no `scripts/publish-staging`, no `.npmrc`, no `NPM_TOKEN`, no registry credential anywhere
(`spec-015` §2–§5 → `task-060`/`task-061`). `src/`, `src/mcp/`, `src/core/index.ts`, `src/storage/` and
`jest.config.js` were not modified. No real `npm publish` was ever run — every registry interaction in
this task was `--dry-run`.

**`security-secrets` check:** the only identity added is `Roberto Pompermaier <robypomper@gmail.com>`,
already public in git (`dna.yaml` `team`, `spec-002`, `spec-015` §1) and the repo's git author. The
`_authToken` / `NPM_TOKEN` strings that appear in the new test are negative assertions guarding against a
credential landing in `package.json`; no value accompanies either name.

`memory.submit` — `in-progress → in-review`. Stopping here: no `approve`, no merge, no branch or
worktree removal.
