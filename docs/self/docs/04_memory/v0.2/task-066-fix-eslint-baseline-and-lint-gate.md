---
id: "task-066-fix-eslint-baseline-and-lint-gate"
type: task
title: "Fix: restore a clean lint baseline and wire the lint gate into dev-loop's refactor phase"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "tooling", "quality-gate"]
ref: "dl-034-lint-gate-in-dev-loop"
bug: "bug-009-eslint-baseline-require-imports"
depends_on: []
tmpl_version: 260703
---

## Description

`npm run lint` has exited non-zero on `main` since v0.1 (`bug-009`), and **no workflow runs lint at
all** — verified across every file in `.wingfoil/workflows/custom/`. The `code-quality` directive's
"Lint clean: no errors" has therefore never been enforced by anything.

Fix both halves together, per `dl-034-lint-gate-in-dev-loop`: clear the one existing error so the
baseline is green, and add the gate that keeps it that way. Doing only the first would reset the
counter until the next task introduces an error — which is exactly how `task-043` added four without
the gate ever changing state.

## Acceptance Criteria

1. `npx eslint .` exits **0** on `main` with a clean working tree.
2. `test/storage/git-backed-storage.test.ts:90`'s `require()` is replaced by a top-of-file ES import,
   matching the rest of that file; the suite still passes unchanged (no behavioural edit).
3. `.wingfoil/workflows/custom/dev-loop.yaml`'s `refactor` phase carries `lint.clean` in its
   `checks.post`, alongside `tests.passing`, `tests.coverage(min: 80)` and `docs.api.*`; the workflow
   `version` is bumped and the check cites `dl-034` inline, in the style the `docs.api.*` entry
   already uses.
4. The gate is **hard-reject from the start** — no warn-only ramp. `dl-034` Decision point 2 records
   why: `docs.api.*` needed a ramp because its backfill spanned the whole tree; this backfill is one line.
5. A test asserts the gate is real, in the spirit of `test/docs/api-docs.test.ts` for `docs:api`:
   `npm run lint` (or the eslint API) exits 0 over the repo. This is what makes the check executable
   rather than a sentence in a YAML comment.
6. Full suite green; coverage ≥ 80; `npm run docs:api` exits 0.

## Implementation Notes

Authorised by `dl-034-lint-gate-in-dev-loop` as a **recorded exception** to the rule `dl-030` set: a
release already `in-development` does not normally gain tasks. The justification is that this one gates
the verification of every remaining v0.2 task — seven currently in `red` plus twenty-one in `backlog`.
It is not a precedent for adding feature work mid-release.

Run this **before** the seven `red` tasks resubmit, so their resubmissions are verifiable against a
green baseline instead of each agent re-deriving which lint errors were pre-existing.

The `bug:` field links `bug-009`, so `dev-loop`'s `bug.sync_state` advances it automatically
(`triaged → planned → in-progress → in-review → resolved → closed`). `bug-011` is deliberately **not**
attached here — it has its own fix task (`task-067`), because `bug:` is singular and a task covering
two bugs would leave the second permanently unsynced (`dl-034` Decision point 5).

## Execution Notes

<!-- Running log, filled in incrementally per phase. -->
