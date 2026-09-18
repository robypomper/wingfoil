---
id: "task-048-memory-deprecate"
type: task
title: "Implement `wingfoil memory deprecate`"
status: in-progress
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "p1"]
ref: "P1.9"
bug: ""
depends_on: ["task-035-bounded-context-relevance", "task-038-deprecated-excluded-from-context"]
tmpl_version: 260703
---

## Description

As Casey, deliver feature **P1.9** (US-5-04): deprecate an approved document; frontmatter becomes `status: deprecated`, file remains present.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.9-memory-deprecate.feature`.

Key scenario: `wingfoil memory deprecate decision-12 --reason 'superseded by decision-20'` → `status: deprecated`; file retained; exit 0.

## Implementation Notes

Depends on REQ-STATE-06 deprecated-exclusion (`task-038`). Callable from any state per the type machines (`spec-001`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### start — role: developer

`status: backlog → in-progress` (`b6175b7`). `bug: ""` → no `bug.sync_state`. Branch
`task/task-048-memory-deprecate`, worktree `/home/robypomper/Workspaces/.wf2-wt/task-048-memory-deprecate`,
created from `main` at `9147d84`.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer, for red/green/refactor); doc-versioning, documentation, security-secrets
(global).

#### read_related (`dl-015`, HARD gate) + governance acknowledgements

- **`task-035-bounded-context-relevance` (`depends_on`) — read, `done`.** It ships
  `filterRelevantMemoryDocuments` (`src/core/relevance.ts`, spec-012 §6) — the only "assembled agent
  context" surface that exists — and, on its second pass, `dl-028`'s shared predicate
  `isArchivedStatus(status)` + `ARCHIVED_STATUSES = [deprecated, superseded]` in
  `src/memory/state-machine.ts`, which **supersedes `task-038`'s `isDeprecatedStatus`** (removed
  outright). Consequence taken on: this task's BDD sc.2 test must call
  `filterRelevantMemoryDocuments` (the real context path), and must **not** reach for
  `isDeprecatedStatus`, which no longer exists — verified, not assumed:
  `grep -rn "isDeprecatedStatus" src/` → 2 hits, both prose doc-comments recording the supersession
  (`state-machine.ts:101`, `query.ts:37`) and no declaration or call;
  `grep -rn "isArchivedStatus" src/ | wc -l` → 25 (declaration in `state-machine.ts`, call sites in
  `query.ts`, `core/index.ts`, `relevance.ts`, plus TSDoc). Its context set is `archived ∪ {draft}`, wider
  than default `memory search`'s `archived` — a deliberate asymmetry this task must not collapse.
- **`task-038-deprecated-excluded-from-context` (`depends_on`) — read, `done`.** REQ-STATE-06's
  search half: `searchMemoryDocuments` skips archived documents by default;
  `MemorySearchOptions.includeArchived` (renamed from `includeDeprecated` by task-035) opts back in,
  and `memorySearchFn` sets it only when the caller's `--status` narrow is explicit. Its AC2 —
  a deprecated document stays resolvable by explicit lookup and stays **present on disk and in git
  history** — is exactly P1.9 sc.1's "the file remains present in the repository"; this task asserts
  the file-retention half on the real verb rather than re-deriving it. task-038 also recorded the
  scope boundary this task closes: it shipped the exclusion primitive but "does not build
  `context-builder` itself" and had no verb to produce a deprecated document.
- **`task-041-mandatory-reason-on-verbs` — read, `done`.** Not in this task's `depends_on` any more
  (see the `depends_on` note below), but read in full because it owns `--reason`. It scoped
  `requireReason` to `approve`/`reject` **deliberately**, and its Execution Notes say so verbatim:
  "`memory deprecate` (task-048) will read `options?.reason` directly and NOT call the helper". This
  task does exactly that — the helper is neither called nor forked.
- **`task-045-memory-submit` — read, `done`.** Everything reused, nothing forked:
  `prepareMemoryTransition` / `commitMemoryTransition` (`src/core/memory-transition.ts`, including the
  `verifyFrontmatterEdit` re-parse post-condition that refuses the write when any unowned field
  moved), `formatMemoryCommitMessage` (`src/memory/commit-message.ts` — its optional `transition`
  bracket and independent `approver` / `reason` body lines are exactly the shape this verb needs),
  `setFrontmatterField` (`src/memory/frontmatter-edit.ts`), `resolveTypeTransition` /
  `resolveStateMachine` (`src/memory/state-machine.ts`).
- **`task-047-memory-reject` — read, `done`.** Its `memoryRejectFn` is the structural model for
  `memoryDeprecateFn` (identity → id → load → prepare → render → commit). Its `renderRejectDocument`
  is NOT mirrored — see the `green` note on why this verb calls `setFrontmatterField` directly instead
  of adding a one-call `renderDeprecateDocument`. Its bug-041 fixes to `frontmatter-edit.ts` (separating
  space before a re-attached `#` tail; column-0 comment inside a nested block; append after the last
  non-blank line) are inherited as-is — this verb writes through the same editor, so the same three
  shapes are safe here without re-fixing anything.
- **`dl-027-req-sec-04-deprecate-reason-scope` (`ready`) — see D2/D3 below.**
- **`dl-054-submit-commit-subject-bracket` (`ready`, option 2) — see D4 below.**
- **`dl-053-illegal-transition-target-for-verbless-edges` (`ready`, option 1) — read, and
  deliberately NOT consumed.** `contractTarget` is only ever reached from
  `resolveTypeTransition`'s `catch`, and `resolveTransitionTarget` **returns before any legality
  check when `op === 'deprecate'`** (`src/memory/state-machine.ts:183-186`): the wildcard edge is
  legal from every state, so `deprecate` can never raise `E_INVALID_TRANSITION` and never prints a
  `<to>`. This task therefore touches **no line of `src/memory/state-machine.ts`** and has no
  contention with `task-046`, which owns that correction. Checked, not assumed:
  `git log main --oneline -- src/memory/state-machine.ts | head -1` → `214c3ac … task-045-memory-submit`
  — task-046's fix is **not** on `main` as of this design, and it does not matter here either way.
- **`depends_on` note.** The registry snapshot in the dev-loop plan §4 lists this task as depending on
  task-035, task-038 **and** task-041, but the task file's `depends_on` names only the first two.
  That is not drift: `dl-027`'s Actions for the ratified option (a) say "drop the now-vacuous
  `depends_on` on `task-048-memory-deprecate`" — once `--reason` is optional on `deprecate`, the
  task-041 edge carries nothing. The file is already reconciled; the plan §4 table is the stale
  side, and it says of itself "a derived snapshot for readability". Filed in the final report, not
  fixed here (editing the plan is out of a task's scope).

#### verify_specs — no new `tech-spec` needed

All 15 specs are `approved`, counted from frontmatter only (not from example blocks in spec bodies):
`for f in docs/self/docs/04_memory/design/specs/*.md; do awk 'NR>1 && /^---$/{exit} /^status:/{print $NF}' "$f"; done | sort | uniq -c` → `15 approved`.
Every semantic this verb needs is already pinned:

- `spec-001-memory-yaml-schema` §"`deprecated` is implicit" (`:94-96`) — "a built-in wildcard edge
  from *any* state to a reserved `deprecated` state, always legal, invoked via
  `wingfoil memory deprecate`… **never** declared in `sequence`/`gates`/`waiting`".
- `spec-004-mcp-surface-contract` §4.1 (`wingfoil memory deprecate → memory.deprecate`, `:156`) and
  §4.3 (one commit, identical CLI/MCP shape; the `[from → to]` bracket paragraph, `:197-206`).
- `spec-006-core-domain-api` §3 — `memoryDeprecate`, module `memory`, `mutates: true`, CLI
  `wingfoil memory deprecate`, Tool `memory.deprecate`. The row carries the `*(planned)*` marker §3
  defines as "not yet registered"; registering the operation makes it stale, so that one row drops it
  (the same edit task-045 and task-047 made to their own rows).
- `spec-008-cli-grammar` §2 (`--reason` "optional elsewhere (e.g. `memory deprecate`)"), §5 (exit
  codes), §7 (`memory deprecate <id>` named explicitly as a bare-`<id>` positional command).
- `spec-009-validation-strategy` §3 — exit code by nature of failure.
- `spec-010-memory-frontmatter-schema` — `status` is the only state carrier; field-write ownership
  row for `memory.deprecate` (see D1).
- `spec-012-context-loader-relevance-filtering` §6 — archived documents excluded from context.
- REQ-SEC-01 (git identity), REQ-SEC-04 as amended by `dl-027` (see D2), REQ-STATE-01 (state derived
  from frontmatter), REQ-STATE-06 as amended by `dl-028` (archived = `deprecated` on any type +
  `superseded` on `adr`/`tech-spec`), REQ-SYS-05 (one behaviour behind both surfaces), REQ-SYS-07
  (determinism).

`design` passes through with **no approver gate** — no new spec scaffolded.

#### D1 — the target state, and the `superseded` question (the reconciliation the brief asked for)

**Decision: the target is whatever `resolveTypeTransition(memoryYaml, type, from, 'deprecate')`
returns — never a literal in this verb's code.** On every type registered in `memory.yaml` that is the
reserved `deprecated` state, because `resolveTransitionTarget`'s `deprecate` arm returns
`DEPRECATED_STATE` unconditionally (`state-machine.ts:183-186`), implementing spec-001's "implicit
wildcard edge from *any* state". The verb never names a state; it asks the engine, which is a pure
function of the type's machine as loaded from `memory.yaml`.

**Why that means `adr`/`tech-spec` deprecate to `deprecated`, not `superseded`.** Three artefacts say
`superseded` is *not* a `deprecate` target:

1. `memory.yaml` itself — `superseded` is a `sequence` member listed under `waiting:`
   (`waiting: [ accepted ]`, comment "accepted→superseded: triggered by a later ADR's `supersedes:`"),
   and `spec-001` `:75` defines `waiting` as "states whose forward edge has **no CLI verb at all** —
   it fires only as a side effect of a Workflow step's `element.set_state(...)` action or an engine
   trigger (e.g. another element's `supersedes:` field)".
2. `src/memory/state-machine.ts:74-80` (`SUPERSEDED_STATE`'s TSDoc, shipped by task-035): superseded is
   "reached along the forward `sequence`… **never by `memory deprecate`**".
3. REQ-STATE-06 as amended by `dl-028` treats `deprecated` and `superseded` as two *members of the
   archived set*, not as one verb's per-type target.

Against them stands one sentence, in two places with identical wording: `spec-010`'s field-write
ownership row `| memory.deprecate | status: deprecated (or a type-specific deprecate-adjacent state
first, e.g. accepted → superseded) |`, echoed verbatim by CLAUDE.md §5.1's step 1. Read as a claim
about **what the verb writes**, it contradicts spec-001 and the shipped engine. Read as a claim about
**the human retirement procedure** — "before deprecating an ADR, consider moving it to `superseded`
instead, which is a different (engine-driven) edge" — it is consistent with everything else, and the
word "first" points that way.

**Reading taken:** the second. The verb implements spec-001's wildcard edge only; `superseded` stays
the `supersedes:`-driven `waiting` edge no CLI verb owns. Making `deprecate` write `superseded` for
two types would (a) require the verb to special-case a state literal per type, which is precisely what
the brief forbids and what no `memory.yaml` field declares, and (b) contradict `spec-001`, the
`StateMachine` schema's own `.superRefine()`, and the engine task-045 already shipped and task-046/047
already build on. **Filed as a proposed decision-log in the final report** (spec-010's row + CLAUDE.md
§5.1's parenthetical need rewording to say "procedure", or the DL must reopen spec-001) — rule 2 of the
wave brief: not absorbed silently.

#### D2 — `--reason` is OPTIONAL (dl-027 option (a), already applied to the SARD)

`dl-027-req-sec-04-deprecate-reason-scope` (`ready`) ratified **option (a)**: narrow REQ-SEC-04 to the
approval gates. This is not a reading — it is already in the tree. Verified:
`grep -n -A9 'REQ-SEC-04 —' docs/02_requirements/03_sard/05_security-compliance.md` → Description
"`approve` and `reject` require a `--reason`", Fit Criterion names `approve`/`reject` only, and the
Traceability line ends "Narrowed to the approval gates by `dl-027-…`: `memory deprecate` is not an
approval gate (**no `Approver:` line, no authority check**), and `spec-008` §2 / BDD P1.9 /
CLAUDE.md §5.1 already treat its `--reason` as optional-but-encouraged."

So: `memoryDeprecateFn` reads `options?.reason` directly, **does not call `requireReason`**, and
`wingfoil memory deprecate <id>` with no reason exits `0`. `--reason` is declared on the registry
entry **without** `required: true` (contrast `memoryReject`), so `spec-008` §2's optionality is
visible in the registry, not only in the function body.

#### D3 — no `Approver:` line, and no REQ-SEC-03 authority check

CLAUDE.md §5.1 ("Not an approval gate — no `Approver:` line required"), `dl-027`'s ratified rationale,
and the amended REQ-SEC-04 Traceability line all say the same thing, and REQ-SEC-03's own Fit
Criterion is scoped to "an **approve** attempt". `requireApprovalAuthority` is therefore **not called**
— not forked, not re-implemented, simply out of scope for this verb.

Independently confirmed by code already merged for the *reader* side: `src/core/index.ts:553-558`
(task-049's `MemoryHistoryEntryView` TSDoc) already states that `approver` "is null … on `deprecate`
(not an approval gate)" and that `reason` is parsed "independently of `Approver:`
(`parseCommitReason`) so a `deprecate` reason is not lost with the missing approver". `memory history`
was built expecting exactly the commit shape D4 specifies.

#### D4 — the commit shape

`dl-054` (`ready`, option 2 per approval commit `194ff91`) and `spec-004` §4.3 (`:197-206`, Revision
2026-09-17): "The `[{from} → {to}]` bracket belongs to the approver-gated verbs only — `approve`,
`reject`, `deprecate`". So:

```
wf({type}): deprecate {id} [{from} → deprecated]

Reason: {--reason text}          # only when --reason was given; no Approver: line ever
```

With no `--reason`, the message is the subject alone. Built by `formatMemoryCommitMessage`
(`transition` set, `approver` omitted, `reason` passed through only when defined) — the formatter
already supports this exact combination; no change to it.

Note the terminology collision recorded for the reviewer: `spec-004` §4.3 groups `deprecate` with the
"approver-gated verbs" when describing the *bracket*, while REQ-SEC-04/`dl-027` say `deprecate` is
*not* an approval gate. Both are satisfiable at once — the bracket is justified there by "the edge is
a decision rather than a derivation", which is true of a wildcard edge — but the phrase is loose. Part
of the same proposed decision-log as D1.

#### D5 — the already-deprecated guard is the VERB's, not the machine's

P1.9 sc.3 requires exit `1` and `document already deprecated: decision-12` when the document is
already `deprecated`. The engine cannot produce that: `resolveTransitionTarget` returns
`DEPRECATED_STATE` from **any** state including `deprecated` itself, by spec-001's design (and
changing that would be editing `state-machine.ts`, which `task-046` owns). The guard is therefore a
verb-level check placed immediately after `prepareMemoryTransition`, expressed generically as
`prepared.from === prepared.to` rather than as a comparison against a hard-coded `'deprecated'` — so it
stays correct if a future machine ever made the wildcard target type-specific. `VALIDATION` →
exit `1`, before any write, so "the state is unchanged" holds by construction.

A document in `superseded` is **not** "already deprecated" under this rule and can still be
deprecated (`superseded → deprecated`). Both are archived, so nothing observable about context or
search changes; flagged for the reviewer rather than blocked, since no spec or BDD scenario covers it.

#### D6 — refusal order

1. `requireGitIdentity(root)` — REQ-SEC-01, exit `1`.
2. `<id>` absent/blank → `UsageError('missing required argument: memory deprecate <id>')`, exit `2`
   (identical wording shape to `memory submit`/`memory reject`).
3. Load `memory.yaml` (`loadOrError`).
4. `prepareMemoryTransition(root, memoryYaml, id, 'deprecate')` — not found / unknown type / no
   machine / invalid frontmatter state, each exit `1`. (No illegal-transition branch is reachable for
   this verb — D1.)
5. **Already-deprecated guard** (D5) — exit `1`.
6. Render (`status` → target, nothing else) + one commit scoped to the one file, with
   `commitMemoryTransition`'s re-parse post-condition asserting `status` is the target and **no other
   field moved** — which is also how "`rejection_reason` is not touched" is enforced, rather than by a
   separate check.

No `--reason` step: it is read, never refused (D2).

#### D7 — known, filed defects this verb inherits (NOT fixed here, not duplicated)

- **`bug-030`** — a fresh `wingfoil init` scaffolds no state machine, so `memory deprecate` is
  unusable on a freshly-initialised project exactly as `submit`/`reject` are. Inherited through
  `prepareMemoryTransition` → `resolveStateMachine`. Out of scope.
- **`bug-024`** — `--reason` with no value exits `1` instead of `2`. Inherited through the CLI option
  layer (`src/cli/program.ts`), shared with `memory reject`. Out of scope — and note it is *less*
  visible here, since `--reason` is optional on this verb.
- **The `--reason` contract bug being filed by the orchestrator** — a blank reason is accepted and
  then `memory history` loses both approver and reason; a multi-line reason can inject a forged
  `Approver:` trailer into the body; `memory history` truncates a multi-line reason to its first line
  (`REASON_LINE_RE`, `src/memory/audit.ts:141-145`). This verb inherits all three through
  `formatMemoryCommitMessage` + `audit.ts`. **No private fix invented here.** One consequence is worth
  recording: because `deprecate` writes no `Approver:` line, a multi-line `--reason` whose second line
  reads `Approver: …` would make `memory history` report an approver for a verb that has none — the
  same defect, one notch more visible. Added to the report as evidence for that bug, not fixed.

#### T1 — AC classification

| AC | Class | Evidence |
|---|---|---|
| P1.9 sc.1 — `memory deprecate <id> --reason '…'` on an approved document → `status: deprecated`, exit `0` | **red-first** | no operation exists: `grep -rn "memoryDeprecate" src/` → one hit, a doc-comment in `require-reason.ts:25`; no `CoreFn`, no registry entry |
| P1.9 sc.1 — the file remains present in the repository | **red-first** (through the verb) | the assertion is on the verb's output, which does not exist; the underlying "deprecate never deletes" is trivially true of an edit-and-commit path, so it is pinned end-to-end, not assumed |
| P1.9 sc.2 — a deprecated document is NOT in the returned agent context | **characterization of the filter, red-first as a composition** | the exclusion itself pre-exists (`src/core/relevance.ts`'s `isExcludedFromContext`, task-035/dl-028) and must not be re-implemented; what does not exist is a path that *produces* a deprecated document and then feeds the real `filterRelevantMemoryDocuments`. The test runs the verb, then the filter — red today because the verb is unregistered, and it proves the exclusion instead of asserting it (wave-brief instruction) |
| P1.9 sc.3 — already-deprecated → state unchanged, exit `1`, `document already deprecated: <id>` | **red-first** | no guard exists anywhere: `grep -rn "already deprecated" src/ test/` → no output |
| spec-001 — the target is the reserved wildcard state from ANY state and ANY type (`task` in `in-review`, `adr` in `accepted`, `decision-log` in `ready`, a `defaults`-machine type) | **red-first** | the verb that would exercise the engine's `deprecate` arm end-to-end does not exist; `resolveTransitionTarget`'s own unit coverage is task-005's and stays untouched |
| spec-010 — `status` is the ONLY field written; `rejection_reason` and every other field survive byte-identically | **red-first** | no code path writes on deprecate |
| dl-054 / spec-004 §4.3 — subject `wf({type}): deprecate {id} [{from} → deprecated]`; body `Reason:` only when given; **never** an `Approver:` line | **red-first** | no deprecate commit is produced by any code |
| dl-027 / spec-008 §2 — `--reason` omitted → exit `0` (NOT a usage error) | **red-first** | the operation does not exist; `requireReason` is deliberately not called (task-041's own note) |
| REQ-SEC-01 — unconfigured git identity refuses before any write | **red-first** | no operation exists |
| REQ-SYS-05 / spec-004 §4.1 — `mutates: true` ⇒ registered as MCP Tool `memory.deprecate` and NOT as a Resource; the four enumeration literals | **red-first** | `grep -rn "memoryDeprecate" test/` → 1 hit, a doc-comment in `require-reason.test.ts:11`; the lists in `test/core/production-registry.test.ts` (×2), `test/core/parity.test.ts` and `test/mcp/read-only-agent-channel.test.ts` (×2) do not contain it |
| spec-006 §3 — drop the stale `*(planned)*` marker on the `memoryDeprecate` row | **characterization (documentation only)** | prose; no behaviour, so no test and no fabricated red |

### red — role: developer

Commit `573543d`. New suite `test/core/memory-deprecate.test.ts` (four describes: P1.9 fit criteria,
the spec-001 wildcard table, the REQ-STATE-06/P1.9 sc.2 exclusion round trip, the REQ-SEC-01
pre-flight); a `memory deprecate` block appended to `test/cli/program.integration.test.ts` (the real
compiled `dist/` driven through real `commander`); `memoryDeprecate` / `memory.deprecate` added to the
enumeration literals in `test/core/production-registry.test.ts` (×2), `test/core/parity.test.ts` and
`test/mcp/read-only-agent-channel.test.ts` (×2).

Observed red, for the stated reasons:

```
npx jest test/core/memory-deprecate.test.ts test/core/production-registry.test.ts \
  test/core/parity.test.ts test/mcp/read-only-agent-channel.test.ts
Test Suites: 4 failed, 4 total
Tests:       21 failed, 20 passed, 41 total
```

Causes: `fixture bug: "memoryDeprecate" operation not registered on the memory module` (every
behavioural case) and the four enumeration lists lacking the new entries. The CLI block was run
separately (`npx jest test/cli/program.integration.test.ts -t "task-048"` → `3 failed`), since it
spawns the compiled `dist/` and so fails with `error: unknown command 'deprecate'` rather than on a
missing module. **No characterization case was forced red**: the only characterization AC (spec-006's
`*(planned)*` marker) is documentation and carries no test at all.

### green — role: developer

Commit `18e987a`. `memoryDeprecateFn` + the `memoryDeprecate` registry entry in `src/core/index.ts`
(one contiguous block after `memoryRejectFn`, per the wave brief's rule 7), plus `setFrontmatterField`
added to the existing `../memory` import list. Nothing else in `src/` changed — in particular
**`src/memory/state-machine.ts` is untouched** (D1/dl-053).

Three things worth recording:

- **No new `src/memory/deprecate.ts`.** `submit` and `reject` each own a `render*Document` helper
  because each writes **two** things (`status` + remove `rejection_reason`; `status` + set
  `rejection_reason`). Deprecate writes one field, and that is exactly `setFrontmatterField`'s job, so a
  `renderDeprecateDocument` would be a pure one-call alias — needless indirection under the
  code-quality directive. The spec-010 field-write-ownership statement lives in `memoryDeprecateFn`'s
  TSDoc instead, and the "nothing else moved" half is *enforced* by `commitMemoryTransition`'s
  post-condition rather than documented.
- **Two assertions in the new suite were wrong, not the production code** (found by running, not by
  reading): `exitCodeForThrow` returns `{reason, exitCode}`, not a bare number — corrected to the
  `toEqual({...})` shape `test/core/memory-reject.test.ts` already uses; and `test/core/parity.test.ts`
  carries a **fifth** enumeration literal (the `cli`/`tools` pair at `:141-142`) that the design's
  survey of "four list literals" had missed. Both fixed in the green commit.
- `formatMemoryCommitMessage` needed no change: passing `transition` with `approver` omitted and
  `reason` left `undefined` already yields the subject-only form dl-027 requires.

### refactor — role: developer

Commit `954c3b2`: `spec-006` §3's `memoryDeprecate` row drops its `*(planned)*` marker (§3 defines the
marker as "not yet registered"; the operation is now registered — the same edit task-045 and task-047
made to their own rows). `spec-006` carries no `version` field, so the doc-versioning directive's bump
does not apply.

No code refactor. The verb is one linear function that reuses every existing seam, and the alternative
— extracting the four-step preamble `memorySubmitFn`/`memoryApproveFn`/`memoryRejectFn`/
`memoryDeprecateFn` share — is the same one `task-047` recorded and deliberately left: the shared part
*is* `prepareMemoryTransition`, and the extraction would edit three sibling verbs for no behavioural
gain. Recorded rather than invented, so a reviewer can decide it belongs to a follow-up that owns all
four call sites at once (it is now a genuine 4-way duplication, not a 2-way one — see the final
report).

### Merge of `main` (dl-035)

`b5f9977` merges `main` at `05d09de` (task-046-memory-approve merged, `bug-017` closed, the
`ingest/wave2-round3` batch). **Three conflicts, all in enumeration literals, all resolved as a sorted
union — never a concatenation:** `test/core/production-registry.test.ts` (flat list + mutating list +
the count in the `it(...)` title, now "eight operations mutate today"), `test/core/parity.test.ts`
(the `cli`/`tools` pair, the Tools list, and the `not.toContain` Resource lines) and
`test/mcp/read-only-agent-channel.test.ts` (mutating-op names + Tool names). `memoryApprove` sorts
before `memoryDeprecate`, so every list reads `memoryAdd, memoryApprove, memoryDeprecate, …`.
`src/core/index.ts` and `spec-006` §3 auto-merged cleanly (task-046's additions sit above this task's).

Re-read after the merge, with the effect on this task's notes:

- **`dl-053`'s corrected `contractTarget` IS now on the branch** (task-046 shipped it; the self-loop
  fallback now keeps walking for another target of the same verb instead of naming the next `sequence`
  state). The design's statement that it was not yet on `main` was true when written and is now
  superseded — **and it changes nothing here**, for the reason D1 gives: `resolveTransitionTarget`
  returns before any legality check for `op === 'deprecate'`, so `contractTarget` is unreachable from
  this verb and no test of this task references it. Verified after the merge:
  `sed -n '/function contractTarget/,/^}/p' src/memory/state-machine.ts` shows the dl-053 form, and the
  full suite is green.
- **`dl-064-approver-gated-verb-preflight-order` (`in-discussion`, NEW) — read; it names `task-048`.**
  Clause A (legality checked before authority) does **not** bind this verb: it performs no authority
  check at all (D3), so it has no combined-failure ordering to declare. Clause B (the git identity being
  read three times per operation) is *lighter* here than on `approve`/`reject`: `memoryDeprecateFn`
  calls `requireGitIdentity` once and never calls `readGitIdentity`, because there is no `Approver:`
  line to render. If clause A is ratified as a written pre-flight sequence in `spec-006`, that sequence
  should say explicitly that its authority step is absent on `deprecate`, or this verb will read as
  non-conformant.
- **`dl-063-p1-8-reject-message-and-authority-trace` (`in-discussion`, NEW)** — read. It is `task-047`'s
  P1.8-sc.2 message conflict, filed. No deprecate scenario is involved: P1.9 has no illegal-transition
  scenario, because the wildcard edge has no illegal case.
- **`dl-062-roles-yaml-unwritable-fallback` (`in-discussion`, NEW)** — read, not applicable (Directives
  pillar).
- No requirement, BDD feature or spec this task cites changed in the merge. Checked directly:
  `git diff 573543d HEAD --stat -- docs/02_requirements` → empty; the only
  `docs/self/docs/04_memory/design` files touched are `dl-062`/`dl-063`/`dl-064` (new) and `spec-006`
  (task-046's `memoryApprove` row plus this task's own `memoryDeprecate` row).

### review-ready summary

**Gates** (run in the worktree, after the `main` merge; each command and its tail reproduced):

| Command | Result |
|---|---|
| `npx jest --maxWorkers=4` | **99/99 suites, 1502/1502 tests passed** |
| `npx jest --coverage --maxWorkers=4` | All files **98.53** stmts · **92.22** branches · **98.74** funcs · **99.14** lines |
| Baseline, same command on `main` `05d09de` in a scratch worktree | **98.53 · 92.22 · 98.74 · 99.14** — identical, so no metric regresses, and all are ≥ 80 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit **0** |
| `npx tsc --noEmit -p tsconfig.json` | exit **2**, only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing, untouched) |
| `npm run lint` | exit **0** |
| `npm run docs:api` | exit **0** |

Coverage is flat rather than up because the new code is small and fully exercised: the only production
change is `memoryDeprecateFn` (every branch — identity refusal, blank id, not-found, already-deprecated,
reason present, reason absent — has a test) plus one import line.

**BDD `P1.9-memory-deprecate.feature` → tests**

| Scenario | Tests |
|---|---|
| sc.1 Deprecate an approved document | `test/core/memory-deprecate.test.ts` "P1.9 sc.1: `deprecate decision-12 --reason ...` sets `status: deprecated`, keeps the file, exit 0" — asserts the frontmatter, the byte-exact document (only `status` changed), `git ls-files` + `existsSync` for "the file remains present in the repository", the exact `%B`, the single scoped commit, and exit `0`; plus `test/cli/program.integration.test.ts` "sc.1 `memory deprecate decision-12 --reason 'superseded by decision-20'` …" through the real compiled CLI |
| sc.2 Deprecated documents are excluded from default agent context | `test/core/memory-deprecate.test.ts` "an `accepted` adr is in the assembled context; after `memory deprecate` it is not" — the real `filterRelevantMemoryDocuments` (spec-012 §6) is called **before and after** the real verb, so the exclusion is *proven on this verb's output*, not asserted; the companion case does the same round trip through default `memory search` and shows `--status deprecated` still resolves it (REQ-STATE-06 / task-038 AC2) |
| sc.3 Error — deprecating an already-deprecated document | `test/core/memory-deprecate.test.ts` "P1.9 sc.3: deprecating an already-deprecated document exits 1, state unchanged, no new commit" (byte-identical file, unchanged HEAD, clean `git status`); `program.integration` "sc.3 `memory deprecate decision-88` (already deprecated) exits 1, state unchanged" |

Beyond the feature file: `spec-001`'s wildcard edge as a 7-row table (`task` in `backlog`/`in-review`/
`done`, `adr` in `accepted` **and** in `superseded`, `decision-log` in terminal `ready`, and the
REQ-STATE-08 `defaults.states` fallback — every row lands on `deprecated` and carries the
`[from → deprecated]` subject); `spec-010`'s status-only write with a `rejection_reason` left intact;
`dl-027`'s optional `--reason` at both the core and the real-`commander` surface; `dl-054`'s subject
bracket and the **absence** of an `Approver:` line, asserted explicitly; REQ-SEC-01 (isolated git
config); `bug-027`'s scoped commit; `spec-008` §7's missing-`<id>` usage error (exit `2`) and the
not-found refusal (exit `1`); REQ-SYS-05 parity across all five enumeration literals.

**T1 outcome:** every red-first AC had a genuine failing test first (the run and its causes are in the
`red` section). The one characterization AC is documentation-only and correctly carries no test.

**For the approver / reviewer**

1. **D1 is the one judgement call in this task.** `spec-010`'s field-write row and CLAUDE.md §5.1 both
   say `memory.deprecate` may write "a type-specific deprecate-adjacent state first, e.g.
   `accepted → superseded`", while `spec-001`, `memory.yaml`'s `waiting: [accepted]`, REQ-STATE-06 (as
   amended by `dl-028`) and the shipped engine all say `superseded` is a `supersedes:`-driven edge no
   CLI verb takes. This task implements the engine's reading and files the wording conflict as a
   proposed decision-log. If the approver reads `spec-010` the other way, the change is confined to
   this one verb — but it would require a declarative "deprecate-adjacent state" field in `memory.yaml`,
   since nothing there marks `superseded` as one today.
2. **Refusal ordering has no authority step here**, unlike `approve`/`reject` — see the `dl-064`
   acknowledgement above. Worth a reviewer's explicit confirmation that "deprecate is not gated" is
   still the intent now that four verbs exist.
3. **`superseded → deprecated` is allowed.** A superseded `adr` is not "already deprecated" under the
   `from === to` guard, so it can still be deprecated; both states are archived, so nothing about
   context or search changes. No spec or BDD scenario covers it; pinned by a test row so the behaviour
   is at least visible.
4. **Inherited `--reason` defects, not fixed here** (D7): `bug-042-reason-text-has-no-contract-against-commit-trailer`
   (blank reason accepted, multi-line reason can inject a forged trailer, `memory history` truncates to
   the first line) and `bug-024` (`--reason` with no value exits 1). This verb makes the trailer-injection
   case one notch worse, because it writes **no** `Approver:` line of its own — a second line reading
   `Approver: …` inside a `--reason` would make `memory history` report an approver for a verb that has
   none. Evidence for the existing bug; deliberately not patched privately.
5. **The 4-way preamble duplication** (`identity → <id> → load memory.yaml → prepareMemoryTransition`)
   now spans `memorySubmitFn`, `memoryApproveFn`, `memoryRejectFn` and `memoryDeprecateFn`. Left
   un-extracted here for the reason `task-047` gave; proposed as a follow-up in the final report.
