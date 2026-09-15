---
id: "dl-037-builtin-vs-custom-directive-precedence"
type: decision-log
title: "When a built-in and a custom directive share an id, which one wins — and should the loser be silent?"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-012-context-loader-relevance-filtering` §5 says only **"Deduplicate by directive id"**. It
defines no precedence between a built-in and a custom directive carrying the same id, and no
behaviour for the loser.

`task-037-role-task-scoped-context` implemented the dedup (its first pass had claimed it without doing
it) and, needing *some* rule, chose the deterministic one available: keep the entry with the smallest
`path`. `DirectiveFile.path` is `join('directives', relativePath)`, so the candidates are
`directives/built-in/testing.md` and `directives/custom/testing.md` — `'b' < 'c'`, so **the built-in
wins and the team's custom file is silently discarded**. The author did not invent a precedence rule,
recorded the absence of one in TSDoc, and pinned the resulting behaviour with a test.

The review flagged that outcome as **almost certainly backwards**. CLAUDE.md §3 describes `custom/` as
holding local stand-ins and edits that exist *because* the official P3.8 built-ins have not shipped
yet; P3.8 frames built-ins as "pre-configured templates" that "teams can create custom directives" on
top of. A team's customization losing to a shipped default inverts the normal override direction that
every layered-configuration system in this project already follows.

Two things make this worth settling now rather than later. `.wingfoil/directives/built-in/` contains
only a `.gitkeep` today, so **no duplicate exists and nothing is currently broken** — the rule is
latent. And `task-057-builtin-directive-templates` is the task that ships the six built-ins whose ids
are *exactly* the ids of the six `custom/` stand-ins (`code-quality`, `testing`, `code-review`,
`architecture`, `security`, `documentation`). The moment it lands, every one of those six becomes a
live duplicate resolved by this rule.

There is a second, separable question. `spec-012` §5 also calls directives "authoritative rules …
never truncated", and the current behaviour silently drops one. `task-037` added a `warnings` channel
to `resolveRoleDirectives` in the same pass, so surfacing a duplicate costs nothing.

## Decision

*Two questions; the approver should answer both.*

**A — Precedence.**
1. **`custom/` wins** (recommended). A local customization overrides the shipped default, which is the
   direction CLAUDE.md §3 and P3.8 both describe, and the direction every other override in this
   project runs. Implementation is a one-line comparator change plus flipping the test's assertion.
2. **`built-in/` wins.** The current behaviour. Defensible only if built-ins are meant as a
   non-overridable baseline — but then a same-id `custom/` file is a configuration error, not an
   override, and should be rejected rather than silently ignored (see B.3).
3. **Duplicate ids are illegal.** Reject at load time with a `ValidationError`. Simplest to reason
   about; costs teams the ability to shadow a built-in at all, which P3.8 appears to intend they have.

**B — What happens to the loser.**
1. **Warn** (recommended). Emit through the `warnings` array `task-037` already returns, e.g.
   `directive 'testing' defined in both built-in/ and custom/; using custom/`. Zero new machinery.
2. **Silent.** The current behaviour. Cheapest, and the reason this DL exists.
3. **Error.** Only coherent with A.2 or A.3.

## Rationale

- **The recommended pair (A.1 + B.1) matches the documented intent and loses nothing.** It makes the
  override direction the one the vision documents describe, and it tells the operator that a shadow is
  in effect rather than leaving them to wonder why their edit had no visible result.
- **"Arbitrary but deterministic" was the right call for a task, and is the wrong call for a project.**
  `task-037` was correct not to invent a precedence rule inside a task whose `ref` is REQ-STATE-05 —
  that would have been exactly the unilateral spec-setting this project rejects elsewhere. But leaving
  it as a TSDoc paragraph means the rule ends up decided by string comparison, which is nobody's
  intent, and it would be inherited rather than chosen.
- **Silence is the sharper half of the defect.** A wrong precedence with a warning is a recoverable
  misconfiguration; a wrong precedence in silence is a directive an agent was supposed to obey and
  never saw. `spec-012` §5's own "never truncated" language argues against dropping one without a word.
- **Timing.** Settling this before `task-057` means six live duplicates arrive under a ratified rule.
  Settling it after means `task-057` either inherits the accidental rule or has to change it mid-task.

## Actions

- Owner **approver**: answer A and B.
- If A.1: change the comparator in `src/core/context.ts`'s dedup and flip the test that currently pins
  `built-in` as the winner; amend `spec-012` §5 to state the precedence (new spec version per the
  doc-versioning directive).
- If B.1: emit the duplicate warning through the existing `warnings` array; `task-055-auto-load-directives-by-role`
  renders it along with dl-029's no-assignments warning.
- Either way: record the rule in `spec-012` §5 so it is not re-derived.
- Hard input to **`task-057-builtin-directive-templates`**, which ships the six built-ins whose ids
  collide with the six `custom/` stand-ins, and to **`task-055`**, which renders the warnings.
- Related: `dl-029-role-with-no-directive-assignments` (which created the `warnings` channel this
  would use).
