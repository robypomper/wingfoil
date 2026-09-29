---
id: "dl-097-claim-evidence-needs-an-enforcement-point"
type: decision-log
title: "Unverified claims kept reaching review after the rule reached agents: `claim-evidence` gains a falsifiability clause for absence claims, and the rule gains an enforcement point"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`), from its headline finding: claims about the state
of the code, written without the command that settles them, were the largest single cause of task
rejections in v0.2. The approver ruled on 2026-09-28 that this is the retrospective's headline
lesson, and that it is framed as **an enforcement point is missing, not a rule**.

### How often, and what kind

- **Rejections.** The v0.2 era, from `retro-v0.1`'s approval (`20e8271`) to `a20b346c`, has 28
  task rejections: `git log 20e8271..a20b346c --grep='^wf(task): reject' --format=%s | wc -l` → 28.
  The v0.2 retrospective read all 28 bodies at `a20b346c` and assigned each one primary blocking
  cause. The result is 14 unverified or false claims, 12 functional defects and 2 missing tests. In
  the 14, the code was correct. What was wrong was a sentence: an Execution Note, a spec paragraph,
  a TSDoc comment or an agent-facing document stating something the repository did not support.
- **The pattern was named, and it recurred.** On 2026-09-22 two reject bodies named it as the
  release's leading rejection cause. `60a0dd39` (`task-086`) says: "Unverified claims about state
  are this release's recorded leading rejection cause". `8937a515` (`task-083`) says the same.
  Two days later `task-093` was rejected twice for the same habit: a false coverage attribution in
  its Execution Notes (`ab5e752d`, 2026-09-24 08:46), then spec prose contradicting the shipped build
  (`3570de87`, 10:04).
- **The rule arrived after the rejections, and the class did not stop.** The `claim-evidence`
  directive was written at `617d64a8` (2026-09-24 18:22, `task-094`), after the last rejection of
  the era. `git log --oneline 617d64a8..a20b346c --grep='^wf(task): reject'` prints nothing, while
  the same range with `--grep='^wf(task): approve'` finds 16 approvals, so the range is not empty.
  The claims still happened. They were caught later, by a reviewer or by the author:
  - 12 minutes after the directive landed, `task-100`'s approval (`d695b3f0`) records two
    corrections that were "claims about files it had read once and then described from memory".
  - On 2026-09-25, `task-104`'s notes asserted that `main` had not moved, in the same block whose
    printed output showed that it had (`d49f2679`, corrected at `babd1930`).

  So the rule reached the agents, but nothing checked it before a human reviewer did.

### The kind of claim the rule does not yet cover

`claim-evidence` already covers absence. It says to run `grep -rn` and to "paste what it printed —
including when it printed nothing". It does not say that an empty result proves nothing unless the
pattern could have matched. `git show a20b346c:docs/self/.wingfoil/directives/custom/claim-evidence.md
| grep -ciE "positive|falsif"` gives `0`. The same file does contain the absence bullet:
`grep -c "printed nothing"` gives `1`.

A v0.2 instance shows the gap. `task-079`'s review summary read an empty
`grep -rn 'REQ-SYS-09'` over the BDD feature files as "no BDD coverage for REQ-SYS-09". It was
corrected at `e693a289`. The pattern could not have matched any requirement:
`git grep -c 'REQ-' a20b346c -- docs/02_requirements/02_bdd/features/` prints nothing, while
`git grep -c 'Scenario' a20b346c -- docs/02_requirements/02_bdd/features/` lists 63 files.
Feature files trace to user stories, not to `REQ-*` codes. The empty output was a property of the
pattern, not of the coverage.

### Where the rule is checked today

- **Nowhere before review.** No workflow step or check mentions claims or evidence:
  `git show a20b346c:docs/self/.wingfoil/workflows/custom/dev-loop.yaml | grep -ciE "claim|evidence"`
  → `0`, while the same file declares five `checks:` blocks. The `code-review` directive's checklist
  names correctness, tests, directive adherence and secrets, and has no item for claims
  (`grep -ciE "claim|evidence"` over `code-review.md` → `0`).
- **Not loaded automatically.** Directives reach an agent only when someone hands them over.
  `git show a20b346c:src/core/index.ts | grep -c agentExecute` gives `0`, while the same grep for
  `memoryReject` gives `7`. Automatic loading is `minor-v0.3` scope (P5.3.1, P5.4.2). It would
  put the rule in front of the author. It would not check what the author then wrote.

So the reviewer is the only enforcement point. Each missed claim costs a full reject-and-resubmit
cycle.

## Decision

### 1. `claim-evidence` gains a falsifiability clause

Under *Claims that need a command → Absence and presence*, add:

> **An absence claim shows that its command could have found the thing.** An empty result is
> evidence only when the same command, or the same pattern, is shown hitting a known positive case,
> in the same note. A pattern that cannot match anything relevant proves nothing, however many times
> it prints nothing.

The clause applies to every place `claim-evidence` already covers: Execution Notes, bug fields,
acceptance criteria, triage notes, decision-log bodies and approval `Reason:` blocks.

### 2. The rule gets an enforcement point before the reviewer's verdict

The approver chooses one or more of these options.

**(a) A review-gate checklist item.** `code-review` gains an item. Before approving, the reviewer
re-runs the state claims in the task's review-ready summary, and every absence claim among them
must show its positive case. `dev-loop.yaml`'s `review` phase declares the matching check in
`checks.pre`. This is the only point that can judge whether a claim is *true*. Its cost is that it
still sits at the reviewer, so it makes the check explicit and uniform but does not move it earlier.

**(b) A mechanical lint on the notes, run in CI.** A script scans changed Memory documents for
state-claim phrasings ("already covered", "unchanged", "does not exist", "returns nothing",
"no caller") that carry no command in the same paragraph or list item, and for an empty-output
block with no positive case beside it. It can only check the *shape* of a claim, never its truth,
and it will produce false positives. It is cheap, and it runs before any human reads the note.

**(c) The enforcement point of `dl-103`.** The governance check on `wf()` commits could refuse a
`submit` into `in-review` whose document fails (b). That makes (b) blocking rather than advisory.
It depends on `dl-103` being ratified and built.

**Recommendation: (a) now, plus (b) as a warn-only job hosted by `dl-103`'s CI once it exists.**
(a) is the only option that checks truth. (b) moves the cheapest detection, a claim with no command,
ahead of review at no reviewer cost. (c) is not recommended alone, because a commit-time check sees
only shape. It becomes (b) made blocking, and that choice is better made after (b)'s false-positive
rate has been measured.

## Rationale

- The rule exists and says the right thing. The v0.2 figures show that writing it down did not
  remove the class: `task-100` and `task-104` came after `617d64a8`. A rule is only as strong as
  the point that checks it.
- The falsifiability clause is the narrowest addition that covers the instance the current text
  misses. `e693a289` obeyed the letter of the rule, since it ran the command and reported the empty
  result, and was still wrong.
- Placing the check at the reviewer, as in (a), codifies what already works. Of the era's 75
  review-gate approvals (`git log 20e8271..a20b346c --grep='^wf(task): approve .*in-review'`), 50
  have a body that says a figure was re-derived or re-measured, a defect reproduced, or a guard
  mutated (a body grep for `mutat|re-derived|re-measured|reproduced`, case-insensitive; a lower
  bound, since paraphrases are missed). The gain is that re-running claims becomes declared and
  routine instead of depending on the individual reviewer.
- A lint (b) is not a substitute, because it cannot tell a true sentence from a false one. It is
  worth having because the commonest failure is a claim with no command at all, and that is
  visible from text alone.

## Actions

1. **Ratify, choosing the enforcement option(s) in §2.** Owner: approver. The choice goes in the
   approve commit's `Reason:`.
2. **Amend `.wingfoil/directives/custom/claim-evidence.md`** with the clause in §1.
3. **Under (a): amend `.wingfoil/directives/custom/code-review.md`** (checklist item) and
   **`.wingfoil/workflows/custom/dev-loop.yaml`** (`review` phase `checks.pre`, version
   bump). The check token's binding is decided by `dl-090`.
4. **Under (b): a lint script and a CI job**, hosted by the check `dl-103` introduces, warn-only
   until its false-positive rate has been measured over one release.
5. **Tasks are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, the headline finding on claims without evidence;
  `retrospective-rel-v0.2-plan` §2.5 (the phase-local form of the falsifiability clause).
- **Amends, on ratification:** the `claim-evidence` directive (written by `task-094`, `617d64a8`);
  under (a), the `code-review` directive and `dev-loop.yaml` `review`.
- **Related:** `dl-098-rereview-checks-the-previous-reject-class`, the re-review arm of the same
  lesson; `dl-102-acceptance-criteria-checked-against-the-standing-brief`;
  `dl-103-governance-enforced-outside-the-agent`, which hosts (b) and (c);
  `dl-075-no-bare-line-offsets-in-memory`, the citation form a claim uses;
  `dl-085-how-tool-implementation-rules-reach-anyone-outside-this-repo`, how the rule reaches
  anyone at all; `dl-120-documentation-directive-extensions`, whose premise re-check covers the
  claims that were true when written.
- **Traceability:** `claim-evidence` is a WingFoil convention with no upstream feature (`ref: []`);
  its stated rationale is the Determinism Index (`docs/01_vision/01_product-brief.md`).
