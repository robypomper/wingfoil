---
id: "dl-042-directives-list-output-contract"
type: decision-log
title: "directives list: output contract, shadow marking, and the missing half of dl-029"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-053-directives-list` shipped P3.4 with a payload whose shape no approved tech-spec pins, and
its review surfaced four related questions. The implementation is correct against its BDD; what is
missing is the contract around it.

The command lists **every directive file on disk**, never the resolved set, and `--role` filters per
file rather than reusing `resolveRoleDirectives`. That decision is right — P3.4's own scenarios count
**files installed** ("the 6 built-in directives **and** `no-direct-db-access`"; "exactly the 6
built-in directives"), never ids resolved. Note the task's notes ground it in `spec-012` §5 /
`dl-037` B.1, which is an over-read: that text is scoped to the `directive-loader` inside context
assembly, and `dl-037`'s Actions assign the work to `task-055` and `src/core/context.ts`. The real
authority is the feature file.

## Decision

Four open questions.

**A — Shadow marking.** When two files share an id, the listing shows two rows differing only by
`path`. Nothing says which one wins, and knowing requires having read `spec-012` §5. Worse: `dl-037`
is **ratified but not implemented** — `src/core/context.ts:110` still reads
`if (incumbent === undefined || file.path < incumbent.path)`, so `built-in/` still wins because
`'b' < 'c'`, the **opposite** of the ratified rule. A user inferring a winner from today's listing
infers the wrong one. `task-057` turns this from one latent pair into six live ones.

Should the entry carry an explicit marker (`shadowed: true` / `winner: true`), or a warning, rather
than leaving it to inference?

**B — Type filters and column.** `X_cli-cmds.md:98` sketches `--built-in` / `--custom` / `--all` and
a "type (built-in/custom)" column. No BDD requires them. In or out? If in: is the `path` prefix or
`frontmatter.kind` authoritative? They can disagree and nothing validates one against the other —
and REQ-SEC-07 keys removability on the **directory**, not the field.

**C — Entry shape.** Does `DirectiveListEntry` — and the literal tokens `unassigned` and
`global (all roles)` — get pinned by a tech-spec (`spec-016-directives-list-output`), or stay
`[AUTHORING]`, the position `src/directives/schema.ts` has held since `task-004`?

**D — The missing half of dl-029.** `dl-029`'s ratified outcome is option **(c)**, the hybrid:
globals always **plus** the warning `no directives assigned to role '<role>'`. The warning is
implemented in the sibling path (`src/core/context.ts:98-101`). But `directives list --role ghost`
returns the globals **silently**, reproducing precisely the harm dl-029's rationale names: *a role
that was never bound is indistinguishable from one deliberately bound to globals only.* The same
silence covers a dangling binding (`ghost: [does-not-exist-on-disk]` → no row, no word).

`task-053` cited dl-029 for half its decision without recording the other half. Adding a warning
needs a `warnings` channel on a payload that is a bare `DirectiveListEntry[]`, which would break the
additive-payload property and three existing assertions — a genuine shape decision, correctly out of
that task's scope, but not one that may die in its notes.

## Rationale

A and D are the same underlying gap seen from two sides: the command whose stated purpose is
directive **visibility** is silent about the two things a user cannot otherwise see — which file
wins, and whether a role is bound at all. B and C are contract questions that block nothing today but
are cheaper to answer before `task-055` and `task-057` build on the payload.

Filed as one decision-log rather than four because the answers interact: a `warnings` channel (D) is
also the natural carrier for a shadow warning (A), and both force the entry-shape question (C).

## Actions

- Answer A–D; if C says "spec it", scaffold `spec-016` and cite it from `task-055` / `task-057`.
- Add pointers to this id in `task-053`'s Execution Notes so its "left for someone else" list
  resolves to an element rather than prose.

Related: `dl-029`, `dl-037`, `spec-012` §5, `spec-013`, `task-053`, `task-055`, `task-057`.
