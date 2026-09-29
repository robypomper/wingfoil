---
id: "bug-155-multi-hop-bracket-always-reads-as-drift"
type: bug
title: "A multi-hop transition bracket `[a → b → c]` always reads as drift, because `verifyTransitionConsistency` takes everything after the first arrow as the target state"
status: triaged
severity: "low"
release-origin: "v0.2.2"
release: "v0.3"
feature: "P1.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`BRACKET_RE` (`src/memory/audit.ts:353`) splits a transition bracket at its first arrow. For a
multi-hop bracket such as `[in-review → resolved → closed]`, the declared `to` is the string
`resolved → closed`. No frontmatter `status` can equal that string, so `verifyTransitionConsistency`
reports every multi-hop commit as a mismatch, whatever the document's real state.

## Steps to Reproduce

1. On `main` at `293a8d17` (after `task-109`), take a document whose history has a multi-hop
   commit, e.g. `bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo` and its
   `wf(bug): sync … [in-review -> resolved -> closed]` (`c0833fa5`), whose frontmatter at that commit
   is `status: closed`.
2. Call `verifyTransitionConsistency(root, <that document's path>)`.
3. Read the finding for `c0833fa5`.

The behaviour is pinned as it stands by `test/memory/audit.test.ts`, the `AC4: a multi-hop … bracket`
case (`grep -n "multi-hop" test/memory/audit.test.ts` → line 494), in both arrow forms.

## Expected Behavior

A multi-hop bracket is read as a chain. Its first state is the `from`, its last state is the `to`
compared with the frontmatter, and each intermediate hop is a legal edge of the type's machine. Or,
if the grammar rules that a bracket carries exactly one hop, multi-hop subjects are reported as
unparseable rather than as drift. Which of the two is a grammar decision (`dl-079`).

## Actual Behavior

A `kind: 'mismatch'` finding with declared `to` = `resolved → closed` against the frontmatter's
`closed`, for every multi-hop commit. In this repository's history, 40 `wf(` subjects carry a
multi-hop bracket (`git log --format=%s 2e1190a4 | grep '^wf(' | grep -cE
'\[[^]]*(→|->)[^]]*(→|->)[^]]*\]$'` → 40), so an audit over the whole history would report 40 false
drifts.

## Notes

- Found at `task-109`'s review (2026-09-29), which fixed the arrow form (`bug-137`) and pinned this
  behaviour on purpose (its AC 4) rather than change it out of scope. The approver ruled it a bug.
- The multi-hop form is not an accident. `dev-loop.yaml`'s `bug.sync_state` comment prescribes
  `in-review -> resolved -> closed` in one step, and `spec-015` quotes such subjects (lines 341, 345).
- Impact today is low: nothing in the product calls `verifyTransitionConsistency` except the
  `src/memory/index.ts` re-export (`task-109` Execution Notes). It becomes visible once an audit
  command consumes it.
- Related: `dl-079` (the `wf()` commit grammar, `in-discussion`), which should rule whether a bracket
  may carry more than one hop.

## Triage & Execution Notes

<!-- triage (bug-ingest): severity call; fix: pointer to the fix task(s). -->
