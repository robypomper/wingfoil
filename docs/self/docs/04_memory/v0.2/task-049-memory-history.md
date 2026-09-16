---
id: "task-049-memory-history"
type: task
title: "Implement `wingfoil memory history`"
status: in-review
release: "v0.2"
priority: "High"
tags: ["v0.2", "p1"]
ref: "P1.10"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

As Casey, deliver feature **P1.10** (US-5-08): view the full audit trail of a document (author, ISO-8601 timestamp, state change, reason per entry) in chronological order.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.10-memory-history.feature`.

Key scenario: `wingfoil memory history decision-12` → chronological entries, each with author/timestamp/state-change/reason; query < 1s.

## Implementation Notes

Reads the git-derived audit trail (`dl-011`, P1.10). Surfaces the `Approver:`/`Reason:` commit-body convention.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design (architect)

**`agent.read_related` — no-op.** `depends_on: []`; nothing to acknowledge.

**T1 — acceptance-criterion classification** (`P1.10-memory-history.feature`, three scenarios):

| # | Acceptance criterion (feature-file clause) | Class | Why |
|---|---|---|---|
| AC-1a | Scenario 1 — "the output lists 3 entries in chronological order" | **red-first** | No `memory history` surface exists: `CORE_MODULES.memory` registers only `memoryAdd`/`memorySearch`, so `wingfoil memory history` is not a command today. |
| AC-1b | Scenario 1 — "each entry shows author, ISO-8601 timestamp, state change, and reason" | **red-first** (for the projection) / **characterization** (for the underlying parse) | `reconstructMemoryTransitions` + `parseApprovalMetadata` (`src/memory/audit.ts`, task-015) already derive all four fields and are covered by `test/memory/audit.test.ts`; what does not exist is the operation that projects them into a user-facing entry shape. |
| AC-1c | Scenario 1 — "the query returns in under 1 second" | **red-first** (at the registered op) / **characterization** (at the primitive) | `test/core/query-latency.test.ts` already benchmarks `getMemoryHistory` under REQ-PERF-02's conditions and passes — but that primitive is *not* the call the CLI will make. Re-point that case at the registered op, exactly as `task-021` did for `memorySearch` (`task-067`/`bug-011` precedent). |
| AC-2 | Scenario 2 — exit `1`, message `document not found: decision-999` | **red-first** | No id→document resolution and no such message exist anywhere today. |
| AC-3 | Scenario 3 — "the output lists exactly 1 entry describing the creation" | **red-first** | Same as AC-1a. |

**`agent.verify_specs` — no gap; no `tech-spec` scaffolded.** Every contract this task needs is already
approved:

- `spec-006-core-domain-api` §3 (memory table) pins the operation row verbatim:
  `memoryHistory | mutates: false | wingfoil memory history | Resource wingfoil://memory/history/{id}`.
- `spec-008-cli-grammar` §7 pins the argument form: a command whose noun already scopes the type takes
  the **bare `<id>`** positional (`memory submit <id>`, `memory approve <id>`, …) — so `memory history <id>`
  rides task-026's generic `ParamsContext.positional` seam, no new seam needed.
- `spec-008` §5 / `spec-005-cli-command-contract` §1 pin the exit codes (document not found → `1`;
  missing required argument → `2`) and §6/§3 the `error: <reason>` stderr format.
- `spec-005` §2 / `src/cli/output.ts` already define the output envelope: `json`/`yaml` carry the
  structured payload; `console` falls back to pretty-printed JSON until a command-specific rendering
  spec exists. `memory history` has no such rendering spec — the identical situation `memorySearch`
  shipped under (task-021), so this is a known, already-ratified gap in a *shared* contract, not a
  missing contract for this command.
- `REQ-PERF-02` names `wingfoil memory history` explicitly and owns both the threshold (`< 1,000 ms`
  p95) and the measurement conditions (`>= 20` runs, 1,000-document reference repository).
- `spec-010-memory-frontmatter-schema` (§"No document-version counter") states the derivation
  positively: `wingfoil memory history` reconstructs the audit trail from `git log --follow <path>`
  and **must not** expect a `state_history[]` array in frontmatter. `X_cli-cmds.md` line 32 agrees:
  "Shows full git history + state transitions from frontmatter".

**Design.**

- **One new read-only core operation, `memory.memoryHistory`** (`src/core/index.ts`) — `mutates: false`,
  no flags, no value options; the id rides the existing bare `positional`. Registering it is the whole
  surface wiring: `src/cli`'s registrar derives `wingfoil memory history <id>` mechanically and the MCP
  registrar would derive a Resource, so no `src/cli`/`src/mcp` edit is needed (and none is in scope —
  `src/mcp` belongs to task-039 this cycle). The edit to `src/core/index.ts` is confined to the `memory`
  module's `operations` block plus the new function and its types.
- **Reuses the existing primitives; reimplements nothing.** `findMemoryDocumentById` (`src/memory/query.ts`,
  task-009) resolves the bare id to a root-relative path; `reconstructMemoryTransitions`
  (`src/memory/audit.ts`, task-015) walks `git log --follow` + `git show` and parses the commit body.
  The new code is the **projection** (a stable, documented entry shape) and the **error/usage contract**.
- **Commit bodies without `Approver:`/`Reason:`.** `parseApprovalMetadata` returns `null` — not a
  partially-filled object — when either line is absent, which is the normal case for an `add`/`submit`
  commit (CLAUDE.md §5.1 gives those a subject only). The projection therefore emits
  `approver: null` / `reason: null` for those entries. Nothing is invented, inferred from the subject,
  or back-filled from a neighbouring commit.
- **Reading AC-1b against AC-3.** Scenario 3 establishes that the **creation** commit is itself one of
  the listed entries ("exactly 1 entry describing the creation"), so Scenario 1's "3 recorded state
  transitions" = 3 entries, of which the first is the `add`. Under CLAUDE.md §5.1 an `add` commit carries
  no body, so a 3-entry history can carry at most one real `Reason:` — a history where all three entries
  carry one is unreachable by the project's own commit convention. "Each entry shows … reason" is
  therefore implemented as: the `reason` key is present on **every** entry, carrying the exact recorded
  text where the commit records one and `null` where it does not. The fixture's `approve` entry proves
  the text round-trips character-exact.
- **Latency (AC-1c) — where the budget goes and why.** `bug-011` was a wall-clock reading wrapped around
  a spawned `node dist/cli.js`, which measured process startup plus jest worker contention, not the
  query; `task-067` moved it in-process and `test/core/latency-budget-placement.test.ts` now forbids any
  test file from both spawning a process and reading the clock. So: the P1.10 budget is asserted in
  `test/core/query-latency.test.ts` only — in-process, p95 over 25 runs, against the **registered**
  `memory.memoryHistory` op (the exact call `wingfoil memory history` makes), on the same
  1,000-Memory-document reference repository REQ-PERF-02 specifies. The CLI integration test asserts
  exit codes/messages/shape and stays clock-free.
- **Determinism (REQ-SYS-07).** Every ordering is already total and derived: `listMemoryDocumentPaths`
  sorts lexicographically, `walkGitLogFields` reverses `git log`'s linear walk to oldest-first, and
  no wall-clock or randomness enters the path — the ISO-8601 timestamp is git's own `%aI`, read from the
  commit, never from `Date.now()`.

**Checks (post).** `frontmatter.required: [title, scope]` — N/A, no `tech-spec` was scaffolded.
`tech-spec.approved` — the cited specs (`spec-005`/`006`/`008`/`010`) are all `approved`.
`depends_on.acknowledged` — vacuous (`depends_on: []`). **No approval needed:** the design gate
requires `by_role: approver` only when a new spec was scaffolded; none was, so `design` passes through.

### red (developer)

Two commits, one per module (`3d62cb2` `test(memory)`, `557099e` `test(core)`).

**Observed red — `npx jest test/core/memory-history.test.ts test/memory/audit.test.ts
test/core/production-registry.test.ts test/core/parity.test.ts --maxWorkers=2`:
`Test Suites: 4 failed, 4 total` / `Tests: 20 failed, 42 passed, 62 total`.** Verbatim first failures:

- `test/core/memory-history.test.ts` — `fixture bug: "memoryHistory" operation not registered on the
  memory module` (the suite resolves the op out of `CORE_MODULES` rather than importing a function,
  so it fails loudly instead of benchmarking a stale one).
- `test/memory/audit.test.ts` — `TypeError: (0 , audit_1.parseCommitReason) is not a function`.
- `test/core/production-registry.test.ts` — the enumerated registry was missing `"memory.memoryHistory"`.
- `test/core/parity.test.ts` — the MCP Resource list was missing `"wingfoil://memory/history"`.

**Observed red — the two remaining suites, `npx jest test/core/query-latency.test.ts
test/cli/program.integration.test.ts --maxWorkers=2`: `Test Suites: 2 failed, 2 total` /
`Tests: 4 failed, 31 passed, 35 total`.** Verbatim:

- `test/core/query-latency.test.ts` — `fixture bug: "memoryHistory" operation not registered on the
  memory module`.
- `test/cli/program.integration.test.ts` — `- error: document not found: decision-999` /
  `+ error: unknown command 'history'`.

*Honest provenance:* the first block was observed at the red commit, before any implementation. The
second block was observed later, by checking `src/` back out at the red commit (`git checkout 557099e
-- src/`), running those two suites, then restoring (`git checkout HEAD -- src/`; `git status` clean,
full suite re-run green afterwards). It is real observed red for the red-commit source, but it was
not captured in the original red pass — recorded this way rather than presented as if it had been.

### green (developer)

Two commits (`ca8b201` `feat(memory)`, `3c902cb` `feat(core)`).

**`src/memory/audit.ts` — `parseCommitReason(body): string | null`**, plus a new
`MemoryTransition.reason` field populated from it. `parseApprovalMetadata` now *consumes*
`parseCommitReason` rather than running its own `Reason:` match, so the two can never disagree on what
counts as a `Reason:` line or on trimming; its all-or-nothing contract (null unless BOTH trailers are
present) is unchanged, and its existing tests pass untouched.

Why the split was necessary rather than cosmetic: the two trailers do not always travel together.
`approve`/`reject` carry both (CLAUDE.md §5.1 / P1.7); **`deprecate` carries a `Reason:` and no
`Approver:` at all** — it is explicitly not an approval gate. Reading the reason through
`parseApprovalMetadata` would therefore have dropped *every* deprecate reason from the audit trail the
command exists to surface. Verified by reading the function, not inferred: `parseApprovalMetadata`
returns `null` when `APPROVER_LINE_RE` does not match, regardless of the `Reason:` line.

**`src/core/index.ts` — `memoryHistoryFn` + `memoryHistory` registration.** `mutates: false`, no flags,
no value options; the id rides the generic bare `positional` seam (task-026), per spec-008 §7's
bare-`<id>` rule. What the function actually *reads*: `params.positional` (the id) and `params.root`;
then `loadMemoryYaml(root)` for the type `path` patterns; then `findMemoryDocumentById` (an exact
frontmatter-`id` match over the sorted document set); then `reconstructMemoryTransitions(root,
found.path)`. It reads no clock, no frontmatter of its own, and no commit body of its own — it renames
and string-formats the reconstruction's fields into the entry shape and returns them.

### refactor (developer)

One commit (`634e5ce` `refactor(memory)`), documentation only — no behaviour change, tests were
already green before and after. It retires three now-false claims that P1.10 is unimplemented:
`src/memory/history.ts`'s "a future `wingfoil memory history` feature task (P1.10; not yet scheduled
in v0.1)", `src/memory/audit.ts`'s "a future `wingfoil memory history` CLI/MCP surface (P1.10, a later
feature task)", and `src/memory/index.ts`'s "task-021/a-later-P1.10-task". (Same class of staleness as
`bug-008`/`dl-025`: a doc sentence that quietly stops being true when the thing it defers to ships.)

**Gates — observed, on the final committed tree:**

| Check | Command | Result |
|---|---|---|
| `tests.passing` | `npx jest --maxWorkers=2` | exit 0 — **70 suites / 901 tests, all passed** (43.5 s) |
| `tests.coverage(min: 80)` | `npx jest --coverage --maxWorkers=2` | exit 0 — **global 98.17 % stmts / 89.05 % branch / 98.21 % funcs / 98.74 % lines** |
| `docs.api.build` + `docs.api.public-complete` | `npm run docs:api` | **exit 0** (TypeDoc `notDocumented` + `treatWarningsAsErrors`) |
| (build) | `npx tsc -p tsconfig.build.json` | **exit 0** |
| `lint.clean` | `npx eslint .` | **exit 0** |

Per-file coverage for what this task touched: `src/memory` 98.85 / 87.38 / 100 / 99.36; `src/core`
98.42 / 90 / 100 / 99.1; `audit.ts` 97.26 stmts / 62.16 branch / 100 funcs / 100 lines.

*Re-run after the first review's rejection* (which required documentation corrections only — see the
`review` section): `npx jest --maxWorkers=2` exit 0, **70 suites / 901 tests**; `npx tsc -p
tsconfig.build.json` exit 0; `npm run docs:api` exit 0; `npx eslint .` exit 0. No source, test or gate
figure moved, because nothing but Execution Notes prose changed.

**Coverage caveat, stated rather than glossed:** `jest.config.js` sets
`collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts']`, so **`src/core/index.ts` — where
`memoryHistoryFn` lives — is not instrumented at all.** That exclusion is pre-existing and
project-wide (it applies equally to `dnaSetFn`, `memoryAddFn`, `memorySearchFn`), not something this
task introduced or opted into, but it means the 98.17 % global figure is *not* evidence that the new
function is covered — `coverage/coverage-final.json` has **no key for `src/core/index.ts` at all**,
confirmed mechanically rather than inferred from the table. The evidence that it is exercised is direct
instead: **13** cases in `test/core/memory-history.test.ts` (`npx jest` on that file alone reports
`Tests: 13 passed, 13 total`; `grep -c "^  it("` agrees) plus **3** CLI cases and **1** benchmark case —
**17** in total, all calling it through the registered `CORE_MODULES` entry.

*Correction, recorded rather than silently edited:* the first submission of these notes said "18 cases
… plus 3 … and 1", i.e. 22. That was a hand count, and it was wrong; the true figures are 13 and 17,
counted two independent ways above. It is the one number in this task where accuracy mattered most,
since it is the entire substitute for a coverage figure these notes had just argued is meaningless
here. The conclusion is unchanged at 17.

`audit.ts`'s uncovered rows were checked against `coverage/coverage-final.json` rather than eyeballed.
The only uncovered *statements* are lines 220/223 inside `readStatusAt` (task-015's defensive "no
frontmatter at this sha" / "unparseable frontmatter" paths — pre-existing, untouched by this task). The
complete set of *branches* carrying an uncovered path is **105, 150, 167, 220, 223, 226, 301**, and it
splits in two:

- **105, 150, 167, 301** — unreachable `= ''` destructuring defaults on already-matched regex groups.
  Line 150 is the one inside the new `parseCommitReason`, following the identical pattern the file
  already used at 105/167/301.
- **220, 223, 226** — the same three `readStatusAt` defensive paths named above, seen as branches
  (`if`, `if`, `cond-expr`) rather than as statements. Pre-existing task-015 code, untouched here.

*Correction, recorded rather than silently edited:* the first submission enumerated only 105/150/167/301
and called that "every uncovered branch". It was not — 220/223/226 were disclosed one sentence earlier
as the uncovered statements but dropped from the branch list, so the enumeration under-reported itself.
Nothing new is revealed by the fix; the two sentences now agree.

### review (developer side)

`status: in-progress → in-review`. No `bug:` field on this task, so `bug.sync_state` is a no-op.

**BDD `P1.10-memory-history.feature`, scenario by scenario:**

| Scenario | Met by | How |
|---|---|---|
| "View the full audit trail of a document" — 3 entries, chronological | `test/core/memory-history.test.ts` (4 cases) + `test/cli/program.integration.test.ts` | asserts `entries.length === 3`, `to` = `[draft, in-discussion, ready]`, `from` = `[null, draft, in-discussion]`, timestamps non-decreasing |
| … "each entry shows author, ISO-8601 timestamp, state change, and reason" | same | every entry: `author === 'WingFoil Test <wf-test@example.invalid>'`, `timestamp` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z\|[+-]\d{2}:\d{2})$/`, `to` non-null, `reason`/`approver` keys present |
| … "and the query returns in under 1 second" | `test/core/query-latency.test.ts` | p95 over 25 in-process runs < 1000 ms — see LATENCY below |
| "Error - history for a non-existent document" — exit 1, `document not found: decision-999` | `test/core/memory-history.test.ts` + CLI integration | `coreErr(NOT_FOUND)`, `exitCodeForResult === 1`, CLI stderr `error: document not found: decision-999\n` |
| "Edge - document with a single creation event" — exactly 1 entry | `test/core/memory-history.test.ts` | `entries.length === 1`, `from === null`, `operation === 'add'`, `to === 'draft'` |

**Message strings — checked character-for-character, not by eye.** A script extracted every quoted
literal from the feature file (`decision-12`, `wingfoil memory history decision-12`, `wingfoil memory
history decision-999`, `document not found: decision-999`, `decision-30`, `wingfoil memory history
decision-30`) and byte-compared the one message literal against what the implementation produces:
`Buffer.compare` → `0`, **byte-identical**. The invocation strings correspond to the registered command
(`deriveVerb('memory','memoryHistory') === 'history'`), proven end-to-end by the CLI integration suite
spawning exactly `memory history decision-12`. The feature file mandates **no other** message string;
`missing required argument: memory history <id>` is *not* from the feature file — it follows
spec-008 §4/§5's `missing required argument:` convention and `dna set`'s existing positional precedent
(`missing required argument: dna set <key> <value>`), and is labelled as such rather than presented as
a BDD literal.

**Reading of "each entry shows … reason" (the one interpretive call, flagged for the reviewer).**
Scenario 3 establishes that the creation commit is itself a listed entry, so Scenario 1's "3 recorded
state transitions" = 3 entries whose first is the `add`. Under CLAUDE.md §5.1 an `add` commit carries
no body, so a 3-entry trail in which all three entries carry a real `Reason:` is **unreachable by this
project's own commit convention**. Implemented as: the `reason` key is present on every entry, carrying
the recorded text where one exists and `null` where none does. The fixture's `approve` entry proves the
text round-trips exactly (`'Ratified at the design review; no open objections.'`).

**Latency placement.** See LATENCY below; `test/core/latency-budget-placement.test.ts` re-run on its
own: **74 passed, 74 total**, and its scanned set includes the new `core/memory-history.test.ts`.

**Review round 2 — rejected at `in-review`, documentation only (`9157e23`).** No code defect was found
and every other claim was independently verified. Two corrections were required, both inside the
coverage paragraph above, and both are applied there with the wrong figure named rather than quietly
overwritten: (1) the case count backing the uninstrumented-`index.ts` gate was stated as 18 (total 22)
when it is **13** (total **17**) — the one number in this task where accuracy mattered most, since it
substitutes for a coverage figure these notes had just argued is meaningless here; (2) the
"every uncovered branch" enumeration listed 105/150/167/301 when `coverage-final.json` gives
**105, 150, 167, 220, 223, 226, 301**, the extra three being the `readStatusAt` paths already disclosed
one sentence earlier as statements. The reviewer also asked that the spec-006 §3 MCP divergence be
labelled **untracked** — done in "Scope / deviations" below, with the absence of a `bug`/`decision-log`/
`tech-spec` element for it confirmed by grep here rather than taken on report.

**Scope / deviations.**

- `src/core/index.ts` edit is **purely additive: 3 hunks, 127 insertions, 0 deletions** — the `../memory`
  import block (+2 names), the new types + `memoryHistoryFn` after `memorySearchFn`, and one entry in
  the `memory` module's `operations` block. Nothing reformatted, reordered or refactored; `dnaSetFn`
  (task-063's concurrent edit) untouched.
- `src/mcp/` was **not** modified. The production MCP server (`createMcpServer`, `src/mcp/server.ts`)
  registers only `registerReadOnlyResources` and deliberately does **not** call `registerCoreModules`,
  so registering a read-only op changes no running MCP surface. `test/core/parity.test.ts` builds a
  server from `CORE_MODULES` itself, which is why its expected Resource list gained
  `wingfoil://memory/history`.
- **Left for someone else — and UNTRACKED, which is the part the approver needs to see.** spec-006 §3
  (`approved`) pins the MCP exposure as `wingfoil://memory/history/{id}`, but the mechanical registrar
  can only derive the zero-argument `wingfoil://memory/history` form: the `CoreOperation` shape
  (spec-006 §2 — `{name, mutates, fn}` plus optional `flags`/`options`) carries no parameter metadata
  for a URI template to consume. Registering `memoryHistory` therefore adds a **second** row that does
  not match the spec table it is registered against.

  Leaving the gap is correct — closing it needs parameterised Resource templates in
  `src/mcp/registrar.ts`, which is task-039's area this cycle, not something to bolt on here. But it
  should not be assumed that the first occurrence is already covered: the identical `memorySearch` gap
  from `task-021` is recorded **only** in a `src/mcp/registrar.ts` source comment and in that (now
  `done`) task's Execution Notes. There is **no `bug`, `decision-log` or `tech-spec` element for it
  anywhere**, and nothing reschedules a done task's notes — so unless an element is raised, this task's
  row makes the divergence two-wide with still nothing tracking it. Flagged here so the approver can
  decide whether to raise one (a `decision-log` on whether `CoreOperation` should carry parameter
  metadata at all, or a `bug` against the spec-006 §3 rows, or an amendment to spec-006/spec-004) —
  raising it is not this task's call to make.
- `console`-format rendering falls back to pretty-printed JSON (`src/cli/output.ts`), as it does for
  every command with no command-specific rendering spec. Not a gap this task invented; a human-facing
  `memory history` rendering would need its own spec.
