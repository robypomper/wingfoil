---
id: "dl-109-startable-and-includable-workflows"
type: decision-log
title: "A workflow's `kind: main | sub` forces a choice between being startable and being includable, though several workflows need to be both"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log, target v0.3. Its disposition reads
"`kind: main`/`sub` cannot both apply". The finding came from using WingFoil outside this
repository and was reproduced on `wingfoil@0.2.1`.

**What the schema says.** `spec-003-workflows-yaml-schema` (`approved`) defines `kind` as `main |
sub`. `main` means "independently startable (REQ-STATE-03)". `sub` means "include-only, run when a
phase `include:`s it (P4.1)". The `Workflow` schema in `src/workflow/schema.ts` encodes it as
`kind: z.enum(['main', 'sub'])`. So one field carries two independent facts: whether a workflow can
be started on its own, and whether a phase may include it. The enum allows exactly one of the two.

**Reproduction on `wingfoil@0.2.1`.** This uses a throw-away project. The identity comes from the
environment only.

```sh
T=$(mktemp -d) && npm install --silent --prefix "$T" wingfoil@0.2.1 && W="$T/node_modules/.bin/wingfoil"
export GIT_AUTHOR_NAME=Scratch GIT_AUTHOR_EMAIL=scratch@example.invalid \
  GIT_COMMITTER_NAME=Scratch GIT_COMMITTER_EMAIL=scratch@example.invalid
cd "$(mktemp -d)" && git init -q -b main && git commit -q --allow-empty -m init
"$W" init --template Kanban
sed -i 's/^kind: sub/kind: [main, sub]/' .wingfoil/workflows/custom/kanban-delivery.yaml
"$W" workflow list >/dev/null; echo "exit $?"
git checkout -q -- .wingfoil/workflows
sed -i 's/^  - name: sunset/  - name: triage\n    include: bug-ingest\n  - name: sunset/' .wingfoil/workflows/custom/sw-life-cycle.yaml
"$W" workflow list >/dev/null; echo "exit $?"
"$W" workflow --help
```

Observed results:
- Declaring both kinds fails with `error: E_VALIDATION kind (...kanban-delivery.yaml): Invalid
  option: expected one of "main"|"sub"`, exit 1.
- A phase that includes the `kind: main` workflow `bug-ingest` passes, exit 0. spec-003 says an
  `include:` composes a `kind: sub`, but nothing enforces it. This is the same validator gap as
  `bug-145`, where `workflow list` never checks that an `include` resolves.
- `workflow --help` lists only `list`, so neither half of the consequence can be run end to end
  today. There is no `workflow start` (P4.2).

**Workflows in this repository that need both.** From `docs/self/.wingfoil/workflows/custom/`:
- **The three ingest mains** (`bug-ingest`, `decision-log-ingest`, `adr-ingest`) are `kind: main`.
  `bug-ingest.yaml`'s header describes how the bug inherits the active `element` "when invoked while
  another workflow ... is running". That is inclusion, performed at runtime and declared only in a
  comment. In v0.2 they ran inside the release eight times:
  `ls docs/05_plans/rl-v1/rel-v0.2/ | grep -c ingest` finds eight ingest plans scoped to `rel-v0.2`.
- **`e2e-smoke`** is `kind: sub`, included by `release-cycle.yaml`. `dl-099` proposes running it on
  every release candidate against a fresh project, which means starting it on its own.
- **`release-health`**, proposed by `dl-089` as `kind: sub` and included before the retrospective,
  and any recurring phase under `dl-105`. A scheduled trigger has to start a workflow that the
  release cycle also includes.

## Decision

Being startable and being includable become two declared facts. The open points follow, each with a
recommendation.

**K1 — The schema.**
- **(a) Two booleans**, `startable:` and `includable:`, of which at least one is true. `kind` stays
  readable during v0.3 as an alias: `main` means startable only, `sub` means includable only. The 22
  existing files then validate unchanged.
- **(b) A third `kind` value**, `both`.
- **(c) Leave `kind` as it is and allow any workflow to be included.** This ratifies what `workflow
  list` already accepts, and it leaves a `sub` unstartable.

*Recommendation: (a).* The two facts are independent, and (b) would be a first sign of an enum that
keeps growing. (c) solves only half of the problem, and it is the half that `e2e-smoke` and a
scheduled trigger do not need.

**K2 — The element of a workflow started on its own.** A workflow that declares `element:` gets
that element from its parent's `iterate_over` when it is included. When it is started, the element
is:
- **(a)** a required start argument, `workflow start e2e-smoke --element release:minor-v0.3`, with
  the same `type:id` form that REQ-INT-07 gives `agent execute`;
- **(b)** inherited from the active context (REQ-STATE-03), as the ingest mains' comment
  describes, and otherwise refused.

*Recommendation: (a), falling back to (b) when the argument is absent.* This makes the ingest mains'
comment into a rule and gives a scheduled trigger an explicit way to name its element.

**K3 — `include:` of a workflow that is not includable** becomes a `workflow list` validation error,
together with `bug-145`'s check that the include resolves at all.

## Rationale

- **The workaround is already practised.** In v0.2 the ingest mains ran eight times inside a
  release. Each run was a main behaving like an included sub, with the element passed by
  convention. Declaring this costs one field. Leaving it undeclared means the workflow engine (v0.3)
  has to reproduce a comment.
- **The next workflows need the other direction.** `dl-099`, `dl-089` and `dl-105` all want a
  workflow that the release cycle includes and that can also be started alone. Under the current
  enum each one would have to be duplicated or split.

## Actions

On ratification, with K1–K3 chosen in the approve commit's `Reason:`:
1. Amend `spec-003-workflows-yaml-schema` Layer 2 (`kind`, or its replacement) and Layer 1's rule
   that at least one loaded workflow is startable.
2. Update the `Workflow` schema in `src/workflow/schema.ts`, and the `workflow list` validation under
   K3.
3. Amend P4.2's and P4.6's descriptions in `docs/01_vision/06_features.md`, which speak of "startable
   mains" and "a sub when it is the next step".

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (external-use finding "`kind: main`/`sub` cannot both apply",
  reproduced on `wingfoil@0.2.1`).
- **Related:** `bug-145` (`workflow list` never resolves `include`), `bug-144` (the Kanban template
  includes by path), `dl-099` (e2e-smoke on every candidate), `dl-089` (`release-health`),
  `dl-105` (scheduled starts), `dl-104` (phase scope), `dl-090` (token bindings).
- **Traceability:** P4.1, P4.2, P4.6, P4.16; REQ-STATE-03, REQ-STATE-07, REQ-INT-07.
