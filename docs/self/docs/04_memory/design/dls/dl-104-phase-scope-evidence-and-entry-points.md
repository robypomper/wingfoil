---
id: "dl-104-phase-scope-evidence-and-entry-points"
type: decision-log
title: "A workflow phase does not declare what it iterates over, what evidence it leaves, whose deliverable it produces or whom it waits for, so neither an interface nor the workflow engine can tell that a phase is done"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

The v0.2 retrospective (`retro-v0.2`) files this decision-log. Its disposition reads "phase scope and
evidence", and it bundles five gaps in the workflow DSL into one decision. The retrospective called
that decision a prerequisite of the workflow engine and set its target to v0.3. A sixth gap,
recurring phases, was split out to `dl-105`.

P4.13 (*Workflow State Deduction*) says a phase's state is deduced from Memory, with no stored
status. Phases backed by Memory are deduced from element status. Phases that produce specs or
documents are deduced from whether their `produces:` artifacts exist. `spec-003-workflows-yaml-schema`
(`approved`), Layer 2, gives a phase `actions`, `include`, `iterate_over`/`where`, `produces`, `checks`,
`approval` and `fallback`. The figures below come from loading every file under
`docs/self/.wingfoil/workflows/custom/` with `js-yaml`, at `a20b346c`: `git diff --stat a20b346c HEAD
-- docs/self/.wingfoil/workflows` prints nothing in the worktree measured. The files declare 81 phases.

**1. Evidence: 17 of 81 phases leave nothing to deduce from.** These phases have no `actions`, no
`produces` and no `include`. Examples:
- `retrospective.yaml`'s `additional-points` phase says of itself "A review checkpoint, not an
  approval-gated transition — no commit";
- `release-submit.yaml`'s `pre-release-checks` phase;
- the three phases of `user-story-mapping.yaml`.

Four phases carry `approval: { by_role: approver }` but no deliverable, no Memory action and no git
action, so an approval there leaves no trace in the repository. They are `e2e-smoke.gate`,
`release-submit.approve-release`, `retrospective.additional-points` and `retrospective.approve`.
The last one is instructive. The retrospective's approval *is* a Memory transition,
`wf(decision-log): approve retro-{version}`, but the phase does not declare it, so the engine could
not deduce it.

**2. Scope: `iterate_over` accepts one Memory type only.** spec-003 types it as "string (memory
type)", and REQ-STATE-07 counts matching *elements*. All three uses in this configuration iterate
over a Memory type:
- `sw-life-cycle.release-line-cycle`, over `release-line`;
- `release-line-cycle.delivery`, over `release`;
- `release-cycle.implementation`, over `task`.

Iteration over anything else has to be written as prose. `e2e-smoke.yaml`'s `fresh-init` phase
says "Run `wingfoil init` (each supported template)". The templates are a list in
`src/storage/templates.ts`, not Memory elements, so no field can express that loop.

**3. Ownership: `produces:` does not say whose deliverable it is.** `dev-loop.yaml` binds
`element: task`, yet its `design.produces` is `docs/04_memory/design/specs/{id}.md`. That `{id}` is
the id of a tech-spec the phase may create, not of the task, and nothing in the pattern says so.
`retrospective.yaml`'s `explore.produces` is not a path at all: "retrospective friction inventory
(source-cited, grouped by theme)". An engine cannot test such an entry for existence. 24 of the 81
phases declare `produces`.

**4. Waiting: `approval:` cannot express waiting on a third party.** `approval: { by_role }` means
one of our roles decides. `release-publishing.yaml`'s `publish` phase instead waits on things
outside the project:
- its `checks.post` is "package published to npm registry";
- under `dl-087` (`in-discussion`), a release goes live only after a maintainer's 2FA
  `npm stage approve` on npmjs.com;
- the GitHub `npm-publish` environment's required reviewer gates the job (`adr-006`).

None of these is a role in `dna.yaml`, and none can be recorded by `memory approve`.

**5. Entry points: 28 of 81 phases have one.** Here an entry point means an action token naming a
command that ships: a `memory.*` verb, `config.init` (`wingfoil init`) or `cli.run(...)`. The other
53 phases can be reached from no interface. The CLI has no `workflow start` or `workflow next`:
`wingfoil workflow --help` lists only `list`. The MCP server exposes read-only Resources and role
Prompts (spec-004, REQ-SEC-05). So the only way to learn that such a phase is done is to read the
plan a person wrote for it.

Together these gaps mean that a future interface cannot show where a workflow stands, whether it
is the engine's `workflow status` (P4.5), the MCP server or the post-MVP UI (`dl-008`). The same is
true for a scheduled trigger (`dl-105`). Each phase has to be explained by hand, as every phase plan
under `docs/05_plans/` does today.

## Decision

Every phase declares how its completion is known, and the DSL gains the fields needed to say it.
The five points below are open for the approver, each with a recommendation.

**D1 — Evidence.**
- **(a)** Every phase must declare at least one of `produces`, a Memory action or `include`.
  `workflow list` rejects a phase with none.
- **(b)** Phases stay as they are, and the engine writes a run record for every phase it completes,
  for example a commit trailer `WingFoil-Phase: <workflow>.<phase> completed`.
- **(c)** (a) for phases whose completion is a fact in the repository, and (b) for checkpoints
  whose only outcome is a human saying "go on", such as `additional-points`.

*Recommendation: (c).* (a) alone would force fake deliverables onto review checkpoints. (b) alone
would let a phase that should produce a document complete without producing it.

**D2 — Scope.**
- **(a)** `iterate_over` stays Memory-only.
- **(b)** It also accepts a collection declared in versioned configuration, for example a
  `dna.yaml` list (`dna:modules`) or a list the binding file of `dl-090` declares (such as the
  `init` templates).
- **(c)** It accepts the output of a bound command.

*Recommendation: (b).* It keeps REQ-STATE-09's determinism, because the collection is versioned.
(c) would make the iteration depend on a command's runtime output.

**D3 — Ownership.** A `produces` entry names its owner: either the workflow's `element`, which is
the default, or a type the phase creates, e.g. `{ type: tech-spec, path: ".../{tech-spec.id}.md" }`.
A `produces` entry that is not a path pattern is a validation error.
*Recommendation:* adopt as stated. The alternative is interpolation-by-convention, which is exactly
what `{id}` does today, ambiguously.

**D4 — Waiting on a third party.** A new phase field `awaits: { party, evidence }`, distinct from
`approval:`. `party` names the outside actor, such as the npm registry or a GitHub environment
reviewer. `evidence` is a bound check (`dl-090`) that observes the outcome, such as
`npm view wingfoil@{release.version} version`.
*Recommendation:* adopt. The external party can be linked to a `service` element once `dl-088` is
ratified.

**D5 — Entry points.**
- **(a)** Each phase declares an `entry:` command.
- **(b)** The engine's generic `workflow start` and `workflow next` (P4.2–P4.7) are the entry point
  for every phase. A phase is enterable when its predecessor's completion is deducible under D1.

*Recommendation: (b).* It needs no per-phase field. The gap measured above is a gap in evidence
more than in commands.

## Rationale

- **The engine deduces state; it cannot deduce what was never written down.** P4.13 promises
  deduction without a stored status. In this configuration that promise already fails for 17
  phases, before any engine exists.
- **Declaring now is cheaper than retrofitting.** A new field changes spec-003 and every workflow
  file in the same change (spec-003, Consequences). Doing it before v0.3 builds the engine touches
  22 files. Doing it after would also change the engine.
- **The same gaps block other elements.** `dl-105`'s recurring phases need D1's run record. `dl-088`'s
  `service` type needs D4. `dl-090`'s bindings need D2's collections and D4's evidence checks.

## Actions

On ratification, with the approver's choices recorded in the approve commit's `Reason:`:
1. Amend `spec-003-workflows-yaml-schema` Layer 2 with the chosen fields (evidence and run record,
   `iterate_over` collections, `produces` ownership, `awaits`), and REQ-STATE-07's fit criterion
   for non-Memory collections under D2 (b).
2. Update `docs/self/.wingfoil/workflows/custom/*.yaml` in the same change, starting with the four
   approval-only phases and `retrospective.yaml`'s `explore.produces`.
3. Extend `workflow list` validation (`src/workflow/`) to enforce D1 and D3.

v0.3 `release-planning` (`build-backlog`) derives the tasks. None are created here.

## Relations

- **Filed by:** `retro-v0.2` (v0.2 retrospective, disposition "phase scope and evidence").
- **Split out:** `dl-105` (recurring and schedulable phases).
- **Related:** `dl-090` (token bindings), `dl-088` (`service` type), `dl-087` and `adr-006` (third
  parties in publishing), `dl-008` (UI post-MVP), `dl-109` (workflow `kind`).
- **Traceability:** P4.5, P4.11, P4.13, P4.16; REQ-STATE-02, REQ-STATE-07, REQ-STATE-09.
