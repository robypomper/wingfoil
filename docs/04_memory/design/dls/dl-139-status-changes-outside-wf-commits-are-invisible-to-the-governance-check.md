---
id: dl-139-status-changes-outside-wf-commits-are-invisible-to-the-governance-check
type: decision-log
title: "Status changes outside wf() commits are invisible to the governance check"
status: ready
context: "dev-loop"            # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog, dl-016), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["governance","audit"]
---

## Context

`scripts/check-governance.cjs` (`task-167`) checks `wf()` commits only, which is the scope `dl-103`
§1 gives it. A commit with any other subject can change an element's `status` and pass unchecked.
For example, `docs: edit task-1` moving a task from `backlog` to `done` gives no finding (reproduced
by `task-167`'s independent reviewer). Every state change is supposed to be a `wf()` commit (P1.2),
so this is the one remaining way around the enforcement point that `task-208` will put in CI.

## Decision

Open, for the approver:

- **(a) Widen the check.** Any commit touching a Memory document must leave every `status` unchanged
  unless its subject is a `wf()` operation that declares the move.
- **(b) Keep the scope.** Record the limit in `dl-103` and in the check's documentation.

**Recommendation: (a).** It closes the gap with one rule that needs no new grammar, and the history
mode keeps older commits reported rather than failing.

## Rationale

The check exists to make the audit trail trustworthy. A status change in a commit that does not
declare it is exactly what the trail cannot show.

## Actions

1. Ratify (a) or (b). Owner: approver.
2. If (a): extend `scripts/check-governance.cjs`, with or before `task-208`.
