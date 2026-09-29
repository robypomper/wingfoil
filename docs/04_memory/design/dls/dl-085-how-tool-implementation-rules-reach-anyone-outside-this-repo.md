---
id: "dl-085-how-tool-implementation-rules-reach-anyone-outside-this-repo"
type: decision-log
title: "`command-baseline` and `claim-evidence` reach an agent bound to a role in WingFoil's own dogfood config and nobody else — a contributor arriving through `COLLABORATION.md` meets neither"
status: in-discussion
context: "architecture"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-094` discharged `dl-080` Action 4 by writing the baseline rule where an implementer meets it: a
`custom/` directive, bound by role in `roles.yaml`, auto-loaded when an agent executes under that
role. For this repository that is exactly right, and its reviewer confirmed the placement.

It also has a reach the action did not discuss, and the task raised it rather than leaving it
implicit.

## Evidence

### E1 — the audience is bounded by the dogfood config

Both new directives live in `docs/self/.wingfoil/directives/custom/`. They are loaded when an agent
executes under a role `docs/self/.wingfoil/roles.yaml` binds. That config is **this project's own**;
no other project has it, and `bug-075` means even this project's shipped verbs cannot read it.

### E2 — `built-in/` ships nothing

`spec-011` reserves `directives/built-in/` for assets shipped by the npm package. It currently holds a
`.gitkeep`. `task-057`, which would ship the P3.8 built-in templates, is still `backlog`. So a project
scaffolded by `wingfoil init` receives the template's directives and none of ours.

### E3 — an external contributor meets neither

`COLLABORATION.md` routes an outside contributor to file intent as Memory artifacts. Nothing on that
path loads a directive, and nothing in the repository tells a human reading the code that a baseline
rule exists. `CLAUDE.md` names the role→directive bindings but not their content.

### E4 — the rules are about the tool, not about this project

"A read that gates an operation resolves at `HEAD`" is a statement about how `wingfoil` commands must
be built. It is not a house style. Anyone implementing a command — in a fork, in a contribution, in a
future release-line — needs it, and today only an agent inside this repository's config can be handed
it automatically.

## Decision

Options, none yet chosen.

### (A) Leave it, and say so

The rules govern *this* codebase's commands, and nobody outside it implements `wingfoil` commands
today. Record the bounded reach in the directives themselves so a reader knows the audience, and
revisit when a second implementer exists. Cheapest, and honest.

### (B) Promote the rule into the specs, and let the directive cite it

`spec-006` §6 already carries the baseline rule — `task-094` put it there as well. Under (B) the spec
is the authority and the directive becomes a pointer, so anyone reading the specs meets it without a
role binding. Costs nothing new; mostly a question of which document is normative.

### (C) Ship them as built-in directives

Move both to `directives/built-in/` when `task-057` ships that mechanism, so every project scaffolded
by `wingfoil init` receives them. Widest reach, and wrong for at least one of them: `command-baseline`
is about implementing `wingfoil` itself, which a *user's* project never does. `claim-evidence` is a
general rule and might belong.

### (D) A contributor-facing document

Say it in `COLLABORATION.md` or a `CONTRIBUTING.md`, for the human audience E3 describes, and leave
the directives as the agent-facing copy. Two copies of one rule is the cost, and `bug-096`'s class is
what two copies produce.

## Rationale

Recorded before a choice because the options differ in audience, not in effort. (A) and (B) are nearly
free; (C) is blocked on `task-057` and probably wrong for one of the two; (D) trades reach for
duplication.

Worth stating plainly: this is not a defect in `task-094`. `dl-080` Action 4 asked for the rule to be
written where an implementer meets it, and for the implementers this project has, it is. The question
is whether that set is the intended one.

## Actions

1. Choose among (A)–(D).
2. Whichever is chosen, record the audience **in** the directives, so a reader knows who is expected
   to have read them.
3. If (C) is ever chosen for `claim-evidence`, separate it from `command-baseline` first — they were
   deliberately made two files, and only one of them generalises.

## Relations

- Raised by `task-094-write-the-baseline-rule-where-implementers-meet-it`.
- Concerns `dl-080-which-baseline-each-command-reads` Action 4 and `bug-096`'s twin rule.
- Blocked in part by `task-057` (built-in directive templates, `backlog`) for option (C).
