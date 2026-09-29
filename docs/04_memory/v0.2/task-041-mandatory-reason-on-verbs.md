---
id: "task-041-mandatory-reason-on-verbs"
type: task
title: "Infrastructure: REQ-SEC-04 — mandatory reason on approval/reject verbs"
status: done
release: "v0.2"
priority: "Blocker"
tags: ["v0.2", "security"]
ref: "REQ-SEC-04"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-04** (`--reason` mandatory on approve/reject; recorded in the git commit).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-04** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Shared prerequisite for memory approve/reject/deprecate (P1.7/P1.8/P1.9).

## Execution Notes

**start** — `status: backlog → in-progress`; committed. `depends_on: []` and `bug: ""` → no
`bug.sync_state`, no `read_related` upstream reads required.

**design** (architect) — AC classification: REQ-SEC-04's single Fit Criterion ("Omitting `--reason`
on `approve`/`reject`/`deprecate` returns exit code `2` with `missing required argument: --reason` and
makes no change") is a **red-first** AC — a real behaviour to force with a failing test, not a
characterization AC. `depends_on: []`, so no `read_related`.
- **Spec verification (`verify_specs`):** no new `tech-spec` needed. The `--reason` grammar is already
  pinned by the **approved** `spec-008-cli-grammar` §2 (`--reason <text>` — "**Required** on
  approval-gate commands (`memory approve`, `memory reject`); optional elsewhere (e.g.
  `memory deprecate`)... Omitted where required exits `2` with `error: missing required argument:
  --reason`") and `spec-006-core-domain-api` (`memoryApprove`/`memoryReject`/`memoryDeprecate` rows,
  `mutates: true`). The ground-truth BDD (`P1.7-memory-approve.feature`, `P1.8-memory-reject.feature`)
  matches verbatim. Design passed straight through (no scaffold, no approval gate).
- **Spec-gap note (reconciled, not blocking):** the SARD REQ-SEC-04 wording lists `deprecate` among
  the verbs requiring `--reason`, but the already-approved `spec-008` §2 and `P1.9-memory-deprecate.feature`
  make `--reason` **optional** for `memory deprecate` (no "missing reason" error scenario there, unlike
  P1.7/P1.8). This task ships the shared **prerequisite helper** only (`requireReason`), which
  `memory approve`/`reject` (task-046/047) will call; `memory deprecate` (task-048) will read
  `options?.reason` directly and NOT call the helper. The helper's scope therefore follows the approved
  CLI grammar (the authoritative source for surface behaviour), leaving the deprecate/reason policy to
  task-048 — no spec change required here.

**red** — added `test/core/require-reason.test.ts` (4 cases): `options` undefined → `UsageError` exit 2
with exact message; `options` present without `reason` key → same; `reason` present → returned verbatim;
`reason` alongside other options → returned untouched. Failed to compile (module absent) — genuine red.

**green** — added `src/core/require-reason.ts` exporting `requireReason(options)`: reads
`options?.reason` (the existing `ParamsContext.options` value-bearing seam, `core/registry.ts`), throws
`UsageError('missing required argument: --reason')` (exit 2 via `exitCodeForThrow`) when absent, else
returns it verbatim. Re-exported via `src/core/index.ts` (`export * from './require-reason'`), mirroring
`requireGitIdentity`. All 4 tests green; `tsc` clean.

**refactor** — nothing to refactor. The helper is a single focused function that already reuses the
existing `UsageError` seam and the `ParamsContext.options` shape; no duplication, dead code, or
complexity to reduce. Skipped the refactor commit honestly rather than fabricating one.

**review** (reviewer) — full suite green; `tsc -p tsconfig.build.json` exit 0; `docs:api` exit 0
(TSDoc present on the new `requireReason` export + `require-reason.ts` module doc); coverage ≥ 80%
(`require-reason.ts` 100%, All files 97.92% statements). Traceability intact: REQ-SEC-04 → P1.7/P1.8
BDD → `spec-008`/`spec-006` → this helper, consumed by task-046/047. `status: in-progress → in-review`.
- **Known pre-existing flake (not a regression):** the `test:coverage` run once reported
  `test/cli/program.integration.test.ts` › "memory search api ... under 1 second" as failing (~2.3s
  observed) — a **wall-clock** assertion that flakes under parallel-dev-loop machine load. NOT touched
  by this task and out of scope; left unedited (editing it would collide with sibling branches at
  merge). The plain full `npm test` run (not under coverage instrumentation) passed 553/553; treating
  the suite as GREEN for the gate.
