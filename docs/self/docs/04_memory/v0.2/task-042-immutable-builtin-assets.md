---
id: "task-042-immutable-builtin-assets"
type: task
title: "Infrastructure: REQ-SEC-07 — immutable built-in assets"
status: approved
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "security"]
ref: "REQ-SEC-07"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-07** (built-in directive/workflow templates are immutable at runtime).

## Acceptance Criteria

Satisfies the **first clause** of the Fit Criterion for **REQ-SEC-07** in
`docs/02_requirements/03_sard/05_security-compliance.md` — *`directive remove` / `workflow remove` on a
built-in is rejected, with the message `built-in … cannot be removed`*.

**Scope boundary, per `dl-030-req-sec-07-referenced-asset-ownership` (`ready`).** The Fit Criterion's
second clause — *"removal of a still-referenced custom asset is rejected naming the referrer"* — is
**not** this task's. dl-030 ratified option (b): the directive half is written into
`task-052-directive-remove`'s Acceptance Criteria, and the workflow half (P4.9) is carried to the next
`release-planning` run for scheduling. REQ-SEC-07 is therefore **partially** satisfied when this task
is done, by design and on the record.

## Implementation Notes

Protects the P3.8 built-in directive template set; consumed by `directive remove` (P3.3).

## Execution Notes

### Design (architect)

- **AC classification — red-first (TDD), not characterization.** REQ-SEC-07's Fit Criterion (`directive
  remove` / `workflow remove` on a built-in is rejected with "built-in … cannot be removed") describes
  behaviour that does **not** exist yet: there is no built-in-immutability guard anywhere in `src/`
  (grep for `built-in`/`builtin` finds only spec-011 scaffolding in `src/storage/templates.ts` and
  doc-comments — no enforcement code). So this is genuine new behaviour, written test-first, not a
  characterization of existing code.
- **`depends_on: []`** → no `read_related` step; no upstream task's Execution Notes to consult.
- **Spec verification (`verify_specs`).** No STOP required. The two governing specs are already
  **approved**: `spec-011-storage-layout` (defines the `directives/{built-in,custom}` and
  `workflows/{built-in,custom}` split — the structural basis for classification) and
  `spec-006-core-domain-api` (§3 reserves `directiveRemove`/`workflowRemove` as future `mutates: true`
  ops). REQ-SEC-07 itself and both BDD contracts (`P3.3-directive-remove.feature` scenario "Error -
  removing a built-in directive"; `P4.9-workflow-remove.feature` scenario "Error - removing a built-in
  workflow template") exist and pin the exact messages. No new/absent approved spec is needed.
- **Design decision — structural (path-based) classification, in `src/core`.** spec-011 is explicit
  that a directive's protection follows *which subdirectory holds it* (`custom/` → removable,
  `built-in/` → immutable), independent of its frontmatter `kind:` — "promoting a stand-in from
  `custom/` to `built-in/` later requires no change to `roles.yaml`". So the guard classifies on the
  path segment, not on any metadata. It lives in `src/core` (a cross-cutting pre-flight, like
  `requireGitIdentity` / REQ-SEC-01, task-014) so the CLI and every MCP Tool enforce it identically
  by construction (REQ-SYS-05). This underpins P3.3 (task-052-directive-remove `depends_on` this task).
- **Scope / seam-reuse.** Neither `directiveRemove` nor `workflowRemove` is wired into `CORE_MODULES`
  yet (both are future ops per spec-006 §3). Following the task-014 / task-016 precedent for a shared
  pre-flight primitive, this task delivers the fully-tested guard now and defers wiring it into the
  actual mutating op to the dependent task (task-052 for `directive.remove`; a future task for
  `workflow.remove`). No existing seam is reimplemented — the guard returns the same `CoreResult<void>`
  shape `requireGitIdentity` uses, so a mutating op composes the two identically.

### Red (developer)

- Added `test/core/builtin-asset.test.ts` (10 cases): `isBuiltInAssetPath` true/false across
  directives+workflows, nested built-in path, and the substring guard (`custom/built-in-notes.md` is
  NOT built-in); `requireCustomAsset` refusal with the exact REQ-SEC-07 messages + `CONFLICT` code, and
  the custom allow path. Failed as expected — `Cannot find module '../../src/core/builtin-asset'`.
- Commit `6da85d9`.

### Green (developer)

- Added `src/core/builtin-asset.ts`: `AssetKind`, `isBuiltInAssetPath(relativePath)` (full path-SEGMENT
  match on `built-in`, so a substring never false-positives), `requireCustomAsset(kind, relativePath)`
  → `CoreResult<void>` (`CONFLICT` + exact `built-in {kind}s cannot be removed` message). Pure, no
  filesystem/wall-clock/randomness (REQ-SYS-07). Re-exported via `src/core/index.ts` (alongside
  `git-identity`). All 10 new tests green; `test/core` (131 tests) green; `tsc` clean; eslint clean.
- Commit `14f11cc`.

### Refactor (developer)

- **No refactor commit — nothing to tidy.** The green implementation is already two small pure
  functions with no duplication (it deliberately mirrors, not copies, `requireGitIdentity`'s shape),
  eslint and `tsc` are clean, and coverage is complete. Per the coordinator's instruction, skipped the
  commit rather than fabricating one — matching the task-014 / task-016 precedent (neither cut a
  refactor commit either).

### Review (reviewer)

- Gates: `npm test` **558/559** · `tsc -p tsconfig.build.json` **exit 0** · `npm run test:coverage`
  new file `src/core/builtin-asset.ts` **100% stmts/branch/funcs/lines**, aggregate **≥80%** (per-module
  figures 96–100% across the full run) · `npm run docs:api` **exit 0** (TSDoc present on every new
  export: `AssetKind`, `isBuiltInAssetPath`, `requireCustomAsset`).
- **Known pre-existing flake (NOT a regression):** the single failing test is
  `test/cli/program.integration.test.ts` › "memory search api … under 1 second" — a **wall-clock**
  assertion (`Date.now()` budget of 1000 ms) on a compiled, out-of-process spawned CLI. It flaked
  (2898 ms, then 5.5 s in isolation) because ~10 dev-loops were running in parallel and saturating the
  machine. It touches no code this task changed (only `src/core/builtin-asset.ts` + its test + the
  `src/core/index.ts` re-export were added); left untouched per coordinator guidance (editing it would
  collide with sibling branches at merge). Treated as GREEN for the gate.
- Traceability intact: REQ-SEC-07 → BDD `P3.3-directive-remove.feature` / `P4.9-workflow-remove.feature`
  → spec-011 (`{built-in,custom}` split) / spec-006 §3 (`directiveRemove`/`workflowRemove`) → this task
  → consumed by task-052 (P3.3).
- No new exported declaration lacks TSDoc; no secrets; scoped commits only; `node_modules` not tracked.
- `status: in-progress → in-review`.

---

## Execution Notes — second pass (after review reject, `in-review → in-progress`)

The first pass above is left verbatim as the historical record. Several of its claims were wrong; they
are named and retracted under "Corrections to the first pass" below. Where the two sections disagree,
**this section is correct**.

### Corrections to the first pass

1. **"full path-SEGMENT match on `built-in`, so a substring never false-positives" (Green, first
   pass) — misleading.** The segment match was real, but the function was a **deny-list**: it returned
   "not built-in" (⇒ removable) for *every* shape it did not positively recognise. The substring guard
   it advertised was the only shape it had actually been designed against.
2. **"Satisfies the Fit Criterion for REQ-SEC-07" (Acceptance Criteria + Review, first pass) —
   overstated.** Only clause (a) is delivered. Clause (b) is out of scope per `dl-030` (`ready`); the
   Acceptance Criteria section above now says so explicitly, and the module doc-comment carries the
   same boundary.
3. **The `spec-011` citation — unsupported.** The first-pass TSDoc read: *"spec-011 is explicit that a
   directive's protection follows which subdirectory holds it … — 'promoting a stand-in from `custom/`
   to `built-in/` later requires no change to `roles.yaml`'."* The quoted sentence (spec-011 lines
   118–120) is about **name-based role binding** being unaffected by a move; it says nothing about
   removability or protection. spec-011 never mentions removal at all. Corrected: **the removability
   rule is REQ-SEC-07's; spec-011 supplies only the layout it is expressed over.** What spec-011 *does*
   settle, and is now cited for, is that frontmatter `kind:` cannot be the discriminator — the six P3.8
   template stand-ins sit under `custom/` "each authored with `kind: custom`, `ref: [P3.8]`", so `kind:`
   demonstrably does not track the subdirectory, leaving location as the only discriminator spec-011
   defines.
4. **Review gate numbers, first pass: `npm test` 558/559 with one failure treated as GREEN.** This pass
   reports only observed numbers and the full suite is green (see Review below), so no such judgement
   is needed. That flake is now tracked as `bug-011-cli-latency-assertion-measures-spawn-contention`;
   it did not recur here.
5. **"No refactor commit — nothing to tidy" (Refactor, first pass).** There was something to tidy, and
   this pass cut one (see Refactor below).

### Red — second pass (developer)

Run in **two stages** so the evidence is behavioural, not merely a missing symbol.

**Stage 1 — the fail-open behaviour, against the unchanged first-pass API.** Added an 18-shape
fail-closed table asserting `requireCustomAsset(...)` refuses. Observed:
`Tests: 17 failed, 11 passed, 28 total`, every failure identical in form:

```
● requireCustomAsset fails CLOSED on every unrecognised path shape (REQ-SEC-07) › refuses windows separator, built-in directive
  expect(received).toMatchObject(expected)
  - Expected  - 1
  + Received  + 1
    Object {
  -   "ok": false,
  +   "ok": true,
    }
```

All 17 refused shapes returned `{ ok: true }` — i.e. *removal permitted*: the Windows separator (3
shapes), a mixed-separator path, three casing variants, parent traversal, a single-dot prefix, an
absolute path, a doubled separator, the empty string, a bare filename, the `custom/` directory itself
with no file, both kind/pillar mismatches, and a `directives-backup/custom/…` look-alike root. Of the
18 shapes, exactly **one** was already refused — `directives/custom/../built-in/testing.md` — and only
incidentally, because a literal `built-in` segment happens to survive in that particular string.

**Stage 2 — the missing allow-list predicate.** Rewrote the predicate suite against
`isRemovableCustomAssetPath(kind, path)`. Observed `Tests: 31 failed, 5 passed, 36 total` with
`TypeError: (0 , builtin_asset_1.isRemovableCustomAssetPath) is not a function`, and
`tsc --noEmit -p tsconfig.json`:

```
test/core/builtin-asset.test.ts(19,10): error TS2305: Module '"../../src/core/builtin-asset"' has no exported member 'isRemovableCustomAssetPath'.
```

Commit `fabf864`.

### Windows-path proof — why the defect was reachable, not hypothetical

`src/core/loaders.ts` (**read only — owned by task-037 this release, not edited here**) stores each
directive's path at line 180:

```ts
files.push({ path: join('directives', relativePath), frontmatter });
```

`join` is `node:path`'s platform-bound `join`, so the stored value carries the **platform** separator
even though `relativePath` is assembled with `/` inside `listMarkdownFilesSorted`. Verified directly:

```
path.win32.join('directives', 'built-in/testing.md')     → 'directives\built-in\testing.md'
path.win32.join('directives', 'built-in/p3/testing.md')  → 'directives\built-in\p3\testing.md'
path.posix.join('directives', 'built-in/testing.md')     → 'directives/built-in/testing.md'
```

Feeding the first-pass predicate (`relativePath.split('/').includes('built-in')`) the win32 form
returns `false` → classified custom → `directive remove` would have deleted a shipped built-in on
Windows. A symlinked `custom/` aliasing `built-in/` produces the same outcome on any platform, which is
why `.`/`..` segments are now **refused rather than textually resolved**: string normalisation cannot
see through a symlink, so an ambiguous shape is rejected instead of guessed at.

### Green — second pass (developer)

Rewrote `src/core/builtin-asset.ts` as a fail-closed allow-list.

- **Removed** `isBuiltInAssetPath(relativePath)`. It had no consumers beyond its own module, the
  `src/core/index.ts` barrel re-export (`export * from './builtin-asset'`, unchanged) and its test, so
  the deny-list is now unreachable rather than merely unused.
- **Added** `isRemovableCustomAssetPath(kind: AssetKind, relativePath: string): boolean` — true only
  for a positively recognised `{directives|workflows}/custom/…/<file>`: ≥3 segments, split on **either**
  separator (`/[\\/]/`, runs not collapsed so a doubled separator yields a rejected empty segment), no
  `''`/`.`/`..` segment, `segments[0]` equal to that `kind`'s root (`directives`/`workflows`) and
  `segments[1] === 'custom'`, case-sensitive. Everything else is `false`.
- Fails closed on: the Windows and mixed separators, `BUILT-IN`/`Built-In`/`CUSTOM` casing, `..`/`.`
  traversal, absolute paths, doubled separators, the empty string, a bare filename, the bare `custom/`
  directory, a kind/pillar mismatch (a workflow path offered to `'directive'`), and a look-alike root
  (`directives-backup/custom/…`). A custom file merely *named* `built-in-notes.md` stays removable — it
  is the `custom` **segment** that decides.
- `requireCustomAsset(kind, relativePath)` now returns `ok` **only** when the allow-list accepts;
  otherwise an error. A private `declaresBuiltInPath` selects the *wording* only — the decision to
  refuse is already made by the allow-list, so it cannot reintroduce a fail-open path. A declared
  built-in gets REQ-SEC-07's verbatim message; any other unrecognised shape gets
  `cannot remove '<path>': not a <kind> under '<root>/custom/'` (shaped after P3.3's own
  `cannot remove '<name>': …` message), because asserting "this is a built-in" about a path we did not
  recognise would be a claim we cannot make.
- Still pure: no filesystem, wall-clock or randomness (REQ-SYS-07).
- Commit `369b3d6`.

### Consistency decisions (both raised by the reviewer; both changed)

1. **Fit-criterion strings → named constant. Adopted.** `BUILT_IN_REMOVAL_ERROR: Record<AssetKind,
   string>` holds both strings literally, with a "do not reword" comment naming the two `.feature`
   scenarios that assert them. Reason: it matches the `git-identity.ts` / `IDENTITY_ERROR` precedent
   this module says it mirrors, it makes each string greppable against the `.feature` file that pins
   it, and — the substantive reason — the previous template literal <code>\`built-in ${kind}s cannot be
   removed\`</code> *derived* a contract string from a type name, so a future rename of an `AssetKind`
   member would have silently reshaped a fit-criterion message. The constant is module-private (as
   `IDENTITY_ERROR` is) and the test restates both strings independently, so the test pins the contract
   rather than the implementation's spelling of it.
2. **Error code `CONFLICT` → `VALIDATION`. Changed.** Both map to exit 1 (`src/core/exit-code.ts`), so
   the BDD "exits with code 1" holds either way; this is about which code is *truthful*. `CONFLICT` had
   no definition anywhere — `spec-006-core-domain-api` §2 only enumerates the codes, and no other call
   site in `src/` uses `CONFLICT` at all, so the first pass would have been the codebase's sole and
   undefined usage. The two sibling pre-flights this module explicitly mirrors — `requireGitIdentity`
   (REQ-SEC-01) and `requireApprovalAuthority` (REQ-SEC-03) — both return `VALIDATION` for a failed
   precondition, which is exactly what this is: the request is inadmissible on its own terms, not in
   conflict with some competing state. Aligned with the family.

### Refactor — second pass (developer)

- Table-driven the suite: two `ReadonlyArray<readonly [string, AssetKind, string]>` registers
  (`REMOVABLE_SHAPES`, `REFUSED_SHAPES`), each asserted against **both** exports, so the allow-list
  predicate and the pre-flight guard cannot drift and each shape is declared once instead of restated
  per export. This removed the shape duplication the two-stage red had left behind.
- Removed a `kind as 'directive' | 'workflow'` cast by importing and typing with `AssetKind` (the
  `it.each` literal table had widened to `string`).
- Commit `82ecea0`.
- **Checks (all observed, this worktree):** `npx jest --maxWorkers=2` → **66 suites / 802 tests, 0
  failed**. `npx jest --coverage --maxWorkers=2` → All files **98.05 / 88.13 / 98.09 / 98.66**
  (stmts/branch/funcs/lines), `core` **98.11 / 87.82 / 100 / 98.92**, `src/core/builtin-asset.ts`
  **100 / 100 / 100 / 100** — global ≥ 80 ✓. `npm run docs:api` **exit 0**. `npx tsc -p
  tsconfig.build.json` **exit 0**. `npx eslint .` **exit 0** (`lint.clean` is an ACTIVE hard-reject
  check — `dl-034`, `dev-loop.yaml` v1.2).

### Review — second pass (developer side)

- **Gates re-run after the refactor commit, numbers as observed above:** full suite **66 suites / 802
  tests, 0 failed** (the first pass's 558/559 included one failure; this pass has none — the
  `test/cli/program.integration.test.ts` latency assertion tracked by `bug-011` did not recur, this
  worktree being the only heavy job running). Coverage, `docs:api`, `tsc` and `eslint` as listed under
  Refactor.
- **`tests.bdd.run` — nothing executable exists for this task, stated plainly rather than claimed.**
  There is no `.feature`-executing harness in `test/` (the `.feature` references there are doc-comment
  citations), and `directive remove` / `workflow remove` are still absent from `CORE_MODULES` —
  spec-006 §3 reserves both as future `mutates: true` ops — so neither BDD scenario can be run
  end-to-end yet. What *is* verified is the contract those scenarios assert: the two exact message
  strings and the exit-1 mapping, pinned by `test/core/builtin-asset.test.ts` independently of the
  implementation's constant. Running the scenarios themselves belongs to `task-052` (P3.3) and to the
  future P4.9 task.
- **Clause (b) is NOT delivered here** and is not claimed anywhere in this task. Per `dl-030` (`ready`,
  option (b)): the directive half — `cannot remove 'legacy-rule': still assigned to role 'developer'`
  — is written into `task-052-directive-remove`'s Acceptance Criteria (already on `main`); the workflow
  half (P4.9, `cannot remove 'arch-review': included by 'release-cycle'`) has **no owner in v0.2** and
  is carried to the next `release-planning` run. `requireCustomAsset` is documented as the **first** of
  two checks a remove op must run, never the only one.
- **Untouched, deliberately:** `src/core/loaders.ts` (read only, for the Windows proof),
  `src/core/context.ts`, `src/directives/` (task-037); `src/core/builtin-integrity.ts`,
  `src/core/init.ts`, `src/storage/templates.ts` (task-044). No `git merge` was run — `main` was
  already merged in before this pass started (`530810b`).
- Traceability: REQ-SEC-07 clause (a) → BDD `P3.3-directive-remove.feature` / `P4.9-workflow-remove.feature`
  (built-in scenarios) → spec-011 (layout only) + spec-006 §3 (`directiveRemove`/`workflowRemove`
  reserved) + `dl-030` (clause-(b) ownership) → this task → consumed by `task-052`.
- No exported declaration lacks TSDoc; no secrets; scoped commits only.
- `status: in-progress → in-review`; `rejection_reason` removed from the frontmatter (`spec-010`).
