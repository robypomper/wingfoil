---
id: "task-049-memory-history"
type: task
title: "Implement `wingfoil memory history`"
status: in-progress
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
