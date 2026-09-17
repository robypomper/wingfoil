---
id: "dl-051-dangling-directive-binding-warning"
type: decision-log
title: "Ratify the dangling-binding warning in directive resolution (and so in context assembly), and the shadow-warning text"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`dl-042` (`ready`, approved `995dfc0`) answered its question D: `directives list --role <r>` warns for
a role with no assignments **and for a dangling binding** — a `roles.yaml` entry naming a directive id
with no file. Its approve Reason scopes that to the listing: "`directives list --role <r>` for a role
with no assignments (and a dangling binding) emits the warning instead of returning the globals
silently".

`task-055-auto-load-directives-by-role` implemented it one layer lower, and in doing so went past
`dl-042`'s literal text — which the task itself flags (read at `749e0e9`; the task has since been
approved and merged to `main` at `9c83ca2`, so all of the following is now on `main`):

- The warning is emitted by `resolveRoleDirectives` (`src/core/context.ts:149,173`):
  `directive '<id>' bound to role '<role>' has no directive file`. Because context assembly calls the
  same resolver, **`ExecutionContext.warnings` carries it too**, and a dangling **global** binding
  (e.g. a missing `security-secrets`) is reported as well.
- The shadow warning (`dl-037` B.1) is emitted as
  `directive '<id>' defined in <path>, <path>; using <winner>` (`src/core/context.ts:67,122`).
- Task Execution Notes, design decision **D4**: "dangling bindings are reported by the resolver, so
  context assembly reports them too … Flagged for the approver … as the one place this task's reading
  goes beyond dl-042's literal text"; and "Warning texts are not ratified anywhere except dl-029's."

Before that merge (`main` at `8a6a091`) the resolver said the opposite: `src/core/context.ts:84-86` —
dangling ids "are silently skipped, not an error".

The specs have not caught up. `spec-012` §5 names the shadow warning (via `dl-037`) and the `warnings`
channel `dl-029` introduced, but neither the dangling-binding warning nor any warning text. Meanwhile
`task-069` (`done`) already treats the warnings channel as ratified content: `src/core/context.ts:203-206`
at `8a6a091` — "`ExecutionContext.warnings` carries directive-resolution diagnostics (dl-029), and adding
an unratified entry would change a payload REQ-SYS-07 governs" (at `9c83ca2`, `:263`, now citing
`dl-029, dl-037, dl-042`). `git diff --stat 8a6a091 9c83ca2` touches no spec, so the merged warnings
remain unratified in `spec-012`.

**The approver accepted task-055's D4 in chat on 2026-09-17.** This decision-log records that
acceptance as an element so the `spec-012` amendment it implies is schedulable; the approve commit is
the orchestrator's to make.

## Decision

**Accept task-055's D4 as implemented:**

1. `resolveRoleDirectives` emits a warning for every id bound to the role — through its own
   `assignments` entry **or** through `global` — that has no directive file:
   `directive '<id>' bound to role '<role>' has no directive file`.
2. Because context assembly uses the same resolver, the warning is part of `ExecutionContext.warnings`
   as well as of `directives list --role <r>`'s `warnings`; the two are one rule, never two.
3. The shadow warning text is `directive '<id>' defined in <path>, <path>; using <winner path>`.
4. Fixed order within `warnings`: no-assignments, then dangling ids ascending, then shadowed ids
   ascending (REQ-SYS-07).
5. `spec-012` §5 is amended to state 1–4.

Alternatives considered: listing-only (move the dangling loop into the listing builder, leaving
`ExecutionContext.warnings` unchanged) — rejected, because it splits one configuration fact across two
rules and leaves agent-session context assembly silent about the exact directive an agent will not
receive.

## Rationale

- A dangling binding is the same harm `dl-037` named for shadows — "a directive an agent was supposed
  to obey and never saw" (`dl-037-builtin-vs-custom-directive-precedence.md:74-75`) — and it matters
  most for a dangling global, which removes a directive from **every** role.
- Emitting at the resolver is what makes `directives list --role` an exact preview of what a session
  receives; a listing-only warning would be a second implementation that can drift.
- The texts need a home in a spec because `task-069`'s TSDoc already treats the channel's content as
  ratified, and `dl-050` proposes checks that key on these warnings.

## Actions

- Orchestrator: `memory.approve` on the approver's recorded instruction (chat, 2026-09-17).
- Amend `spec-012` §5 with points 1–4, as a dated Revision note (`dl-047`) — not done in this ingest.
  `task-055` is already `done` and merged (`9c83ca2`), so this amendment is now the only thing standing
  between its warning texts and a spec; schedule it promptly rather than with a later release.

Related: `dl-029`, `dl-037`, `dl-042` (D), `dl-050` (who sees these warnings), `spec-012` §5,
`task-055-auto-load-directives-by-role`, `task-069`.
