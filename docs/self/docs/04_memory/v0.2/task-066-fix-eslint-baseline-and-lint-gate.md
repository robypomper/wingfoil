---
id: "task-066-fix-eslint-baseline-and-lint-gate"
type: task
title: "Fix: restore a clean lint baseline and wire the lint gate into dev-loop's refactor phase"
status: in-progress
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

### `design` — architect

**`agent.read_related` (`dl-015` hard gate).** `depends_on: []` — no upstream task Execution Notes to
load. The gate is a **no-op** for this task; nothing blocks `red`.

**`agent.classify_acs` (T1, `dl-014` + `testing` directive).**

| AC | Classification | Why |
|---|---|---|
| 1 — `npx eslint .` exits 0 | **red-first** | Observed failing today: `npx eslint .` exits **1** with `test/storage/git-backed-storage.test.ts 90:5 error A \`require()\` style import is forbidden @typescript-eslint/no-require-imports`, `✖ 1 problem (1 error, 0 warnings)`. The new gate test (AC-5) is the executable form of this AC and fails before the fix. |
| 2 — `require()` → top-of-file ES import, suite unchanged | **split.** The lint half is **red-first** (same failing command as AC-1). The "suite still passes unchanged" half is **characterization** — `test/storage/git-backed-storage.test.ts` is green today and must stay green; it is pinned by the existing suite, no new test is written for it. |
| 3 — `lint.clean` in `dev-loop.yaml` `refactor.checks.post`, `version` bumped, `dl-034` cited | **neither red-first nor characterization — config/doc change with no runtime surface.** `dev-loop.yaml` is workflow configuration for a workflow engine that does not exist yet (CLAUDE.md §6 interim); nothing executes it, so no test can observe the entry. It *is* schema-validated: `test/workflow/schema.test.ts` parses every file under `.wingfoil/workflows/custom/` against `src/workflow/schema`, which is the existing regression net for this edit. Verified additionally by diff inspection. Per the `testing` directive's "never fabricate a red", no artificial test is added for a YAML comment. |
| 4 — hard-reject from the start, no warn-only ramp | **same as AC-3** — a property of the wording/absence of a ramp clause in that same config entry. Verified by inspection of the committed `dev-loop.yaml` diff. |
| 5 — a test asserts the gate is real (`npm run lint` / eslint exits 0 over the repo) | **red-first** | The test does not exist; when written against today's tree it fails (1 error). This is the genuine red of this task. |
| 6 — full suite green, coverage ≥ 80, `npm run docs:api` exits 0 | **characterization** | All three already hold on `main`; this AC pins that the change does not regress them. No new test; verified by running the gates in `refactor`/`review` and recording the observed numbers below. |

**`agent.verify_specs`.** Nothing is missing; **no `tech-spec` is scaffolded**. Reasoning:

- The task's two artefacts are (a) an edit to an existing test file and (b) one entry in an existing
  list in `dev-loop.yaml`. Neither introduces a file format, schema, constant set, or module API —
  the four triggers `dev-loop.yaml`'s `design` phase names.
- The workflow-file format the edit touches is already covered by
  `spec-003-workflows-yaml-schema` (`approved`). Checked its `checks.pre`/`checks.post` clause: check
  expressions are **free-form assertion strings** (`Check` is a plain string in the spec's Zod
  excerpt and in `src/workflow/schema.ts`), and the spec's list of check forms is explicitly
  introduced as *"Observed forms"* — descriptive, not a closed vocabulary. `lint.clean` is therefore
  already schema-legal and needs no spec amendment. `version` is likewise typed as a positive number,
  so 1.1 → 1.2 is in-contract.
- The decision content itself (gate placement in `refactor`, hard-reject, no ramp) is ratified in
  `dl-034-lint-gate-in-dev-loop` (`ready`), which is this task's `ref`. A `tech-spec` restating it
  would duplicate an already-approved design input.

**Checks (post).** `frontmatter.required: [title, scope]` — the `task` template requires `title`
(present); `scope` is not a field of the `task` type (it belongs to `tech-spec`), and no spec was
scaffolded, so it is vacuous here. `tech-spec.approved` — the one relevant spec, `spec-003`, is
`approved`. `depends_on.acknowledged` — vacuously satisfied (`depends_on: []`).

**Approval.** `design`'s `approval: { by_role: approver }` applies *"only when a new spec was
scaffolded"* (plan §3.2); none was, so this phase is **pass-through** — no approver action requested.
