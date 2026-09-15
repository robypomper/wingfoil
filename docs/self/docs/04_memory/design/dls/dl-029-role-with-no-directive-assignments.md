---
id: "dl-029-role-with-no-directive-assignments"
type: decision-log
title: "A role with no directive assignments: globals-only (spec-012) or zero directives plus a warning (BDD P3.6)?"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-012-context-loader-relevance-filtering` (`approved`) §5 and BDD
`p3-directives/P3.6-auto-load-by-role.feature` specify incompatible behaviour for the same edge case:
executing under a role that `roles.yaml` gives no directive assignments.

- **`spec-012` §5** treats the global directives as unconditional: a role's resolved set is its own
  assignments **plus** the globals, always. A role with no assignments therefore resolves to the
  globals — a non-empty set.
- **BDD P3.6**, edge scenario, requires the opposite: the agent context contains **zero** directives,
  and a warning `no directives assigned to role 'intern'` is emitted.

`task-037-role-task-scoped-context` implemented the spec-012 reading: globals are returned and no
warning is emitted. Its TSDoc cites the P3.6 edge scenario as the source of that behaviour, which is
a mis-citation — the scenario specifies neither half of what the code does.

The reconciliation lands on `task-055-auto-load-directives-by-role` (`ref: P3.6`, `depends_on:
["task-037-role-task-scoped-context", "task-039-mcp-prompts-role-based-infra"]`), which will inherit
the conflict as an unresolved BDD failure unless it is settled first.

## Decision

**Option (c), the hybrid: globals always, plus the
warning.** Keep `spec-012` §5's invariant that global directives are unconditional, and adopt P3.6's
operator signal by emitting `no directives assigned to role 'intern'` whenever a role contributes no
assignments of its own. Amend the P3.6 edge scenario's "zero directives" line accordingly.

Alternatives:

- **(a) spec-012 wins outright** — amend the P3.6 edge scenario to expect the globals and no warning.
  Simplest, but it discards a genuine usability signal: a role that was never bound is
  indistinguishable from one deliberately bound to globals only.
- **(b) BDD wins outright** — an unassigned role yields zero directives, meaning globals are *not*
  unconditional. This contradicts the purpose of a global directive (`doc-versioning`,
  `documentation`, `security-secrets` apply to every role per `roles.yaml`) and would let a
  misconfiguration silently disable the security-secrets directive. Rejected.

## Rationale

- The two documents are not really in conflict about *directives*; they are in conflict about
  *diagnostics*. spec-012 is describing what must end up in context, P3.6 is describing what the
  operator must be told. The hybrid satisfies both intents with one added warning.
- Option (b) is the only one with a safety consequence, and it points the wrong way: globals exist
  precisely so that no role can be configured out of `security-secrets`. That settles (b) as
  unacceptable regardless of which document is deemed authoritative.
- The warning is cheap and self-limiting: it fires on a configuration state that is almost always a
  mistake, and never on a correctly-bound role.
- **Note for the approver:** ratifying (c) requires editing a `.feature` file, which CLAUDE.md §2
  designates as an acceptance contract. That is the intended mechanism for a BDD that was written
  before the spec it now contradicts — but it should be a deliberate, recorded act, which is why this
  DL exists rather than a code comment.

## Actions

- Owner **approver**: ratify (a) or (c).
- If (c): amend `P3.6-auto-load-by-role.feature`'s edge scenario (globals present + warning emitted);
  add the warning to the resolver shipped by `task-037`; correct that module's TSDoc, which currently
  cites the scenario as the source of behaviour it does not implement.
- Owner **task-055-auto-load-directives-by-role**: implement against the ratified outcome; this DL is
  a hard input to its `design` phase.
