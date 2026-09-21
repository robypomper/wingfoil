---
id: "task-073-fix-stale-package-lock"
type: task
title: "Fix bug-043: refresh package-lock.json so `npm ci` succeeds in a fresh clone"
status: pending
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "tooling", "ci", "distribution"]
ref: "REQ-SYS-09"
bug: ["bug-043-npm-ci-fails-on-stale-package-lock"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-043**: `package-lock.json` is internally inconsistent, so `npm ci` fails outright in a fresh
clone of `main`:

```
npm error `npm ci` can only install packages when your package.json and package-lock.json or
npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error Invalid: lock file's @emnapi/wasi-threads@1.2.2 does not satisfy @emnapi/wasi-threads@1.2.3
```

Re-verified for this task on 2026-09-21 by cloning `main` at `91258a7` into a throwaway directory
outside every worktree and running `npm ci` there: exit **1**, nothing installed. Still reproducible,
unchanged since the report (`package-lock.json`'s last commit remains `63a1a4d`, `task-062`).

What it blocks:

- **Every fresh clone and every new worktree.** The dev-loop convention symlinks `node_modules` from
  the primary checkout, which masks this entirely — until someone clones properly, at which point the
  first setup command fails.
- **Every GitHub Actions job of the publish pipeline** `task-060`/`task-061` built:
  `.github/workflows/publish.yml` runs `npm ci`, and `spec-015-packaging-publishing` specifies the same
  first step ("**build + gate** — `npm ci`, then `prepublishOnly` … + `npm publish --dry-run`"). The
  pipeline `adr-009` and `spec-015` define cannot complete its first step on a runner today, and it has
  never run against a clean runner (`dl-056-first-real-publishing-run`), so nothing has caught it.
- The `dl-023` e2e-smoke / fresh-install gate, which inherits the same first step.

Root cause per bug-043, dev-only and transitive: `@napi-rs/wasm-runtime` declares peer ranges
`@emnapi/core: ^1.7.1` / `@emnapi/runtime: ^1.7.1`, and the lock records **no** `node_modules/@emnapi/core`
and **no** `node_modules/@emnapi/runtime` to satisfy them, so npm resolves them at install time and
collides with the single `@emnapi/wasi-threads@1.2.2` entry the lock does hold. Nothing in the runtime
dependency set is involved, which is why the installed tree keeps working and only a *clean* install
breaks.

## Acceptance Criteria

1. **`npm ci` exits `0` in a throwaway clone.** Clone the fix branch into a directory **outside every
   existing worktree** and run `npm ci` there — a worktree whose `node_modules` is symlinked does not
   exercise the failure and is not acceptable evidence (bug-043 says so explicitly). Record the clone
   command, the `npm`/`node` versions, and the real exit code (`npm ci >/dev/null 2>&1; echo $?`) in the
   Execution Notes.
2. **The refresh is its own commit, touching only `package-lock.json`.** Nothing else rides it: a lock
   refresh is reviewable only when it is the whole diff. `git show --stat <sha>` must list exactly one
   file. (This task's own Memory document and any test it adds are separate commits.)
3. **The lock diff is characterized, not asserted.** Diff the lock and **say what moved**: enumerate
   every package whose `version`/`resolved` changed, old → new, and separate them into (a) entries
   added/changed because of the `@emnapi` drift and (b) anything else. No **direct** dependency's
   resolved version may move beyond what the drift requires. The direct set at the time of writing is
   `@anthropic-ai/sdk ^0.110.0`, `@modelcontextprotocol/sdk ^1.29.0`, `chalk ^4.1.2`, `commander ^15.0.0`,
   `js-yaml ^4.3.0`, `zod ^4.4.3` (dependencies) plus the devDependencies `@eslint/js`, `@types/jest`,
   `@types/js-yaml`, `@types/node`, `eslint`, `jest`, `ts-jest`, `typedoc`, `typescript`,
   `typescript-eslint` — re-derive it from `package.json` at execution time rather than trusting this
   list, and if any of them does move, justify it explicitly or pin it back.
4. **The reported gap is actually closed, or the real outcome is reported instead.** bug-043 predicts the
   refreshed lock gains `node_modules/@emnapi/core` and `node_modules/@emnapi/runtime` entries
   satisfying the `^1.7.1` peers. Check whether npm did that; if it resolved differently, **state what it
   actually did** rather than repeating the prediction. (This project rejects tasks for asserting file
   state without opening the file — put the command that settles it in the note.)
5. **The refreshed tree is still green.** A lock refresh can move dev-tool versions, so re-run the full
   gate set on the refreshed tree: `npm run build`, full Jest suite, coverage >80% and non-regressing,
   `tsc -p tsconfig.build.json`, `npm run docs:api`, `npm run lint`. Run them in the throwaway clone
   from AC1 (a real `npm ci` tree), not only in a symlinked worktree.
6. **No product code changes.** `src/` is untouched; `git diff --stat main...HEAD -- src` prints
   nothing. If that turns out to be impossible, stop and report rather than widening the task.
7. **Out of scope, and deliberately so:** the CI guard bug-043 suggests ("worth pairing with a CI job
   that runs `npm ci` on push, so the next drift is caught by the pipeline instead of by the next person
   to clone"). It edits `.github/workflows/publish.yml`, which `task-060-publish-pipeline` owns, and it
   is a new gate rather than this defect's fix. The suggestion already lives in `bug-043`; if the task
   decides it should be scheduled, file an element for it rather than doing it here.

## Implementation Notes

Source: `bug-043` (`triaged`, severity `medium`, no `feature:` — it is an infrastructure defect),
scheduled into `v0.2` out of band under `dl-034` point 4's exception. `ref: REQ-SYS-09` — distribution
as an installable npm package, the requirement `adr-009` itself cites as its `sard_ref`, and the
contract the broken pipeline serves.

- **The fix shape bug-043 prescribes** (and explicitly tells the reporter *not* to apply):
  `npm install` to rewrite the lock, then `npm ci` in a fresh clone to prove it, as a standalone `chore`
  commit touching only `package-lock.json`.
- **Not introduced by a task branch.** bug-043 swept every branch for commits ahead of `main` touching
  the file and found none; the lock has four commits in its whole history, the most recent being
  `63a1a4d` (`task-062-typedoc-tsdoc-backfill`) on `main`. Registry metadata moved under a lock that was
  already missing two entries. Re-check before assuming a concurrent branch owns the file.
- **Characterization, not red-first** (`dl-014`/T1): the failure is in a build artefact, not in product
  behaviour, and the natural "test" is running `npm ci` in a clean clone. If a repository-level
  assertion is added (e.g. a test that the lock is self-consistent), classify it honestly and do not
  fabricate a red.
- `dl-045` back-reference recorded before the task starts, so `bug.sync_state` can drive `bug-043`.
- Practical note for whoever picks this up: until it lands, a new worktree cannot `npm ci`. The
  established workaround is symlinking `node_modules` from the primary checkout — which is exactly why
  AC1 forbids using such a worktree as evidence.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
