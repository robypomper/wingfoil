---
id: "dl-066-p3-3-workflow-step-precondition-vacuous"
type: decision-log
title: "P3.3's \"or workflow step\" precondition has no referrer to check: nothing in the workflow pillar can name a directive"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-052-directive-remove` implements **REQ-SEC-07** clause (b) — "removal of a still-referenced custom
asset is rejected naming the referrer"
(`docs/02_requirements/03_sard/05_security-compliance.md:74-75`) — and found that only half of the
precondition the feature states is checkable.

**P3.3 scenario 1's Given** (`docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature:10`)
reads:

> `Given "legacy-rule" is not assigned to any role or workflow step`

**Verified — there is no direct referrer in the workflow pillar:**

| Claim | Command (run against `main` at `b7e39f9`) | Result |
|---|---|---|
| Nothing in the workflow schema can name a directive | `grep -in "directive" src/workflow/schema.ts` | **no hit** (exit 1) |
| Nor in the specification for that schema | `grep -in "directive" docs/self/docs/04_memory/design/specs/spec-003-workflows-yaml-schema.md` | **one hit**, `:100` — the `role` field, see below |
| Nor in this project's own workflow config | `grep -rin "directive" docs/self/.wingfoil/workflows/ docs/self/.wingfoil/workflows.yaml` | 8 hits, all English prose in `description:`/comment text (`wingfoil-init` scaffolding `.wingfoil/directives/`, `dev-loop`'s references to the `testing` and `code-quality` directives in a comment) — **no field, no reference** |

`Phase` (`src/workflow/schema.ts:45-62`) declares `name`, `description`, `role`, `actions`, `include`,
`iterate_over`/`where`, `produces`, `checks`, `approval.by_role` and `fallback.{step,set_state}`. None of
them holds a directive id.

### The nuance that stops this being simply "vacuous"

`spec-003-workflows-yaml-schema:100` describes `Phase.role` as: "The role executing the phase; **its
directives auto-load (P3.6)**." So a workflow step *does* reference directives — **transitively, through
its role, through `roles.yaml`**. The set of directives in force for a step is therefore exactly the set
`roles.yaml` binds to that step's `role` (plus `global`), which is precisely what `task-052`'s
`checkUnreferenced` already walks.

That leaves the practical position better than the literal reading suggests, and worth stating so the
decision is not over-weighted: **clause (b) is not under-checking today.** Removing a directive that some
workflow step relies on *is* refused — by the roles.yaml check, naming the role rather than the step. What
does not exist is an *independent* workflow referrer, so:

- the message can never name a workflow step, only a role;
- the feature's wording implies a check with two sources when the implementation has one, and correctly
  so;
- there is no way to express "this phase needs this directive" other than by binding it to the phase's
  role, which binds it to *every* phase that role runs.

### The direction it is heading

**P4.19 scenario 2** (`p4-workflow/P4.19-template-expansion.feature:16`) already asserts a *direct*
step→directive reference:

> `Then every generated workflow step references a directive or Memory section that also exists`
> `And there are no dangling references`

That scenario cannot be satisfied by a transitive role binding — "references a directive … no dangling
references" is a statement about a reference the step itself carries. So the specifications contain both
readings: `spec-003` says directives reach a step through its `role`, and P4.19 says a step references a
directive. Neither is implemented (`P4.19` is unscheduled; `wingfoil init`'s template expansion is the
`init` command, which scaffolds directives and workflows side by side without cross-references), so
nothing forces the two to agree yet.

### Relation to `dl-030`

`dl-030-req-sec-07-referenced-asset-ownership` (`ready`) settled *who owns* REQ-SEC-07 clause (b): the
directive half went to `task-052`, and "the **workflow** half (P4.9, message `cannot remove 'arch-review':
included by 'release-cycle'`) has **no owner at all**" (`dl-030:31-32`), registered as an unscheduled
obligation for the next `release-planning` run rather than added to v0.2 mid-flight.

This DL is a different question and is filed separately rather than as a note on `dl-030` because
`dl-030` is `ready` — settled, and a `ready` decision-log is not reopened to carry a new open question.
`dl-030` asks who builds the workflow-side check; this asks whether the thing that check would look for
can exist at all. The two answers interact: if the answer below is "no direct references" (option 1), the
P4.9 obligation `dl-030` parked shrinks to workflow-includes-workflow only
(`cannot remove 'arch-review': included by 'release-cycle'` is exactly such a case, and `include:` **is**
a real field), and clause (b)'s directive half is complete as shipped.

**Low urgency.** Nothing is broken and nothing is mis-refusing; this is a specification-coherence
question whose cost is paid only when P4.19 or P4.9 is scheduled.

## Decision

*Approver to choose. One question, three options; the recommendation is the first.*

### Can a workflow step reference a directive directly, and what does P3.3 say meanwhile?

1. **No — reconcile the wording to the role-transitive model** *(recommended)*. Directives reach a step
   only through its `role`, as `spec-003:100` already says. Amend P3.3 scenario 1's Given to
   `Given "legacy-rule" is not assigned to any role` and record in REQ-SEC-07 that the directive half's
   referrer source is `roles.yaml` alone, workflow steps included by transitivity. Then either amend
   P4.19 scenario 2 to describe the role-transitive consistency it can actually check, or accept that it
   describes a different (template-expansion) artifact and scope it there. Cheapest, changes no code,
   makes `task-052`'s shipped check exactly what the feature asks for, and keeps one way of binding a
   directive instead of two.
2. **Yes — add a `directives:` field to `Phase`.** A phase may name directives directly, on top of its
   role's; `checkUnreferenced` grows a second referrer source and P3.3's message grows a workflow-step
   form. This is the only option that makes P4.19 scenario 2 literally true and the only one that lets a
   single phase require a directive without binding it to a role everywhere. The cost is real: a
   `spec-003` schema change, a second binding mechanism for the same fact (the "one fact, two rules"
   shape `dl-051` and `dl-060` both argue against), a precedence question against `roles.yaml`, and the
   P3.6 auto-load path has to merge two sources deterministically (REQ-SYS-07).
3. **Defer — change nothing and record the gap.** Leave both wordings standing and revisit when P4.9 or
   P4.19 is scheduled. Honest about priority and costs nothing now, but it leaves P3.3's Given as the
   only written statement of a referrer that does not exist, which is what made `task-052` stop and raise
   this in the first place — the next task to read it will stop the same way.

## Rationale

- **The half that is missing is the half nothing can produce.** Unlike `dl-030`'s workflow half — which is
  unbuilt but buildable, since `include:` is a real field naming a real workflow — a step→directive
  referrer has no field to read. A precondition that no data can satisfy is not an unimplemented check;
  it is a statement about a model that does not exist.
- **It is not `task-052`'s to decide.** The task recorded it as a known weak spot — on branch
  `task/task-052-directive-remove` at `a624067` (read read-only; the document on `main` is still the
  52-line `backlog` version), `docs/self/docs/04_memory/v0.2/task-052-directive-remove.md:349`:
  "`checkUnreferenced` checks `roles.yaml` only. Nothing else in the repository can reference a directive
  today … but if a future pillar gains directive references, clause (b) must grow a second referrer
  source" — and shipped the only check it could. (Its `:71` calls the quoted line P3.3's *Background*;
  it is scenario 1's `Given`. The Background is lines 5-7 and says only that an initialized project and a
  custom directive `legacy-rule` exist.) Whether the pillar *should* gain that reference is a product/architecture question,
  which is what makes this a decision-log and not a bug: no specification is contradicted by the code.
- **Two specs already disagree with each other**, quietly: `spec-003:100` (directives arrive via `role`)
  versus P4.19 sc.2 (a step references a directive). Both are `approved`/authoritative, neither is
  implemented, and the first task to implement either will have to pick — which is the determinism risk
  REQ-SYS-07 names, arriving through two unscheduled features rather than one.
- **Option 1 is recommended because the role-transitive model is the one that is built, specified and
  sufficient.** Every directive a step needs can be bound to its role today; the only thing option 2 buys
  is finer granularity, at the price of a second binding mechanism for one fact. If that granularity is
  ever wanted, option 2 stays available and would then arrive with a reason.

## Actions

- Owner **approver**: choose 1, 2 or 3.
- If option 1: amend `P3.3-directive-remove.feature:10` (drop "or workflow step") and add a sentence to
  **REQ-SEC-07** naming `roles.yaml` as the directive half's referrer source, with workflow steps covered
  transitively via `Phase.role` (`spec-003:100`). Then settle P4.19 scenario 2 — reword or rescope — so
  the two do not contradict.
- If option 2: the `Phase.directives` field is a `spec-003-workflows-yaml-schema` amendment plus a task,
  and belongs to the next `release-planning` run, **not** to v0.2 — same constraint `dl-030` applies
  (a release already `in-development` is not widened by a review gate).
- Either way, hand the outcome to whoever picks up **P4.9** (`workflow remove`), since `dl-030` parked
  that obligation and its clause-(b) message shape depends on this answer. `dl-015`'s `read_related`
  covers `depends_on` tasks and **not** decision-logs, so it will not arrive on its own.
- No change to `task-052-directive-remove` is implied: its `roles.yaml`-only check is correct under
  options 1 and 3, and under option 2 it is the first of two sources rather than wrong.

Related: `dl-030-req-sec-07-referenced-asset-ownership` (`ready`, `:31-32`),
`dl-037-builtin-vs-custom-directive-precedence`, `dl-051-dangling-directive-binding-warning`,
`dl-060-roles-yaml-binds-by-directive-id`, `dl-062-roles-yaml-unwritable-fallback`,
`task-052-directive-remove` (branch `task/task-052-directive-remove` `a624067`, `:71-74`, `:349`),
`task-042-immutable-builtin-assets`,
REQ-SEC-07, REQ-SYS-07, P3.3 `:10`, P3.6, P4.9, P4.19 `:16`,
`spec-003-workflows-yaml-schema:100`, `src/workflow/schema.ts:45-62`.
