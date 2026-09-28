---
id: "dl-102-acceptance-criteria-checked-against-the-standing-brief"
type: decision-log
title: "Acceptance criteria written by the orchestrating session contradicted the standing brief twice, and the agents were rejected for following the brief; the brief is versioned, and every criterion is checked against it before assignment"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), from its finding on what reached the agent. The
approver ruled on 2026-09-28 that this is a system error, not an agent's, and that the remedy is
an orchestrator checklist: an acceptance criterion is checked against the standing brief before
the task is assigned.

### The two instances

In v0.2, task agents in parallel worktrees received a **standing brief**, the same instructions for
every task in a wave, plus each task's own acceptance criteria. Twice a criterion contradicted the
brief:

- **`task-090`, approved at `88e77bf4` (2026-09-23) over a reviewer's REJECT recommendation.** AC5
  told the task to *file* what its sweep found. The brief told every task agent not to create Memory
  elements, because parallel worktrees collide on ids, and to report findings for the orchestrating
  session to file. The agent followed the brief and was recommended for rejection for it. The
  approval's reason: "The contradiction is the orchestrator's, written into an acceptance criterion
  without checking what the brief already said." It calls this the second of its kind, after a
  criterion that contradicted `spec-005`.
- **`task-091`, approved at `f360d697` the same day, also over a REJECT recommendation.** The notes
  said the findings were "filed, not fixed", and none had been filed. The reviewer's reject was
  right on its own terms: it was a false claim about state. But "filed" could only have meant
  "reported" under a brief that forbids filing. The approval records: "The brief will be corrected."

The earlier instance the approval refers to went the other way. `task-088` (`8612b2c9`) inherited
an acceptance criterion from `bug-076`'s *Expected* section demanding exit code 2 where the ratified
`spec-005` specifies 1. The task caught this in its own design and raised it instead of implementing
it.

### Why nothing caught it

- **The brief is not in the repository.** It was handed to agents from outside version control.
  `git grep -n 'orchestrator' a20b346c -- docs/self/.wingfoil/` prints nothing, while the same
  pattern over `docs/self/docs/04_memory/design/dls/` finds `dl-051`, `dl-061` and `dl-086`. No
  directive, template or workflow file carries its rules, so no reviewer and no later session can
  check a criterion against it.
- **Whoever writes an out-of-band task's criteria holds no declared role.** `dna.yaml` declares
  `developer, reviewer, qa, architect, product-owner, tech-lead, facilitator, approver`, and the same
  grep shows no orchestrator role. Backlog tasks get their criteria at `release-planning`'s
  `build-backlog` (role `product-owner`). Tasks created during development, as `task-090` and
  `task-091` were, get theirs from the orchestrating session. That session is bound to no directive
  and passes no check.
- **The `dev-loop` `design` phase classifies criteria but does not check them.** It declares
  `agent.classify_acs` (red-first or characterization) and `agent.verify_specs` (a tech-spec exists).
  No action compares a criterion with the bound directives or with a ratified spec. `task-088` did it
  unprompted.

## Decision

### 1. The standing brief's binding rules become versioned

Every rule the brief gives task agents, which is not the task-specific content, moves into a file
in the repository. The approver chooses where:

- **(a) Into existing or already-proposed directives, by subject.** The element-filing rule goes to
  `traceability`, beside the allocation rule of `dl-101`. Branch, worktree and merge rules go to the
  `git-conventions` directive proposed by `dl-119`.
- **(b) Into one new directive** for task execution, bound to `developer`.
- **(c) Into the `dev-loop` phase plan's template**, as a standing section every dev-loop plan copies.

**Recommendation: (a).** Each rule lands where its subject already lives and is loaded by role like
any other rule, and there is no second copy to drift. (c) keeps the rules at plan level, which is
where they failed.

### 2. A criterion is checked before the task is assigned

Before a task's `pending → backlog` approval, whoever authored its acceptance criteria checks each
one against the directives bound to the role that will execute it, and against every ratified spec
or decision-log the criterion touches. A contradiction is resolved before assignment: the criterion
is corrected, or the rule is amended by its own decision. The approval `Reason:` states that the
check ran.

This applies to every task. For backlog tasks it is a `checks.post` on `build-backlog`. For tasks
created during development it is the same check at their `pending → backlog` approval, whoever
wrote them.

### 3. Criteria are authored under a declared role

The orchestrating session writes criteria **as** `tech-lead` for out-of-band tasks, and
`product-owner` keeps backlog tasks. Its directives are then that role's. No new `orchestrator`
role is added: bindings stay by function (REQ-SYS-08), and orchestration is an activity those roles
already hold.

### 4. The implementer's safety net

`dev-loop`'s `design` phase gains a check beside `agent.classify_acs`. Each criterion is read
against the bound directives and the ratified specs, and a contradiction is raised to the approver,
not implemented and not silently resolved. This is what `task-088` did.

## Rationale

- Both overridden rejections trace to one missing check: a criterion was written without reading
  the rules the executor was already bound by. The agents did the right thing. The process
  penalised them, and the reviewer, who was also right on the text, spent a review on it.
- A brief that exists only outside the repository cannot be checked against, cited or corrected
  through the normal process. The approver's "the brief will be corrected" has no versioned object
  to act on. Moving its rules into directives makes the correction a reviewable change.
- The check sits at assignment, where fixing a criterion costs one edit, and the `design` phase
  keeps a second chance for what gets through, as `task-088` showed.

## Actions

1. **Ratify, choosing the placement in §1.** Owner: approver. The choice goes in the approve
   commit's `Reason:`.
2. **Move the brief's standing rules into the chosen directive files** under
   `docs/self/.wingfoil/directives/custom/`, and **update `roles.yaml`** if a new directive is
   added.
3. **Amend `docs/self/.wingfoil/workflows/custom/release-planning.yaml`** (`build-backlog`
   `checks.post`) and **`dev-loop.yaml`** (`design`: the criterion check), with version bumps. The
   check tokens' bindings are decided by `dl-090`.
4. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the finding on orchestrator-written criteria.
- **Amends, on ratification:** `release-planning.yaml` (`build-backlog`), `dev-loop.yaml` (`design`),
  the chosen directive files, and `roles.yaml` if a directive is added.
- **Related:** `dl-097-claim-evidence-needs-an-enforcement-point` (`claim-evidence` already names
  acceptance criteria among the sentences it governs); `dl-101-id-allocation-across-refs` (the
  filing rule the brief carried); `dl-119-a-git-conventions-directive`;
  `dl-085-how-tool-implementation-rules-reach-anyone-outside-this-repo`;
  `dl-015-inter-task-dependency-notes` (the `design` phase's existing hard gate).
- **Traceability:** REQ-SYS-08 (role-based binding), P3.6 (auto-load directives by role), P5.4.2
  (agent role to directives binding).
