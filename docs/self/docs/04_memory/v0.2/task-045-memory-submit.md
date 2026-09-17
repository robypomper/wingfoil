---
id: "task-045-memory-submit"
type: task
title: "Implement `wingfoil memory submit`"
status: in-progress
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.6"
bug: ["bug-016-stale-pass2-exit-code-tsdoc"]
depends_on: ["task-036-frontmatter-lifecycle-validation"]
tmpl_version: 260703
---

## Description

As Jordan, deliver feature **P1.6** (US-3-09): submit a draft document for approval, moving it to the type's post-submit state and recording the transition in git.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.6-memory-submit.feature`.

Key scenario: `wingfoil memory submit task-101` → frontmatter `status: pending`, transition recorded in git, exit 0.


**`bug-016` — correct the two stale TSDoc blocks while you are in this neighbourhood.**
`src/validation/errors.ts` still encodes the blanket "Pass-2 semantic failures exit `2`" rule in two
places — the `EXIT_INTEGRITY` constant (~line 30) and the `ValidationError.semantic` factory (~line 74)
— and both cite `spec-009` §3 by name. That rule was repudiated when `spec-009` §3 was rewritten to key
exit codes on the nature of the failure rather than the detecting pass, and `task-036` already shipped a
Pass-2 failure (`E_INVALID_STATE`) that exits `1`, so the tree contains a counterexample to its own
documentation.

This lands here because you already own `dl-032`'s realignment of `E_INVALID_TRANSITION`'s message and
exit code in the same call path — `illegal()` in `src/memory/state-machine.ts` is what reaches
`ValidationError.semantic`. The factory itself is **not** wrong to exist: its other six call sites
(`loaders`, `id`, `query`) are genuine parse/integrity checks that correctly keep `2`. Only the prose
generalises. `bug-016` needs closing by hand — no `bug:` back-reference from this task.
## Implementation Notes

Depends on REQ-STATE-01 frontmatter lifecycle (`task-036`). First of the v0.2 memory verbs.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer, for red/green/refactor); doc-versioning, documentation, security-secrets
(global).

#### read_related (`dl-015`, HARD gate) and governance acknowledgements

- **`task-036-frontmatter-lifecycle-validation` (depends_on) — read, both passes.** Consequences
  taken on: (1) `validateFrontmatterState` is the membership check on the *current* `status`; it
  exits `1` (constructor, not `semantic()`), and its legal set is `sequence` ∪ every
  `gates.<s>.reject` target ∪ `deprecated`. Submit runs it on the document's on-disk status before
  asking the transition engine anything. (2) task-036's second pass explicitly held back `dl-032`'s
  option (c) and the `ValidationError.semantic` TSDoc and handed both to this task — taken. (3) Its
  retracted claim ("no downstream task depends on the literal old wording") is the reason the P1.6
  string is treated here as a hard contract. (4) Its test-side lesson — hard-coded type lists drift
  (`plan` was missed) — applies to any loop over registered types written here.
- **`dl-032-illegal-transition-message-contract` (ready)** — option (c), exit `1`. Honoured as:
  the contract message `illegal transition <from> -> <to> for type '<type>'`, the engine's
  explanatory text carried as the issue's `detail`, exit `1` on both the throw path
  (`ValidationError`, no longer `semantic()`) and the return path (`CoreError.code:
  INVALID_TRANSITION`, already `1` in `src/core/exit-code.ts`). `ValidationIssue` has no detail field
  today (`src/validation/errors.ts` read: `code, path, file, message` only), so an optional `detail`
  is added — dl-032's "a split `ValidationError` already supports" was not true of the issue shape.
- **`dl-027-req-sec-04-deprecate-reason-scope` (ready)** — option (a): `--reason` is mandatory on
  approval gates only. Submit's position: **no `--reason`** at all. spec-008 §2 marks `--reason`
  required only on `memory approve`/`memory reject`; P1.6 has no reason flag in any scenario; the
  submit commit is subject-only. So `requireReason` is not called and no `--reason` option is
  declared.
- **`dl-045-absorbed-bug-back-reference` (ready)** — `bug: ["bug-016-stale-pass2-exit-code-tsdoc"]`
  is recorded before start (per sub-question 1), so no reconstruction: `planned → in-progress` synced
  at start (`d1f60c6`), `in-progress → in-review` at submit. The Acceptance Criteria paragraph's
  closing sentence "`bug-016` needs closing by hand — no `bug:` back-reference from this task"
  predates dl-045 and is contradicted by the frontmatter; the frontmatter (dl-045) governs.
- **bug-016 (absorbed)** — read. Call-site count checked, not copied:
  `grep -rn "semantic(" src --include=*.ts | grep -v "static semantic"` → 6 call sites total
  (`loaders.ts` ×3, `id.ts` ×1, `query.ts` ×1, `state-machine.ts` ×1). bug-016/dl-032 say "six
  other"/"one of seven"; the true figure is five others once `state-machine.ts` stops using it.
  Immaterial to the fix, recorded so nobody re-derives it from the prose.

#### verify_specs

No new tech-spec needed; every semantic is already pinned by an `approved` spec. All 15 specs are
`approved`, counted from frontmatter only:
`for f in docs/self/docs/04_memory/design/specs/*.md; do awk 'NR>1 && /^---$/{exit} /^status:/{print $NF}' $f; done | sort | uniq -c`
→ `15 approved`. (A first, unanchored `grep "^status:"` reported one `draft`: it was the example
frontmatter block inside spec-010's body, not a spec status — corrected before relying on it.)

- `spec-001-memory-yaml-schema` — which states `submit` drives (not gate, not waiting, has a next).
- `spec-004-mcp-surface-contract` §4.1/§4.3 — Tool name `memory.submit`; commit subject
  `wf({type}): {verb} {id}` (**no** `[from → to]` bracket on submit — `src/memory/audit.ts`
  `verifyTransitionConsistency` also documents "a plain add/submit subject has no bracket").
- `spec-006-core-domain-api` §3 — `memorySubmit`, `mutates: true`.
- `spec-008-cli-grammar` §5 (exit codes), §7 (bare `<id>` positional).
- `spec-009-validation-strategy` §3 — exit by nature of failure (`E_INVALID_TRANSITION` → `1`).
- `spec-010-memory-frontmatter-schema` — field-write ownership (`memory.submit` sets `status`,
  clears `rejection_reason` by removing the key); validation rules (title and every
  `template.frontmatter.required` field non-empty once `status` ≠ `draft`).

#### Design

Shared, reusable by task-046/047/048 (none of their verbs implemented here):

| Piece | Where | Reuse |
|---|---|---|
| `resolveTypeTransition(memoryYaml, typeName, from, op, file)` — resolves the machine (REQ-STATE-08), runs `resolveTransitionTarget`, and re-throws an illegal edge as the dl-032 contract (`message` = pinned string, `detail` = engine text, exit 1) | `src/memory/state-machine.ts` | every verb |
| `formatMemoryCommitMessage({type, op, ids, transition?, approver?, reason?})` — subject `wf(type): op id1, id2`, optional ` [from → to]`, optional `Approver:`/`Reason:` body | `src/memory/commit-message.ts` (new) | approve/reject/deprecate add bracket + body |
| `setFrontmatterField` / `removeFrontmatterField` on top-level keys, byte-preserving outside the edited line(s), trailing `# comment` kept | `src/memory/frontmatter-edit.ts` (new) | reject sets `rejection_reason` |
| `prepareMemoryTransition(root, memoryYaml, id, op)` → `CoreResult` with doc path/type/from/to/content — not-found, unknown type, invalid state, illegal transition all mapped to `CoreError` | `src/core/memory-transition.ts` (new) | every verb |
| `commitMemoryTransition(root, prepared, content, message)` — one write + one scoped commit | same | every verb |

Submit-specific: `missingRequiredFields` + `renderSubmitDocument` (`src/memory/submit.ts`, new) and
`memorySubmitFn` (one compact block in `src/core/index.ts` + one registry entry). Order inside
`memorySubmitFn`: git identity → `<id>` usage check (exit 2) → load `memory.yaml` → prepare
(not found / unknown type / invalid state / illegal transition, exit 1) → required fields
(VALIDATION, exit 1) → set `status`, remove `rejection_reason` → write + commit. Every refusal
happens before any write, so "the state is unchanged" holds by construction.

**`<to>` in the illegal-transition message — a choice the specs do not make.** `submit` names no
target, yet the contract needs one. P1.6 sc.2 pins `approved -> pending` for `task`; under the real
`task` machine the edge out of `approved` is `done` (a `waiting` state), so "next state in
`sequence`" would print `approved -> done` and fail the contract. The rule adopted: `<to>` is the
verb's **canonical edge for the type** — the target of the first state in `sequence` order from
which the verb is legal (for `submit`: `draft → pending` on `task` and on the default machine,
`draft → planning` on `release`). It matches the pinned string on both machines, is a pure
function of the machine (REQ-SYS-07), and the precise reason stays in `detail`. When a machine has
no legal edge at all for the verb, `<to>` renders as `(none)`. Proposed as a decision-log in the
final report so the approver can ratify or change it before task-046/047 inherit it.

Out of scope, recorded: the MCP `memory.submit` Tool is registered mechanically (parity), but the
MCP surface populates no positional, so it cannot yet carry `<id>` — the same limitation `memory.add`
has; P5.2.3 is scheduled in `minor-v0.4` (`grep -n P5.2.3 docs/self/docs/04_memory/planning/rl-v1/minor-v0.4.md`).

#### T1 — AC classification

| AC | Class | Evidence |
|---|---|---|
| P1.6 sc.1 — submit a draft → `status: pending`, recorded in git, exit 0 | **red-first** | no `memorySubmit` in `CORE_MODULES` (`grep -n memorySubmit src/core/index.ts` → only the doc-comment mention at the SCOPE note) |
| P1.6 sc.2 — illegal `approved -> pending`: state unchanged, exit 1, pinned message | **red-first** | engine message is ``illegal `submit` from "approved": …`` and exit `2` (`src/memory/state-machine.ts` `illegal()` uses `ValidationError.semantic`; `test/memory/state-machine.test.ts:178` pins `2`) |
| P1.6 sc.3 — `document not found: task-999`, exit 1 | **red-first** | no operation exists |
| spec-010 — required fields non-empty on submit; `rejection_reason` removed; one scoped commit `wf(type): submit id` with no bracket, readable by `memory history` as `operation: submit` | **red-first** | no submit code path exists |
| dl-032 — contract message + `detail` + exit 1 on the transition engine path | **red-first** | as sc.2; `ValidationIssue` has no `detail` field |
| bug-016 — correct the two TSDoc blocks in `src/validation/errors.ts` | **characterization (documentation only)** | prose; no behaviour changes — `semantic()` still exits `2` for its remaining five callers, pinned by the existing suite. Verified by reading the rewritten blocks, not by a test; no red fabricated. |

### red — role: developer

Commit `b01966f`. New suites `test/memory/commit-message.test.ts`, `test/memory/frontmatter-edit.test.ts`,
`test/memory/submit.test.ts`, `test/core/memory-submit.test.ts`; a `resolveTypeTransition` block in
`test/memory/state-machine.test.ts`, whose existing exit-code test was flipped `2 → 1`; the three
registry/parity lists (`production-registry`, `parity`, `read-only-agent-channel`) gain
`memorySubmit`. Observed red, for the stated reasons:

```
npx jest test/memory/commit-message.test.ts test/memory/frontmatter-edit.test.ts test/memory/submit.test.ts \
  test/memory/state-machine.test.ts test/core/memory-submit.test.ts test/core/production-registry.test.ts \
  test/core/parity.test.ts test/mcp/read-only-agent-channel.test.ts
Test Suites: 8 failed, 8 total
Tests:       27 failed, 73 passed, 100 total
```

Causes: `Cannot find module '../../src/memory/{commit-message,submit,frontmatter-edit}'`;
`resolveTypeTransition is not a function`; the flipped exit-code test `Expected: 1, Received: 2`;
`fixture bug: "memorySubmit" operation not registered on the memory module`; the registry lists
lacking `memorySubmit`.

### green — role: developer

Commit `214c3ac`. As designed, with one refinement found while writing the `release` test: from the
canonical target state itself the rule printed a self-loop (`planning -> planning`), so `<to>` falls
back to the next state in `sequence` there (`planning -> in-development`); both cases are tested.
`resolveTypeTransition` rethrows only `ValidationError`s. bug-016's two TSDoc blocks were rewritten
to the nature-of-failure rule, with `semantic()` described as the constructor for integrity failures
specifically. `ValidationIssue.detail` added (optional).

### Merge of `main` (dl-035)

`bd96dc6` merges `main` at `f4b3613` (dl-041's implementation: `spec-006` §3 `module` column,
`spec-008` §1 noun list). No conflict. Re-read after the merge:
`grep -n memorySubmit docs/self/docs/04_memory/design/specs/spec-006-core-domain-api.md` → the row
names module `memory` — the module `memorySubmit` registers on. The same section defines *(planned)*
as "not yet registered", so the refactor commit drops the marker from that one row (spec-006 has no
version field to bump). spec-008 §2 (`--reason` required only on approve/reject), §5 and §7 (bare
`<id>`), cited in design, read unchanged after the merge.

### refactor — role: developer

Commit `b13672e`: `frontmatter-edit` uses `map`/`findIndex` instead of indexed access with `?? ''`
fallbacks (branch coverage of the file 85.71 → 100); a missing `status` is reported as `''` rather than
the text `undefined` (new test); `test/cli/program.integration.test.ts` drives the three P1.6 scenarios
through the real compiled `commander` wiring (stderr lines and exit codes as the feature states them);
the `spec-006` marker above.

Dogfood check (not a gate): a scratch clone of this branch, `memorySubmit` called with
`root = <clone>/docs/self` — `task-045-memory-submit` `in-progress → in-review` produced one commit
`wf(task): submit task-045-memory-submit` touching only that file; `task-036` (`done`) returned
`illegal transition done -> pending for type 'task'` with detail "the last state in `sequence`".
Through the CLI this is not reachable: `resolveProjectRoot` refuses any cwd other than the git root,
and the dogfooded config is under `docs/self/`.

### review-ready summary

**Gates** (worktree, after the merge and refactor):

| Command | Result |
|---|---|
| `npx jest --maxWorkers=4` | 84/84 suites, 1137/1137 tests passed |
| `npx jest --coverage --maxWorkers=4` | All files 98.29 stmts · 90.43 branches · 98.53 funcs · 98.99 lines. Baseline, same command on `main` `f4b3613` in a scratch worktree: 98.29 · 90.18 · 98.44 · 98.93 — no metric regresses |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

New files: `commit-message.ts`, `frontmatter-edit.ts`, `submit.ts` 100% on all four metrics;
`memory-transition.ts` 100% lines, one uncovered branch (line 93, the rethrow of a
non-`ValidationError`); `state-machine.ts`'s only uncovered lines (240–241) are the pre-existing
exhaustive `default` arm.

**BDD P1.6 → tests**

| Scenario | Tests |
|---|---|
| sc.1 submit a draft | `test/core/memory-submit.test.ts` "P1.6 sc.1: moves a draft to `status: pending`…"; `test/cli/program.integration.test.ts` "sc.1 `memory submit task-101`…" |
| sc.2 illegal transition | `test/core/memory-submit.test.ts` "P1.6 sc.2: an illegal transition (approved -> pending)…"; `program.integration` "sc.2 `memory submit task-200`…"; `test/memory/state-machine.test.ts` "BDD P1.6 sc.2 against the REAL `task` machine…" |
| sc.3 not found | `test/core/memory-submit.test.ts` "P1.6 sc.3…"; `program.integration` "sc.3 `memory submit task-999`…" |

`P5.2.3` (MCP) is `minor-v0.4` scope; its sc.2 string comes from the same `resolveTypeTransition`,
but no MCP-channel test is claimed here.

**T1 outcome:** every red-first AC had a genuine failing test first (above); bug-016 stayed a
documentation-only characterization with no fabricated red.

**For the approver:** (1) the `<to>` rule in the contract message is a choice the specs do not make
(design, green); (2) submit emits the spec-004 §4.3 subject with no `[from → to]` bracket, while
hand-made `wf(task): submit … [in-progress → in-review]` commits in this repository carry one — the
tool follows the spec; (3) required-field enforcement follows spec-010's rules, but submit does not
check that template placeholder comments were replaced — nothing defines that check mechanically.
