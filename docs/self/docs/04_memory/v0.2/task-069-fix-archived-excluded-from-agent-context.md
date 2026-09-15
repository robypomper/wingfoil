---
id: "task-069-fix-archived-excluded-from-agent-context"
type: task
title: "Fix: archived documents still reach agent context through the MCP collection Resource and the context builder"
status: in-review
release: "v0.2"
priority: "High"
tags: ["v0.2", "architecture"]
ref: "REQ-STATE-06"
bug: "bug-010-deprecated-reaches-agent-context"
depends_on: ["task-035-bounded-context-relevance", "task-037-role-task-scoped-context"]
tmpl_version: 260703
---

## Description

REQ-STATE-06's Fit Criterion — *"a `deprecated` document never appears in an assembled agent
context"* — is unmet on **two** surfaces, and `dl-028` widened the set it must be met against.

1. `src/mcp/memory-resource.ts` builds the `wingfoil://memory/{type}` collection by calling
   `listMemoryDocumentsByType` with no status filter, so an agent reading `wingfoil://memory/adr`
   receives archived ADRs. Its sibling `wingfoil://memory/search` **is** filtered (`task-038`), so the
   two agent-facing read paths are mutually inconsistent.
2. `assembleExecutionContext` (`src/core/context.ts`, landed by `task-037`) resolves the target
   element's Memory document with no filter at all.

## Acceptance Criteria

1. Both surfaces exclude archived documents, using the **shared** `isArchivedStatus`
   (`src/memory/state-machine.ts`, exported from `src/memory`) — not a second local predicate. That
   primitive is what `dl-028` ratified as the single definition.
2. The excluded set is `{deprecated, superseded}` per `dl-028` and `spec-012` §6 as amended — **not
   `deprecated` alone**. A fix that closes only half the set closes none of the decision.
3. `draft`'s asymmetry is preserved: excluded from **context**, still returned by a default
   `memory search`. `task-038` built that deliberately and `task-035` pinned it with mirrored
   assertions; do not collapse the two sets.
4. Explicit retrieval still works: a `superseded` ADR remains resolvable by id, and
   `--status superseded` / `--status deprecated` still resolve. Verify on the real CLI, not only in
   tests — `task-035`'s reviewer established that as the bar for this area.
5. Full suite, coverage ≥80, `docs:api`, `tsc` and `eslint` all green.

## Implementation Notes

Scheduled into `v0.2` under the exception extended in **`dl-034`** point 4, and admitted on
**ordering rather than urgency**. Both surfaces are unwired today — no `.mcp.json` exists (`dl-026`),
and `assembleExecutionContext` has no CLI or MCP surface — so nothing leaks right now. What makes this
a v0.2 concern is **`task-055-auto-load-directives-by-role`**: it delivers P3.6, auto-loading
directives into agent context at task execution, which is precisely what makes the context path
user-reachable. If `task-055` lands first, v0.2 ships a context path that leaks archived documents.
Same ordering logic that put `task-064` ahead of `task-057`.

The fix is cheap because the groundwork is done: `dl-028` settled the set, `task-035` delivered the
shared predicate. Expect roughly two call sites plus their tests.

`bug-010` is linked, so `dev-loop`'s `bug.sync_state` advances it automatically.

## Execution Notes

### start

Branch `task/task-069-fix-archived-excluded-from-agent-context`, worktree
`/home/robypomper/Workspaces/.wf2-wt/task-069-fix-archived-excluded-from-agent-context`. Task
`backlog → in-progress` (`46e6b01`); `bug.sync_state` advanced `bug-010-deprecated-reaches-agent-context`
`planned → in-progress` (`900f26b`) — this task is the bug's only fix task, so the aggregate rule is 1:1.

### design

#### `agent.classify_acs` (T1)

| AC | Classification | Why |
|---|---|---|
| **AC-1** — both surfaces exclude archived via the shared `isArchivedStatus` | **red-first** | Neither call site filters today: `src/mcp/memory-resource.ts:67` maps `listMemoryDocumentsByType(...)` straight through, and `src/core/context.ts:187-188` wraps `findMemoryDocumentByTypeAndId`'s result in `doc ? [doc] : []`. New behaviour on both. |
| **AC-2** — the set is `{deprecated, superseded}`, not `deprecated` alone | **red-first** | A `superseded` ADR reaches both surfaces today for the same reason. Given separate reds from AC-1's `deprecated` cases so that a `deprecated`-only fix stays visibly red. |
| **AC-3** — `draft`'s asymmetry preserved (excluded from *context*, kept by default `memory search`) | **characterization** | Already built: `task-038` kept `draft` searchable, `task-035` excluded it from `relevance.ts`'s candidate filter, and both halves are pinned by mirrored assertions in `test/memory/query.test.ts` and `test/core/relevance.test.ts`. Nothing here may change it; pinned by re-running those suites plus a new `assembleExecutionContext`-level pin that a `draft` **subject** element still assembles (green on first run — no fabricated red, per the testing directive). |
| **AC-4** — explicit retrieval keeps working (`superseded` ADR by id; `--status superseded`/`--status deprecated`) | **characterization** | `wingfoil://memory/{type}/{id}` never filtered and is not being changed; `memorySearchFn`'s explicit-`--status` override was generalised onto `isArchivedStatus` by `task-035`. Pinned by new by-id Resource assertions **and** by exercising the compiled CLI, which is the bar `task-035`'s reviewer set for this area. |
| **AC-5** — gates green | process, not a code AC. |

#### `agent.read_related` (dl-015 HARD gate) — acknowledgement

**`task-035-bounded-context-relevance`** (both passes read, including the second-pass corrections).
Three things it constrains here:

1. **The predicate's home, name and signature are settled and must not be re-litigated.**
   `isArchivedStatus(status: string | undefined)` lives in `src/memory/state-machine.ts` (with
   `SUPERSEDED_STATE` and the frozen `ARCHIVED_STATUSES`) and is re-exported from `src/memory`. It
   takes an **already-projected status string**, not a frontmatter record — task-035 chose that shape
   precisely because every call site already projects `status` for its own result type, and the
   frontmatter-shaped `isDeprecatedStatus` forced callers to re-parse. Both of my call sites must
   therefore project first and pass a `string | undefined`; neither may re-derive "archived".
2. **`draft` is deliberately NOT in the archived set**, and the two sets differ on purpose:
   `src/core/relevance.ts` excludes `DRAFT_STATUS || isArchivedStatus(...)`; default `memory search`
   excludes only the archived half. task-035 pinned both halves with mirrored assertions. So my fix
   adds **no** `draft` handling anywhere — doing so would collapse exactly the asymmetry AC-3 protects.
3. **The scope boundary task-035 left open is precisely this task.** Its review notes state that
   `bug-010` "stays open: dl-028 decides the *set*, that bug fixes the *reach*" — the set is done, the
   reach is mine. It also renamed `MemorySearchOptions.includeDeprecated` → `includeArchived` and
   generalised `memorySearchFn`'s `--status` override to `isArchivedStatus(status)`, which is what
   makes AC-4's `--status superseded` already work and a characterization rather than new work.

**`task-037-role-task-scoped-context`** (both passes read). Four things it constrains here:

1. **It states this gap explicitly and names the fix.** Its second-pass review lists
   `bug-010` under "deliberately out of scope, and why": `assembleExecutionContext` does not filter,
   the bug owns *both* this surface and the MCP collection Resource, and the fix must go through
   `isArchivedStatus` against dl-028's set. My design is that instruction executed, not a new choice.
   The gap is recorded in two places in the source — the module header (`src/core/context.ts:10-11`)
   and `assembleExecutionContext`'s own TSDoc (its closing paragraph) — and **both** must be rewritten
   to describe what the code now does.
2. **`memory` is a walk with an early exit, not an addressed read.** task-037's second pass corrected
   a first-pass claim to the opposite effect: `findMemoryDocumentByTypeAndId` iterates
   `listMemoryDocumentPaths` in sorted order and YAML-parses each frontmatter until it matches. I
   re-read `src/memory/query.ts:241-252` to confirm this holds today, and it does. Consequence for me:
   the filter belongs **after** the lookup returns, and it changes only which resolved document is
   *kept* — it does not and cannot make the walk cheaper or skip archived documents during the walk.
3. **The throw contract must survive.** A `ValidationError` (`E_YAML_PARSE_ERROR`) from a malformed
   document *visited during the walk* still propagates out of assembly; an unresolvable element still
   yields `[]`, not an error. A post-lookup filter preserves both, and the existing pins stay green.
4. **`warnings` is a diagnostic about the context, not content of it**, and dl-029's warning fires on
   directive resolution only. An archived element therefore produces **no** new warning — inventing
   one would add an unratified output to a path REQ-SYS-07 governs. `memory` simply becomes `[]`,
   which the existing "unresolvable element yields an empty memory section" contract already models.

#### Design decisions

**D1 — filter at the two agent-facing call sites; leave both scan primitives neutral.**
`listMemoryDocumentsByType` and `findMemoryDocumentByTypeAndId` each serve a *filtered* and an
*unfiltered* consumer, so the exclusion cannot live inside them:

- `findMemoryDocumentByTypeAndId` backs **both** `assembleExecutionContext` (must filter) and the
  `wingfoil://memory/{type}/{id}` single-document Resource (must **not** — AC-4, and bug-010's own
  Expected Behavior says the archived document stays "retrievable by explicit id").
- `listMemoryDocumentsByType`'s neutrality is *pinned*: `test/memory/query.test.ts:319`,
  "`AC2 (characterization)` — `listMemoryDocumentsByType` browsing still includes a deprecated
  document", is task-038's deliberate statement that the primitive is not the policy layer. Changing
  the primitive's default would break that pin and widen the blast radius past bug-010's reach.

This keeps dl-028's "one shared predicate" intact — one *definition*, consumed at each surface — which
is what the DL ratified; it does not ask for one *call site*.

**D2 — neither surface excludes `draft`, and they exclude `draft` for different (non-)reasons.**
- MCP collection: a browse/listing surface, the sibling of default `memory search`. dl-028's set is
  `{deprecated, superseded}`; `draft` is not in it. A draft task must keep showing up in
  `wingfoil://memory/task`.
- `assembleExecutionContext`: excludes the archived set only. spec-012 §6's *additional* `draft`
  exclusion is scoped to **relevance filtering over candidate documents** — `src/core/relevance.ts`,
  which also excludes the element's own document. `assembleExecutionContext`'s `memory` is the
  **subject** element (spec-012 §3's `resolve-element` stage, not §6's filter), so excluding `draft`
  there would blank the context for the very element being worked on, and would be a widening neither
  dl-028 nor REQ-STATE-06 authorises. REQ-STATE-06's Fit Criterion, by contrast, is unconditional —
  "a `deprecated` or `superseded` document never appears in an assembled agent context" — and does
  cover the subject element, which is why the archived half applies here and the `draft` half does not.

**D3 — status projection at each call site.** `isArchivedStatus` takes `string | undefined`.
`listMemoryDocumentsByType` already returns `status?: string`, so the MCP site passes it directly.
`MemoryDocumentSummary.frontmatter` is `Record<string, unknown>`, so `context.ts` narrows with a
`typeof === 'string'` check first — exactly the "normalised by the caller's own frontmatter
projection" contract `isArchivedStatus`'s TSDoc states. A non-string `status` is never archived.

**D4 — determinism (REQ-SYS-07).** Both changes are pure predicate filters over already-ordered
arrays: `Array.prototype.filter` preserves `listMemoryDocumentsByType`'s id-ascending order, and the
context site turns a 0-or-1 array into a 0-or-1 array. No wall-clock, randomness or unordered
iteration is added to either context-building path.

#### `agent.verify_specs`

No new `tech-spec` needed — **pass-through**, so `design`'s `approval: {by_role: approver}` does not
fire (it gates only a newly scaffolded spec). Scope is already covered by approved, amended artefacts:
`spec-012-context-loader-relevance-filtering` (`approved`) §6 — amended to exclude
`{deprecated, superseded}` and to drop the vestigial `rejected`, naming `isArchivedStatus` as the
shared predicate; `REQ-STATE-06` (SARD `03_state-context.md`) — amended and retitled "Archived content
excluded from context", its Fit Criterion now naming both statuses; and
`dl-028-archived-states-excluded-from-context` (`ready`), which ratified option (a).
`spec-004-mcp-surface-contract` §2.1/§2.2 governs the two Resource shapes and is unchanged by this
task — the collection still returns `{id, title, status, tags}` summaries, just fewer of them.

**Traceability:** REQ-STATE-06 → `p1-memory/P1.9-memory-deprecate.feature`, Scenario *"Deprecated
documents are excluded from default agent context"* (*"When an agent fetches relevant Memory for a
task / Then `decision-12` is NOT included in the returned context"* — the Memory-fetch step is served
today by `assembleExecutionContext` for the subject element and by `filterRelevantMemoryDocuments` for
related ones; task-035 already satisfied the second half, this task the first) +
`p5-interaction/P5.2.1-mcp-resources.feature` (the Memory Resources channel) → `dl-028` → this task,
fixing `bug-010-deprecated-reaches-agent-context`.

**Checks (post):** `frontmatter.required` — satisfied. `tech-spec.approved` — spec-012 `approved`,
no new spec. `depends_on.acknowledged` — satisfied above for both `depends_on` entries.

### red

Two commits, one per surface, so each module's red is separable: **`e0c0bec`** `test(mcp)` and
**`fc66759`** `test(core)`. Run together: **5 failed / 55 passed** — the four red-first cases, plus the
`draft` listing assertion which fails for the same reason (an unfiltered collection shows the
deprecated task too). The AC-4 and AC-3-context cases were green from the start, as their
characterization classification predicted. Observed failures, verbatim:

| Surface / behaviour | Observed failure |
|---|---|
| MCP collection, `deprecated` | `expect(received).not.toContain(expected)` — `Expected value: not "task-004-gone"` / `Received array: ["task-001-foo", "task-003-draft", "task-004-gone"]` |
| MCP collection, `superseded` (the AC-2 half) | `- Expected - 0 / + Received + 1` … `Array [ "adr-001-foo", + "adr-002-old" ]` |
| MCP collection, `draft` still listed | `Array [ "task-001-foo", "task-003-draft", + "task-004-gone" ]` — same cause |
| `assembleExecutionContext`, `deprecated` | `- Expected - 1 / + Received + 14` … `+ "status": "deprecated"`, `+ "path": "docs/04_memory/v0.1/task-105-gone.md"` (the archived subject document assembled into `memory`) |
| `assembleExecutionContext`, `superseded` | same shape, `+ "status": "superseded"`, `+ "path": "docs/04_memory/design/adrs/adr-002-old.md"` |

The MCP fixture is a **separate** repo seeder (`seedArchivedFixtureRepo`) rather than extra documents
in `seedFixtureRepo`, so task-011's exact-equality listing assertions keep pinning its own contract
unchanged; the shared config writes were extracted to `writeFixtureConfig` instead of duplicated.

### green

**`5752eee`** `feat(mcp)` and **`2e338f1`** `feat(core)`.

- `src/mcp/memory-resource.ts` — the collection handler now filters
  `listMemoryDocumentsByType(...)`'s result on `!isArchivedStatus(status)` before mapping to the
  spec-004 §2.1 summary shape. `status` arrives already projected as `string | undefined` from the
  primitive, so nothing re-parses frontmatter. The single-document handler is untouched.
- `src/core/context.ts` — `assembleExecutionContext` projects the resolved document's
  `frontmatter.status` with a `typeof === 'string'` narrow and keeps the document only when
  `!isArchivedStatus(status)`; otherwise `memory` is `[]`. `isArchivedStatus` is imported from the
  `../memory` barrel (the same path the module already used for `findMemoryDocumentByTypeAndId`), not
  redefined.

Both are `isArchivedStatus` from `src/memory/state-machine.ts`. **No second predicate was written, and
the archived set was not touched** — `ARCHIVED_STATUSES`, `searchMemoryDocuments`' default exclusion,
`MemorySearchOptions.includeArchived`, `relevance.ts`'s `isExcludedFromContext` and `DRAFT_STATUS` are
all unmodified in this task's diff.

**Doc corrections (the point the task brief called out explicitly).** task-037 recorded this gap in
two places and both now describe what the code does:
1. `src/core/context.ts`'s **module header** said "no archived-status exclusion (§6, REQ-STATE-06 —
   `bug-010` owns that here)". It now states that archived elements are excluded through the shared
   predicate, and names this task/bug as what closed it; the rest of the "not the full spec-012
   pipeline" list (no `stateRef`, no T1–T4 ranking, no bounding, no §7 envelope) is still true and is
   kept, re-worded to "still deliberately NOT".
2. `assembleExecutionContext`'s **TSDoc** closing paragraph said "`memory` is also **not** filtered by
   document status". Rewritten to state the filter, why it sits after the lookup rather than inside
   `findMemoryDocumentByTypeAndId`, why `draft` is deliberately *not* excluded here, and that an
   archived element emits no warning (so it is indistinguishable from an unresolvable one).
   `ExecutionContext.memory`'s own field doc was updated for the same reason.
   `src/mcp/memory-resource.ts`'s module header gained the matching statement of the two handlers'
   deliberate difference.

### refactor

**`1672ad6`** `refactor(core)` — `test/core/context.test.ts`'s two describes each rebuilt the same
four-pillar loader wiring to assemble a context; hoisted to one `assembleFrom(repo, role, type, id)`,
with each describe keeping a thin local `assemble` for what it varies. No production code changed,
tests green throughout. No production refactor was warranted: each surface's change is a single
predicate filter over an already-ordered array.

**Refactor-phase checks, all observed in this worktree:** `npx jest --maxWorkers=2` **879/879, 69
suites**; `npx jest --coverage --maxWorkers=2` global **98.17 % stmts / 88.88 % branch / 98.2 % funcs /
98.73 % lines**; `npm run docs:api` exit **0**; `npx tsc -p tsconfig.build.json` exit **0**;
`npx eslint .` exit **0**.

### review (developer side)

**Gate numbers — re-run at submit time in this worktree, observed, not carried over:**

- `npx jest --maxWorkers=2` — **879 passed / 879 total, 69 suites, 0 failures**, ~66 s. Pre-change
  baseline **measured**, not inferred: checking `test/core/context.test.ts` and
  `test/mcp/read-only-resources.test.ts` out at `900f26b` and re-running those two suites gives
  **47/47**; they now hold 60, so this task adds **+13 tests** and the full-suite baseline was 866.
  No new suite — both new blocks extend existing suites. `bug-011`'s wall-clock assertion in
  `test/cli/program.integration.test.ts` did not fire at `--maxWorkers=2`.
- `npx jest --coverage --maxWorkers=2` — global **98.17 / 88.88 / 98.2 / 98.73**, over the 80 % floor.
  Touched files: `src/core/context.ts` **100/100/100/100**, `src/mcp/memory-resource.ts`
  **100/100/100/100**. `src/memory/state-machine.ts` and `src/memory/query.ts` are unchanged by this
  task and their coverage is unchanged with it.
- `npm run docs:api` — exit **0** (hard-reject regime; every touched exported declaration keeps TSDoc).
- `npx tsc -p tsconfig.build.json` — exit **0**.
- `npx eslint .` — exit **0** (`lint.clean`, ACTIVE hard-reject per `dl-034`).

**AC-4 verified on the real compiled artifacts, not only in-process** — the bar `task-035`'s reviewer
set for this area. `npm run build`, then a scratch repo carrying a live task, a `draft` task, a
`deprecated` task and a `superseded` ADR (all tagged `api`):

- `node dist/cli.js memory search api` → exit 0, **two** matches: `task-201-live` (`in-progress`) and
  `task-203-early` (**`draft`**). Both archived documents absent. This is *both* halves of the draft
  asymmetry observed on the real CLI in one command.
- `node dist/cli.js memory search api --status superseded` → exit 0, resolves `adr-201-old`
  (`status: superseded`).
- `node dist/cli.js memory search api --status deprecated` → exit 0, resolves `task-202-gone`
  (`status: deprecated`).
- Driving the compiled **MCP server** (`node dist/cli.js mcp`) over a real stdio transport with an MCP
  SDK client against the same repo: `wingfoil://memory/task` → `['task-201-live (in-progress)',
  'task-203-early (draft)']`; `wingfoil://memory/adr` → `[]` (the superseded ADR withheld); and by id,
  `wingfoil://memory/adr/adr-201-old` → `metadata.status: "superseded"` with its full 119-byte body,
  `wingfoil://memory/task/task-202-gone` → `metadata.status: "deprecated"` with its full body. The
  collection withholds, the by-id Resource still serves — on the shipped binary, end to end.

**Set correctness (AC-2).** Both surfaces are covered by a `deprecated` case **and** a `superseded`
case, in tests and on the compiled artifacts. A fix that closed only `deprecated` leaves
`test/mcp/read-only-resources.test.ts` › "a `superseded` ADR is absent too" and
`test/core/context.test.ts` › "a `superseded` element yields an empty `memory` section too" red, and
shows `adr-201-old` in the live MCP collection.

**Draft asymmetry (AC-3), both halves.** *Still searchable:* `test/memory/query.test.ts`'s task-035
mirrored assertions pass untouched, and the real CLI returns the draft document above. *Still excluded
from relevance-ranked context:* `test/core/relevance.test.ts`'s "the context set is archived ∪ {draft}"
passes untouched. Newly pinned: a `draft` **subject** element still assembles
(`test/core/context.test.ts`), and a `draft` document is still listed by the MCP collection. Nothing in
this task's diff touches `DRAFT_STATUS`, `ARCHIVED_STATUSES` or `searchMemoryDocuments`.

**Traceability.** REQ-STATE-06 (SARD `03_state-context.md`, amended/retitled) →
`p1-memory/P1.9-memory-deprecate.feature` "Deprecated documents are excluded from default agent
context" + `p5-interaction/P5.2.1-mcp-resources.feature` → `spec-012` §6 (amended) /
`spec-004` §2.1–§2.2 → `dl-028-archived-states-excluded-from-context` (`ready`) → this task →
`bug-010-deprecated-reaches-agent-context`. No new tech-spec.

**Determinism (REQ-SYS-07).** Both changes are pure predicate filters over already-ordered data:
`Array.prototype.filter` preserves `listMemoryDocumentsByType`'s id-ascending order, and the context
site maps a 0-or-1 array to a 0-or-1 array. No wall-clock, randomness or unordered iteration was added
to either context-building path; the MCP determinism test ("two calls return byte-identical results")
still passes.

**`bug.sync_state`.** `bug-010-deprecated-reaches-agent-context` advances `in-progress → in-review` in
this same commit — this task is its only fix task, so the aggregate rule is 1:1. Both surfaces the bug
names are fixed, so nothing of it is left open.

**Deliberately out of scope.**

- The scan primitives `listMemoryDocumentsByType` and `findMemoryDocumentByTypeAndId` stay neutral
  (D1), so `test/memory/query.test.ts`'s task-038 characterization that the primitive "still includes
  a deprecated document" is still true and still passing. Anyone later adding a *third* agent-facing
  consumer of either primitive must apply the filter at their own call site; a future task that gives
  the primitives an `includeArchived`-style option (mirroring `MemorySearchOptions`) would be a
  reasonable consolidation, but it is not this bug's reach.
- `wingfoil://memory/search`'s own Resource was already filtered by task-038/task-035 and is untouched.
- Neither surface is wired to anything a user reaches today: no `.mcp.json` exists (`dl-026`, `ready`)
  and `assembleExecutionContext` still has no CLI/MCP surface — `task-055-auto-load-directives-by-role`
  supplies that, which is the ordering argument that put this task in v0.2. The MCP server itself is
  real and was exercised above by launching it directly.
- `CLAUDE.md` untouched (`task-068`'s concurrent scope).
