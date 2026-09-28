---
id: "dl-098-rereview-checks-the-previous-reject-class"
type: decision-log
title: "A second rejection usually repeats the first one's class, often in the very passage written to fix it; the dev-loop re-review checks the previous reject's class explicitly"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), from its finding that a task rejected twice was
usually rejected twice for the same kind of defect. The approver ruled on 2026-09-28 that this
folds into the claim-evidence lesson (`dl-097-claim-evidence-needs-an-enforcement-point`), with a
specific remedy: the `dev-loop` review gate checks the previous reject's class explicitly on
re-review. It is filed as its own decision-log because it amends a different file
(`dev-loop.yaml`) and can be ratified on its own.

### The four tasks rejected twice

`git log 20e8271..a20b346c --grep='^wf(task): reject' --format=%s | sed -E 's/^wf\(task\): reject ([^ ,]+).*/\1/' | sort | uniq -c | awk '$1>1'`
at `a20b346c` lists four tasks: `task-034`, `task-054`, `task-072` and `task-093`. The v0.2
retrospective read both reject bodies for each. In three of the four, the second rejection is the
same class as the first:

- **`task-054`.** The first reject (`82475038`) found two "already covered" claims false. The second,
  23 minutes later (`527fefab`), found that the fix "reintroduced the defect it was fixing": the
  notes again asserted that an amendment was undone, when a commit predating the branch had done it.
- **`task-072`.** The first reject (`153b7ff1`) was a miswritten coverage direction. The second
  (`304d1632`) was an arithmetic error in the paragraph written to retract it: "the replacement for
  the sentence the last reject was about".
- **`task-034`.** The first reject (`8b65f796`) was a routing defect plus a TSDoc claiming unbuilt
  behaviour. The second (`4c2ce72d`) calls itself a "fresh instance of the exact defect class this
  task was rejected for the first time".
- **`task-093`** is the exception. Its first reject (`ab5e752d`) was a functional defect and its
  second (`3570de87`) was false spec prose.

The pattern is specific. The sentence written to fix a false sentence is the likeliest place for
the next one.

### What the re-reviewer has in front of them

- **The previous reason is not in the document at re-review time.** `memoryReject`
  (`src/core/index.ts`, `memoryRejectFn`) writes `rejection_reason` into the frontmatter.
  `memorySubmitFn` removes it, and `submit` is exactly the step that moves a reworked task back to
  `in-review` (`dev-loop.yaml`, `review` phase, `memory.submit`). By the time a reviewer opens the
  resubmitted task, the frontmatter copy is gone. The reason survives in the reject commit's
  `Reason:` block, which `wingfoil memory history` reads (P1.10). On this repository that command
  cannot yet run (`bug-075`), so the reason is found only with `git log`.
- **No step asks for it.** `git show a20b346c:docs/self/.wingfoil/workflows/custom/dev-loop.yaml | grep -ciE "rejection_reason|previous reject|re-review|history"`
  → `0`, while `grep -ci "reject"` over the same file → `8`. The `code-review` directive has no item
  for a second pass either (`grep -ciE "previous|re-review|second pass"` → `0`; `grep -ci reject` → `1`).
- **The implementer's side is a placeholder.** The task template's `## Execution Notes` comment asks
  the review stage to record "rejection reasons and what changed on the next pass"
  (`docs/self/.wingfoil/memory/templates/task.md`). Nothing checks that it was done.

## Decision

### 1. On a re-review, the previous reject's class is checked first

When a task enters `review` and has at least one earlier `wf(task): reject` commit, the reviewer
does two things before any new finding:

1. **Re-verifies each item of the previous `Reason:`** with the command that settles it. The item
   is resolved only if the command says so. A note saying it is resolved does not count.
2. **Searches the new pass for the same class.** A false claim is checked for in the passages
   rewritten since the reject. A defect class is checked for in the code the fix touched.

The approve or reject `Reason:` states the result of both, one line per previous item.

### 2. Where the previous reason is read from

The approver chooses one or more of these options.

- **(a) The reject commit, through `memory history`.** No change to the tool. It needs `bug-075`
  closed on this repository, which is v0.2.2's step 2, and `git log` until then.
- **(b) The implementer's Execution Notes.** The review-stage entry becomes required: one line per
  item of the previous `Reason:`, with the command that shows it resolved. This is `claim-evidence`
  applied to the rework itself. It also gives the reviewer a checklist to re-run.
- **(c) Keep `rejection_reason` until approval.** `memorySubmitFn` stops removing it, or it becomes
  a list of every reject's reason. This is a behaviour change against spec-010's field-write
  ownership, and it duplicates what the commit already records.

**Recommendation: (a) + (b).** (a) is the record, and (b) makes the implementer re-run the check
before the reviewer does. (c) is not recommended: the audit trail already holds the reason, and
the gap is that no step reads it.

### 3. The implementer re-runs the check on the replacement passage

Before resubmitting after a reject, the implementer applies `claim-evidence` to every sentence
written in response to the reject, not only to new work. The three v0.2 recurrences were all in
such passages.

## Rationale

- Three of four second rejections repeating the first class is not noise. In two of the three the
  same statement or defect family came back. A reviewer who checks the previous class first finds
  these in minutes instead of rediscovering them.
- The information already exists, in the reject commit. The defect is in the process: the one field
  that surfaced it is cleared at the moment the re-reviewer needs it, and no step reads the commit
  instead. Fixing the step is cheaper and safer than changing the field's lifecycle.
- It is the re-review form of `dl-097`'s enforcement point. `dl-097` asks the reviewer to re-run
  claims. This decision says which claims come first on a second pass.

## Actions

1. **Ratify, choosing among (a), (b) and (c).** Owner: approver. The choice goes in the approve
   commit's `Reason:`.
2. **Amend `docs/self/.wingfoil/workflows/custom/dev-loop.yaml`** `review` phase: a `checks.pre`
   entry for a re-review ("previous reject's items re-verified"), with a version bump. The token's
   binding is decided by `dl-090`.
3. **Amend `docs/self/.wingfoil/directives/custom/code-review.md`** with the re-review item of §1.
4. **Under (b): amend `docs/self/.wingfoil/memory/templates/task.md`**, so the Execution Notes
   placeholder names the required per-item entry.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the finding on second rejections.
- **Folded into:** `dl-097-claim-evidence-needs-an-enforcement-point` (approver ruling, 2026-09-28).
- **Amends, on ratification:** `dev-loop.yaml` (`review`), the `code-review` directive; under (b),
  the task template.
- **Related:** `dl-061-dev-loop-reject-bug-sync`, the same `review` fallback, which does not move an
  absorbed bug with its task; `dl-067-reason-trailer-contract`, the shape of the `Reason:` block
  this decision reads; `bug-075`, which keeps `memory history` off this repository.
- **Traceability:** P1.7 and P1.8 (approve and reject record a reason), P1.10 (`memory history`), P4.15 (review
  gate with fallback on rejection).
