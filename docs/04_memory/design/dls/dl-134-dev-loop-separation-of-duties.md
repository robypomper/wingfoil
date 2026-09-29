---
id: dl-134-dev-loop-separation-of-duties
type: decision-log
title: "In `dev-loop` the same role writes the tests and the code that must pass them, and nothing keeps two phases in distinct agents; `red` moves to `qa`, `red`'s tests are frozen in `green`, and each phase declares its independence"
status: ready
context: "planning"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed at v0.3 `release-planning` from the approver ruling, 2026-09-29, v0.3 release-planning
(`release-planning-rel-v0.3-plan` R4): the dev-loop gets separation of duties. The rules land in
v0.3. The checks that enforce them land with P4.12 (workflow checks) in v1.0.

**Who does what today.** `.wingfoil/workflows/custom/dev-loop.yaml` is at `version: 1.4`
(line 27). The 1.4 bump changed only a header comment (`dl-123`), so the phases are those of 1.3:

| Phase | Role | Line |
|---|---|---|
| `start` | developer | 33 |
| `design` | architect | 46 |
| `red` | developer | 62 |
| `green` | developer | 70 |
| `refactor` | developer | 78 |
| `review` | reviewer | 87 |
| `done` | developer | 99 |

**Problem 1: the author of the tests is the author of the code.** `red` ("Write a failing test that
captures the task's acceptance criteria") and `green` ("Implement the minimum code to make the test
pass") share a role. `red`'s post-checks are `tests.exist` and `tests.failing(for: red-first ACs)`
(line 66). `green`'s is `tests.passing` (line 74). Nothing stops a weak test in `red`, and nothing
stops `green` from editing the test until it passes. v0.2's own history shows `green` editing
tests, legitimately in this case, with nothing that would tell a legitimate edit from a weakening:
- In `task-090`, `red` is `1aa2208d` ("failing test for an uncommitted dna.yaml granting approval
  authority"). It adds two test files and touches no `src/` file (`git show --stat 1aa2208d`).
- `green` is `a647c225`. It changes three `src/` files and also rewrites
  `test/core/approval-authority.test.ts`, 88 lines added and 8 removed (`git show --numstat a647c225 -- test/`).
- `refactor` is `a5fff866`. It touches only `test/` files, adding coverage tests.

**Problem 2: a role is not an independent executor.** The phases name roles, and a role names a set
of directives (`.wingfoil/roles.yaml`). Nothing says two phases run in different agents:
- `dna.yaml:122` gives the only team member all eight roles.
- `dna.yaml:127` declares one agent entry that `executes_as: [ developer, reviewer, qa, architect ]`.
- `spec-003-workflows-yaml-schema` (`approved`) gives a phase `role`, `approval`, `fallback` and
  other fields (its Layer 2 field table), and nothing about who executes it beyond the role.

One session can therefore play developer and then reviewer, carrying its own reasoning into the
review it is meant to check.

**Why git cannot tell the phases apart either.** `dl-094-one-author-identity-per-act` (i) puts the
approver's identity on every commit made in the repository. The `red`, `green` and `review` commits
of a task therefore share an author, whichever agent made them. Who executed a phase can only be
recorded where the run is recorded: `dl-114-recording-agent-token-consumption`'s per-run record,
which `dl-135-agent-run-tracking` extends with the agent's
session id.

## Decision

The dev-loop separates who writes the tests from who writes the code, and each phase declares how
independent its executor must be. The v0.3 rules are directive rules and workflow configuration.
The v1.0 checks make them enforced.

### 1. `red` moves to role `qa`

`qa` exists (`dna.yaml:138`) and `roles.yaml` binds it to `testing`. In `red`, `qa` writes the tests
from the task's Acceptance Criteria and the approved tech-specs. It does not read the implementation
it is about to constrain. The `design` gate becomes more important as a result. An AC that `qa`
cannot turn into a test without reading code is sent back at `design`, which already owns the AC
classification (`agent.classify_acs`, line 48).

**Q1 — who writes characterization tests.** The `testing` directive's classification (`testing.md:20`,
from `retro-v0.1` T1) exempts characterization ACs from a failing test. Behaviour that already exists
is pinned by a test that passes on first run. Under the split:
- **(a) `qa`, in `red`, black-box.** The test goes through the public interface (CLI, exported API),
  not the internals. If it fails on first run, the AC was red-first after all and goes back to
  `design` for reclassification.
- **(b) `developer`, in `green`.** No implementation follows a characterization AC, so the developer
  pins what they know.

**Recommendation: (a).** All acceptance tests keep one author. Under (b), a task made only of
characterization ACs, like the ~11 v0.1 verification tasks `retro-v0.1` T1 counts, would have no
separation at all.

### 2. `green` and `refactor` stay `developer`, and do not edit `red`'s tests

A test written in `red` is not modified in `green` or `refactor`. If `green` finds a test wrong, the
task goes back to `red`, where `qa` fixes it. In v0.3 this is a rule in the `testing` directive,
which binds both `developer` and `qa`. In v1.0 it is a `checks.post` on `green` and `refactor`:
`tests.unchanged(since: red)`, evaluated by P4.12.

**Q2 — the scope of the freeze.**
- **(a) The files `red`'s commit touched.** `green` may still change other test files, as
  `task-090`'s did, and each change is listed in the Execution Notes for the reviewer.
- **(b) The whole test tree, additions excepted.** Any change to an existing test goes back to `red`.

**Recommendation: (a).** A contract change legitimately updates older tests, as in `task-090`.
`refactor`'s coverage additions stay legal under both options.

### 3. `review` stays `reviewer`, with the developer's and `qa`'s directives

The reviewer judges both the tests and the code, so it loads the directives of the roles it checks:
`code-quality`, `testing` and `determinism`, added to its own `code-review`, `traceability` and
`command-baseline` (`roles.yaml`). The
reviewer also checks the handoff in §5.

`review`'s `fallback` stays `{ step: red, set_state: in-progress }` (line 95). A reject returns first
to `qa`, who confirms or corrects the tests, and then to `green`. This needs no change to P4.15's
single `fallback.step`.

### 4. A per-phase independence attribute in the workflow schema

`spec-003` gains a phase field for how the phase's executor relates to the others. **This is what
prevents a phase from checking its own work, not the role name.** One agent can hold every role, so
only a constraint on the *executor* separates them.

- **(a) `mode: fresh`.** The phase runs in a new agent session. Its context comes only from Memory,
  the repository and MCP, never from an earlier phase's conversation. This is the per-phase `mode:`
  attribute (`fresh` / `resume` / `reference`, default `fresh`) that the agent run tracking
  decision-log (R5) adds to `spec-003`. It is reused here, not duplicated.
- **(b) `distinct_from: [phases]`.** The phase's run must not share a session with the named phases.
  This holds even when someone sets `resume`.
- **(c) Both.** `mode` sets the default and `distinct_from` pins the pairs that must never share
  a session.

**Recommendation: (c).** `fresh` alone is a default, and a default can be overridden. `distinct_from`
states the separation itself. Proposed in `dev-loop.yaml`:
- `green` `distinct_from: [red]`;
- `review` `distinct_from: [red, green, refactor]`;
- `refactor` may `resume` `green`, since both are the developer's.

### 5. The handoff goes through git

`red` ends with its own commit, and `green`'s commits come after it on the task branch. History then
shows the test-first order. The reviewer verifies it with `git log --format='%h %s' main..task/<id>`
and, under Q2 (a), with `git diff <red-commit> HEAD -- <red's test files>` returning nothing.
v0.2 already follows this order by convention (`task-090` above). The decision makes it the
declared contract that the v1.0 check reads.

## Rationale

- **Tests are the specification the code answers to.** If the same author writes both, a passing
  suite proves only consistency with itself. A separate author, working from the ACs and approved
  specs, makes the tests an independent reading of what was asked.
- **Independence is a property of the executor, not the role.** With one person and one agent entry
  holding every role (`dna.yaml:122`, `:127`), renaming roles alone changes nothing. §4 is the part
  that separates.
- **Rules now, checks later.** P4.12 is in v1.0 (R3). Declaring the rules and the schema attribute in
  v0.3 means the v1.0 checks read a contract that already exists, rather than introducing one.
- **The launcher makes it cheap.** `agent execute --next` (P5.3.1) launches the agent's own CLI
  through a per-agent adapter (R2, `adr-012` to be recorded). Each `--next` is a new process, so
  `fresh` costs nothing extra to provide.

**Costs.**
- **Three context loads per task.** `qa`, `developer` and `reviewer` each start a fresh session, and
  `REQ-PERF-01` allows each up to 30 s p95. v0.2 had 75 tasks.
- **Round trips.** `green → red → green` adds coordination when a test is wrong. That friction is
  intended, since it is what makes a test change visible, but it makes the loop slower.

Alternatives considered:
- **Keep `red` with the developer and add a reviewer check on tests.** Rejected. The reviewer
  arrives after `green` has already shaped the tests.
- **Enforce only in v1.0.** Rejected by R4. The rules cost nothing to declare now, and v0.3's
  `agent execute` already provides the fresh sessions.

## Actions

1. **Ratify, choosing Q1, Q2 and §4's (a)/(b)/(c).** Owner: approver, at `reconcile-governance`. The
   choices go in the approve commit's `Reason:`.
2. **`dev-loop.yaml` v1.5:** `red` role `qa`, the independence attributes of §4, and the
   `tests.unchanged(since: red)` post-check declared on `green`/`refactor` (enforced from v1.0).
   The plan's "v1.4" is already taken by the `dl-123` header bump.
3. **Amend `spec-003-workflows-yaml-schema`:** `distinct_from` under §4 (b)/(c). The `mode:` field
   comes from `dl-135-agent-run-tracking`, and both land in one amendment.
   Carried by `identify-specs`.
4. **`testing` directive:** the §2 freeze rule, the §1 black-box rule for `qa`, and Q1. **`roles.yaml`**
   (or a per-phase binding if §3 is kept dev-loop-only): the reviewer's added directives. Placement
   follows `dl-121` Q2 / `dl-120` Q1.
5. **The run record** (`dl-114`, R5) records each phase's executing session, so distinctness can be
   shown. This lets P, the process-conformance component of `dl-131-determinism-index-scope`, include the measure "each phase run by a distinct agent of the declared role".
6. **v1.0, with P4.12:** implement `tests.unchanged(since: red)` and the `distinct_from` check. Add a
   scenario to `docs/02_requirements/02_bdd/features/p4-workflow/P4.12-workflow-checks.feature`.
7. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Source:** approver ruling, 2026-09-29, v0.3 release-planning (`release-planning-rel-v0.3-plan`
  R4); the launcher from R2, the checks' timing from R3.
- **Amends, on ratification:** `dev-loop.yaml`; `spec-003-workflows-yaml-schema`; the `testing`
  directive; `roles.yaml`.
- **Related:**
  - `dl-114` and `dl-135-agent-run-tracking`: who executed each phase;
  - `dl-094`: one author identity per act, which is why git cannot show the executor;
  - `dl-131-determinism-index-scope`: component P;
  - `dl-014` and `retro-v0.1` T1: red-first vs characterization;
  - `dl-098`: the re-review checks the previous reject's class, which is the reviewer's job under §3;
  - `dl-121`: a guard says exactly what it asserts, which applies to the tests `qa` writes;
  - `dl-102`: ACs checked against the standing brief, which the design gate relies on.
- **Traceability:** P4.10, P4.12, P4.15, P5.3.1, P5.4.1, P5.4.2; REQ-SYS-08, REQ-PERF-01; BDD
  `p4-workflow/P4.12-workflow-checks.feature`, `p5-interaction/P5.4.2-role-directives-binding.feature`.
