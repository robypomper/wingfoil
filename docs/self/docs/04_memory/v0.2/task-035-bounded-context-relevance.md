---
id: "task-035-bounded-context-relevance"
type: task
title: "Infrastructure: REQ-PERF-05 — bounded context via relevance"
status: done
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "performance"]
ref: "REQ-PERF-05"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Performance constraint **REQ-PERF-05** (bounded context assembled by relevance filtering).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-PERF-05** in `docs/02_requirements/03_sard/02_performance-nfr.md`.

## Implementation Notes

Relates to the context loader (`spec-012`). Consumed by role/task-scoped context (REQ-STATE-05) and deprecated-exclusion (REQ-STATE-06).

## Execution Notes

### start

`depends_on: []`, `bug: ""` — no `bug.sync_state`. Branch `task/task-035-bounded-context-relevance`,
worktree `/home/robypomper/Workspaces/.wf2-wt/task-035-bounded-context-relevance`. Status
`backlog → in-progress`.

### design

**AC classification (T1).** The Acceptance Criteria section reduces to one AC — the REQ-PERF-05 Fit
Criterion itself: "Given 1,000 Memory documents of which K are relevant to the task, the assembled
context contains exactly the K relevant (non-deprecated) documents and 0 others." Classified
**red-first**: no relevance-filter/context-assembly primitive exists in `src/` today.
`src/memory/query.ts`'s own doc comment is explicit that it borrows spec-012's keyword/frontmatter
*discipline* for `memory search` but is NOT "the Agent Context Loader spec-012 itself defines" — so
this is new behavior, not a characterization of something already shipped.

**`depends_on: []`** — no `agent.read_related` (dl-015 hard gate) to run; nothing to acknowledge.

**`agent.verify_specs`.** Scope already covered by an existing **approved** tech-spec:
`spec-012-context-loader-relevance-filtering` (`status: approved`, `scope: src/core`) — its §6
"Relevance filtering (`relevance-filter`)" is exactly REQ-PERF-05's tiered scoring/ordering/bounding
algorithm (T1 explicit links, T2 same release scope, T3 shared traceability keys, T4 keyword/tag
overlap; `score = 1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)`; order `score DESC, type ASC, id ASC`;
bounded by `ContextLimits {maxDocs: 40, maxBytes: 262144}`; deprecated/draft excluded). No new
tech-spec needed — **pass through**, no approval gate (design's `approval: {by_role: approver}` only
fires when a new spec is scaffolded, per `dev-loop.yaml`).

**Scope decision (this task only implements §6, not the whole spec-012 pipeline).** spec-012 defines
FOUR cooperating units (`dna-loader`, `directive-loader`, `relevance-filter`, `context-builder`) plus
the canonical serialized envelope (§7). REQ-PERF-05's own Fit Criterion is scoped to Memory-document
selection only ("the assembled context contains exactly the K relevant documents and 0 others") — it
does not require DNA/directive sections or the `## N. Section` Markdown envelope. Those belong to
sibling tasks already in the v0.2 backlog: **task-037-role-task-scoped-context** (REQ-STATE-05 —
"the assembled context object exposes separate `dna`, `memory`, `directives` sections") is the
`context-builder`/envelope task; **task-038-deprecated-excluded-from-context** (REQ-STATE-06) extends
deprecated-exclusion to `memory search` defaults, not just the loader. This task builds `relevance-filter`
(§6) as a standalone, reusable primitive — the same "primitive now, surface wiring later" split
`src/memory/query.ts` (task-008) already established for `memory search`, so task-037 wraps this
without reimplementing scan/scoring logic.

**Placement.** spec-012 §1 pins `relevance-filter` to the **`core`** module ("folded into the `core`
module... The module relocates to `src/core/` because the current DNA has no `context` module").
New file: `src/core/relevance.ts` (module `core`). It wraps, not reimplements, `src/memory/query.ts`'s
existing `listMemoryDocumentPaths`/`loadMemoryDocumentSummary` scan primitives (task-008) — no second
directory walk or frontmatter parser.

**Design (function shape).**
```
filterRelevantMemoryDocuments(root, memoryYaml, element: {type, id, frontmatter}, limits?)
  -> { documents: RelevantMemoryDocument[], note?: string }
```
`element` is the caller's already-resolved frontmatter of the active task (or other Memory element) —
this primitive does not itself resolve the element document (that is `context-builder`'s
`resolve-element` stage, §3 stage 1, out of this task's scope), keeping it a pure `(state) -> selection`
function per REQ-SYS-07. Excludes the element's own document, and any candidate whose `status` is
`draft`/`deprecated` (spec-012 §6: "Documents in states draft/rejected/deprecated are excluded"; the
later `spec-001-memory-yaml-schema` removed the `rejected` status entirely — "no document records
`status: rejected` anymore" — so that entry is vestigial-but-harmless and this collapses to
`draft`/`deprecated` today; see the spec-gap note below).
A candidate with `score <= 0` (no tier hit at all) is excluded — this is the relevance *threshold* the
BDD's "no relevant documents" edge case needs. Returns `note: "no relevant Memory found for task"`
(P5.3.3 BDD Scenario 3, verbatim) only when the bounded result is empty.

**Checks (post).** `frontmatter.required`/`depends_on.acknowledged` — N/A (no new spec, no deps).
`tech-spec.approved` — satisfied (spec-012 `approved`).

### red

New failing test `test/core/relevance.test.ts` for `src/core/relevance.ts`'s
`filterRelevantMemoryDocuments` (the one red-first AC — the REQ-PERF-05 Fit Criterion at 1,000-document
scale — plus the three P5.3.3-relevance-filtering.feature BDD scenarios and tier scoring/ordering/
bounding). Confirmed red: `Cannot find module '../../src/core/relevance'` (module absent). Commit
`5304d31`.

### green

Implemented `src/core/relevance.ts` (module `core`) — spec-012 §6 `relevance-filter`:
`filterRelevantMemoryDocuments(root, memoryYaml, element, limits?)`. Wraps `src/memory/query.ts`'s
`listMemoryDocumentPaths`/`loadMemoryDocumentSummary` for the scan (no reimplementation). Tiered scoring
`1000*T1 + 100*T2 + 10*T3 + overlapCount(T4)` (T1 explicit links `adr/spec/dl/bug/depends_on`; T2 same
release scope; T3 shared `P*`/`REQ-*` traceability keys; T4 keyword/tag overlap), order `score DESC,
type ASC, id ASC`, bounded by `ContextLimits {maxDocs:40, maxBytes:262144}`, `score<=0` dropped
(relevance threshold), element's own doc + `draft`/`deprecated`/`rejected`-status docs excluded, empty
result → `note: "no relevant Memory found for task"`. Determinism (REQ-SYS-07): no wall-clock/random,
all iteration over sorted paths + total-order sort. 9/9 relevance tests green. Commit `fd86e29`.

### refactor

1. Named the spec-012 §6 tier weights as constants (`TIER_1_EXPLICIT_LINK` …) so the formula reads as
   tiers, not magic numbers — commit `48548b0`.
2. Coverage-closing tests for defensive edge cases (no-release element, id-less doc path-fallback,
   array-valued traceability keys) — 12/12 relevance tests green — commit `ab18ccb`.
3. Doc/comment corrections (commit `566b446`): dropped a CLAUDE.md citation (cite
   `spec-001-memory-yaml-schema` instead), corrected the module doc, and documented the two items below.

### review

**Final gate numbers (worktree, machine idle):** `npm test` **561/561 GREEN** (58→59 suites; +12 new
relevance tests over the ~549 baseline; the previously-flaky `test/cli/program.integration.test.ts`
"under 1 second" wall-clock test passes at low load, untouched). `npm run test:coverage` **≥80%** —
global 98% stmts / 87.52% branch / 97.7% funcs / 98.45% lines; `relevance.ts` 98.98 / 84.5 / 100 / 100.
`tsc -p tsconfig.build.json` exit **0**. `npm run docs:api` exit **0** (TSDoc on every exported
declaration in `relevance.ts`). Scope delivered: spec-012 §6 `relevance-filter` only — a standalone,
reusable primitive; NOT wired into `src/core/index.ts`'s `CORE_MODULES` (no CLI/MCP surface, matching
task-008's "primitive now, surface later" split). No `bug.sync_state` (`bug: ""`).

**Follow-up 1 (coordinator) — deprecated-exclusion duplication.** `EXCLUDED_STATUSES` is defined
locally here. Sibling branch task-038-deprecated-excluded-from-context (REQ-STATE-06, not yet on
`main`) ships a shared `isDeprecatedStatus` + `memory`'s `DEPRECATED_STATE`. They can't be imported
until task-038 merges; once it does, this local set MUST be reconciled onto the shared helper so
deprecated-exclusion has one definition.

**Follow-up 2 (spec-gap, for the approver) — spec-012 §6 vs spec-001 conflict.**
`spec-012-context-loader-relevance-filtering` §6 (approved) enumerates `draft`/`rejected`/`deprecated`
as excluded; the later `spec-001-memory-yaml-schema` (approved) removed the `rejected` status entirely.
The `'rejected'` entry is therefore vestigial-but-harmless (can never match). Kept deliberately (specs
win — a `[SPEC]`-cited value is not silently dropped); spec-012 §6 needs reconciliation against
spec-001 to drop `rejected`.

---

## Execution Notes — second pass (review fallback `in-review → in-progress`, `dev-loop.yaml` review
`fallback: { step: red, set_state: in-progress }`)

Everything above is the **first pass, left as written**; the corrections it needs are stated
explicitly below rather than edited into it. This pass resumes at `red`.

### Corrections to first-pass claims

1. **The task-008 analogy was false, and it was the load-bearing part of a wrong decision.** The first
   pass's `review` note justified not exporting `relevance.ts` from `src/core/index.ts` as "matching
   task-008's 'primitive now, surface later' split". task-008's `src/memory/query.ts` **is** re-exported
   from `src/memory/index.ts` — every one of its primitives (`listMemoryDocumentPaths`,
   `loadMemoryDocumentSummary`, `searchMemoryDocuments`, …). What task-008 deferred was the *CLI/MCP
   surface*, not the *module barrel*; those are different things and the note conflated them. The
   deliverable was therefore unreachable through `core`'s public API and no sibling unit (task-037's
   `context-builder`) could have consumed it without a deep path import. Fixed in this pass.
2. **The `(root@stateRef, …)` purity claim was not true.** `stateRef` is not a parameter and this
   function pins no git revision: it reads the **live working tree** under `root` via
   `listMemoryDocumentPaths`/`loadMemoryDocumentSummary`. The module doc now says what actually holds —
   referential transparency *over the observed working-tree state*: for one unchanged tree, selection
   and order are a pure function of `(the Memory documents under root, memoryYaml, element, limits)`,
   so repeated calls return an identical array. (`stateRef` is spec-012 §2's `ContextRequest` field; it
   belongs to the `context-builder` stage that resolves state, not to this unit.)
3. **The first pass's "561/561 GREEN … over the ~549 baseline" was not a baseline I had re-measured.**
   Re-measured at the start of this pass, on this branch with `main` already merged in (`44337c8`,
   which carries task-038/040/041): **`npx jest --maxWorkers=2` → 61 suites, 588 tests, all passing.**
   That is the real pre-change number this pass is measured against; the earlier "~549" figure should
   be disregarded.
4. **Follow-up 1 (deprecated-exclusion duplication) is closed**, not deferred — see dl-028 below.
5. **Follow-up 2 (the spec-012 §6 vs spec-001 `rejected` conflict) is closed by decision, not by the
   reasoning the first pass gave.** The first pass kept `'rejected'` on a "specs win, a `[SPEC]`-cited
   value is not silently dropped" argument. That was the right call at the time *and* it is now moot:
   `dl-028-archived-states-excluded-from-context` is `ready`, `spec-012` §6 and REQ-STATE-06 are both
   amended, and `rejected` is dropped **by the spec**, not by the code getting ahead of it.

### dl-028 — the ratified archived set (new work, not in the rejection)

`dl-028-archived-states-excluded-from-context` (`ready`) ratifies option (a): the archived set is
canonically **`{deprecated, superseded}`**, `rejected` is dropped, and **one shared predicate** serves
both the search path and the context path, superseding `task-038`'s `isDeprecatedStatus`. `spec-012` §6
and `REQ-STATE-06` (retitled "Archived content excluded from context") are already amended to match;
this pass implements them.

**`agent.read_related` on task-038.** `depends_on` is still `[]`, but this pass edits code task-038
owns and already merged to `main`, so its Execution Notes were read first (`dl-015`'s discipline
applied by analogy). The design intent that had to be preserved: **`draft` is excluded from *context*
but deliberately NOT from `memory search`.** task-038's AC2 keeps explicit lookup/browsing working and
its AC1 excludes only what REQ-STATE-06 names; spec-012 §6 additionally bars `draft` from an execution
context ("only stable, decided and still-current content"). Those are two different sets on purpose and
collapsing them would hide in-progress drafts from the search surface. They are now pinned by mirrored
assertions — `test/memory/query.test.ts` ("a `draft` document IS still returned by a default search")
and `test/core/relevance.test.ts` ("keeps `draft` excluded from CONTEXT — the context set is
archived ∪ {draft}").

**Placement + signature decision (the call the rejection asked me to make and justify).**

- **Home: `src/memory/state-machine.ts`, not `query.ts`.** `DEPRECATED_STATE` already lives there as
  the single source of truth for status literals; "which statuses are archived" is a statement about
  the state model, not about the query engine. `query.ts` (a scan/rank module) importing it reads
  correctly; `src/core/relevance.ts` importing it from a *query* module would not. Added alongside:
  `SUPERSEDED_STATE` and `ARCHIVED_STATUSES` (frozen, fixed order — REQ-SYS-07).
- **Signature: `isArchivedStatus(status: string | undefined): boolean` — a parsed status string, NOT
  `task-038`'s `(frontmatter: Record<string, unknown>)`.** This is exactly the composition problem
  task-038's reviewer flagged. Both call sites already project `status` out of frontmatter for their
  own result shape (`searchMemoryDocuments` builds `MemorySearchMatch.status`; `filterRelevantMemoryDocuments`
  builds `RelevantMemoryDocument.status`), so the frontmatter-shaped predicate forced them to either
  re-parse the same field or hand back a record they had already destructured. In `query.ts` the fix
  was literally to hoist the existing `const status = asString(frontmatter.status)` three lines up —
  one parse instead of two. Non-string/absent `status` values normalise to `undefined` at the caller's
  own projection and are never archived; that case is covered behaviourally
  (`test/memory/query.test.ts`, "a document whose `status` is not a string is never treated as
  archived") rather than by passing `42` into the predicate.

**Call sites moved onto it:** `src/memory/query.ts` (`searchMemoryDocuments`' default-exclusion guard),
`src/core/index.ts` (`memorySearchFn`'s explicit-`--status` override), `src/core/relevance.ts`
(`isExcludedFromContext = DRAFT_STATUS || isArchivedStatus`). **`isDeprecatedStatus` is removed
outright** (from `query.ts` and from `src/memory/index.ts`) rather than kept as an alias — it has no
consumer outside the repo (v0.2 is unpublished) and two names for one set is the divergence dl-028
exists to prevent. `MemorySearchOptions.includeDeprecated` is renamed **`includeArchived`** for the
same reason: after this change it opts back into both archived statuses, so the old name lied.
`memorySearchFn`'s override generalises from `status === DEPRECATED_STATE` to `isArchivedStatus(status)`,
so `--status superseded` resolves a superseded document just as `--status deprecated` always did.

### red

`test({module}) = test(core)` — commit **`f916cdd`**. **22 failing tests** across four suites
(`test/core/relevance.test.ts`, `test/memory/state-machine.test.ts`, `test/memory/query.test.ts`,
`test/core/memory-search.test.ts`), one or more per fixed behaviour. Observed failures, verbatim:

| Behaviour | Observed failure |
|---|---|
| barrel export | `expect(received).toBe(expected)` — `Expected: "function"`, `Received: "undefined"` (`typeof exported.filterRelevantMemoryDocuments`) |
| note on the scored set | `expect(received).toBeUndefined()` — `Received: "no relevant Memory found for task"` (one relevant doc, `maxBytes: 10`) |
| shared predicate | `TypeError: (0 , state_machine_1.isArchivedStatus) is not a function`; `TypeError: state_machine_1.ARCHIVED_STATUSES is not iterable` |
| archived set in context | `- Expected - 0 / + Received + 1 … + "adr-930-superseded"` (a superseded ADR still reached context) |
| archived set in search | a `superseded` ADR still returned by a default keyword search and by a default `--tag` browse |
| `includeArchived` opt-in | the renamed option did not exist, so the opt-in returned nothing archived |

The purity-claim finding is a documentation defect with no behavioural surface, so it carries no red
test (the testing directive's "never fabricate a red"); it is fixed in `green` with the rest of the
module doc.

### green

`feat(memory)` — commit **`0afc2c0`** (`{module} = memory`: the new shared primitive and the largest
share of the change live in `src/memory`). 125/125 across the four suites; **611/611 full suite**.
Changes exactly as described above: `state-machine.ts` gains `SUPERSEDED_STATE`/`ARCHIVED_STATUSES`/
`isArchivedStatus`; `query.ts` consumes it and renames the option; `core/index.ts` re-exports
`relevance.ts`'s three values + four types and generalises the `--status` override; `relevance.ts`
drops its local `EXCLUDED_STATUSES` (and the vestigial `rejected`) for `isExcludedFromContext`, moves
the note onto `scored.length === 0`, and has its module doc corrected (purity claim, resolved
follow-ups, the draft-vs-archived asymmetry).

### refactor

`refactor(core)` — commit **`864d90b`**. Two changes, tests green throughout:
1. `CONTEXT_EXCLUDED_STATUS` → `DRAFT_STATUS`, so `isExcludedFromContext` reads as "draft or archived"
   instead of an opaquely-named singular set.
2. The barrel-reachability test no longer reflects over the namespace through a
   `Record<string, unknown>` double cast (a code-quality smell): it imports the symbols from **both**
   `src/core` and `src/core/relevance` and asserts identity with `toBe`, and exercises the
   barrel-exported *types* (`ContextLimits`, `RelevanceElementRef`, `RelevantMemoryDocument`,
   `RelevantMemoryResult`) as well. Removing the re-export now breaks compilation of the suite in
   addition to failing the assertion.

**Refactor checks (all observed in this worktree):** `npx jest --maxWorkers=2` **611/611, 61 suites**;
`npx jest --coverage --maxWorkers=2` global **98.05 % stmts / 87.81 % branch / 97.78 % funcs /
98.49 % lines** (≥ 80); `npm run docs:api` exit **0**; `npx tsc -p tsconfig.build.json` exit **0**.

### review (developer side)

**Gate numbers, re-run at submit time and observed, not carried over:**

- `npx jest --maxWorkers=2` — **611 passed / 611 total, 61 suites, 0 failures.** (Pre-change baseline
  on this branch: 588/588, 61 suites — so **+23 tests**, no suite added: the new blocks extend four
  existing suites.) `test/cli/program.integration.test.ts`'s wall-clock assertion (`bug-011`, owned by
  `task-067`) did not fire at `--maxWorkers=2`; no `--maxWorkers=1` re-run was needed.
- `npx jest --coverage --maxWorkers=2` — global **98.05 / 87.81 / 97.78 / 98.49**. Touched files:
  `src/core/relevance.ts` 99 stmts / 84.5 branch / 100 funcs / 100 lines; `src/memory/query.ts` **100**
  stmts / 93.58 branch / 100 funcs / 100 lines; `src/memory/state-machine.ts` 95.65 / 97.14 / 100 /
  95.65 (the two uncovered lines are its pre-existing `default: never` exhaustiveness branch, which is
  unreachable by construction and untouched by this pass).
- `npm run docs:api` — exit **0**, no warnings (`treatWarningsAsErrors: true`, `requiredToBeDocumented`
  covers Variable/Function/Interface/TypeAlias — every new export carries TSDoc).
- `npx tsc -p tsconfig.build.json` — exit **0**.
- `npx eslint .` — **exactly 1 problem (1 error, 0 warnings)**, unchanged:
  `test/storage/git-backed-storage.test.ts:90 A require() style import is forbidden` — that is
  `bug-009`, owned by `task-066`, left untouched. **No new eslint error introduced.**

**Traceability.** REQ-PERF-05 (SARD `02_performance-nfr.md`) → `p5-interaction/P5.3.3-relevance-filtering.feature`
→ this task, via `spec-012-context-loader-relevance-filtering` §6 (amended); plus REQ-STATE-06 (SARD
`03_state-context.md`, amended and retitled) → `p1-memory/P1.9-memory-deprecate.feature` +
`P5.3.3-relevance-filtering.feature`, whose archived-set widening this pass implements on behalf of
`dl-028-archived-states-excluded-from-context`. No new `tech-spec` scaffolded — `spec-012` already
covers the scope and is `approved`.

**Determinism (REQ-SYS-07).** `ARCHIVED_STATUSES` is a frozen array in fixed order, not a `Set`;
`isArchivedStatus` is a pure string comparison; the note guard reads a length. No wall-clock,
randomness, or unordered iteration added anywhere.

**Scope boundaries — deliberately NOT done here.**

- `bug-010-deprecated-reaches-agent-context` (the *surfaces* where archived content still reaches an
  agent) stays open: dl-028 decides the *set*, that bug fixes the *reach*.
- `task-038`'s own Memory file is left untouched. It is `done` and merged; the supersession of its
  `isDeprecatedStatus` is recorded by `dl-028` and here, not by rewriting a closed task's notes.
- spec-012's other three units (`dna-loader`, `directive-loader`, `context-builder`) and the §7
  envelope remain `task-037-role-task-scoped-context`'s scope, unchanged from the first pass.
