---
id: spec-003-workflows-yaml-schema
type: tech-spec
title: "workflows.yaml manifest + Workflow DSL schema"
status: approved
scope: "docs/self/.wingfoil/workflows.yaml + docs/self/.wingfoil/workflows/**/*.yaml"
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

The Project Workflow pillar (P4.1) is configured by two kinds of YAML file that today have
**no shared, validated definition**:

1. **The main manifest** — `docs/self/.wingfoil/workflows.yaml`. It carries a format `version` and
   a single ordered list of workflow-file paths to load (P4.1: *"main file `.wingfoil/workflows.yaml`
   includes built-in/custom workflows"*). Every WingFoil command reads it at startup to build the
   workflow registry; a divergent or unvalidated shape breaks `workflow list/start/next/status`
   (P4.2–P4.6) and the `wingfoil://workflows` MCP resource.
2. **The per-workflow definition files** — `docs/self/.wingfoil/workflows/**/*.yaml` (currently all
   under `custom/`). Each declares a workflow's `kind`, its bound `element`, and its ordered `phases`
   with roles, atomic actions, composition (`include`/`iterate_over`/`where` — P4.16), deliverables
   (`produces`), gates (`checks`, `approval`), and routing (`fallback`). These are loaded and executed
   but never structurally validated, so a typo in a phase field surfaces only as a runtime failure.

Without a single schema, every consumer re-parses these files ad hoc and each new workflow author
guesses field names. The `initial-design` scope for rl-v1 requires validating **both** layers, so
this spec covers the manifest **and** the workflow DSL, grounding every DSL field in the workflow
files that already exist in this repository.

This spec also mandates one config change: the manifest key is currently `includes:` (plural) and
**must be renamed to `include:` (singular)** — see Consequences.

## Specification

Two layers are defined. Both files are parsed as YAML (via the shared parse infrastructure) and then
structurally validated: layer 1 for `workflows.yaml`, layer 2 for every file it lists.

### Layer 1 — `WorkflowsYaml` (the main manifest)

Resolved against `.wingfoil/workflows.yaml` under the project (or `docs/self/`) root. Fields:

| Field     | Type                 | Required | Description                                                                                                                            |
|-----------|----------------------|----------|--------------------------------------------------------------------------------------------------------------------------------------|
| `version` | number (positive)    | no       | Config-file format version (e.g. `1.0`). Accepted but not required, for forward compatibility.                                        |
| `include` | string[] (min 1)     | yes      | Ordered list of paths to workflow-definition YAML files, each resolved relative to the directory containing `workflows.yaml` (`.wingfoil/`). At least one path is required. |

```yaml
# workflows.yaml — layer-1 shape (canonical key: `include`, singular)
version: 1.0
include:
  - workflows/custom/sw-life-cycle.yaml        # kind: main — startable
  - workflows/custom/bug-ingest.yaml           # kind: main — startable
  - workflows/custom/release-line-cycle.yaml   # kind: sub  — include-only
  - workflows/custom/dev-loop.yaml             # kind: sub  — include-only
```

Zod shape:

```ts
export const WorkflowsYaml = z.object({
  version: z.number().positive().optional(),
  include: z.array(z.string()).min(1),
});
```

Resolution semantics for each `include` path:

1. Resolve the path against the config root (`.wingfoil/`).
2. Verify the file exists; otherwise → `E_WORKFLOW_FILE_NOT_FOUND` (semantic, post-parse).
3. Parse and validate the referenced file against **Layer 2** (below). At least one loaded workflow
   must be `kind: main` for the registry to be startable (REQ-STATE-03 allows several open mains).

> **Required rename (`includes` → `include`).** The current `docs/self/.wingfoil/workflows.yaml`
> uses the key `includes:` (plural). This spec makes `include:` (singular) canonical — matching the
> P4.1 prose and the `include:` phase field of Layer 2 — so the manifest key and the phase-composition
> key read the same. Renaming the key in `workflows.yaml` is a **required follow-up config change**
> tracked with this spec; the schema validates only `include` and treats `includes` as an unknown key.

### Layer 2 — `Workflow` DSL (one per file under `workflows/**/*.yaml`)

Every workflow-definition file validates against the following schema. Top-level fields:

| Field         | Type                    | Required | Description                                                                                                                                    |
|---------------|-------------------------|----------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `name`        | string                  | yes      | Unique workflow identifier; the token passed to `wingfoil workflow start <name>` (mains) or named by a phase's `include:` (subs).             |
| `kind`        | `main` \| `sub`         | yes      | `main` = independently startable (REQ-STATE-03: multiple open mains allowed); `sub` = include-only, run when a phase `include:`s it (P4.1).   |
| `description` | string                  | no       | Human summary of the workflow's purpose.                                                                                                      |
| `version`     | number (positive)       | no       | Workflow-definition format version (e.g. `1.0`).                                                                                              |
| `element`     | string (memory type)    | no       | The Memory element type this workflow operates on, provided by the parent's `iterate_over` (e.g. `release-line`, `release`, `task`). Absent for workflows that manage no single element. |
| `phases`      | `Phase[]` (min 1)       | yes      | Ordered list of phases; executed top to bottom (subject to `fallback` routing).                                                              |

Each **`Phase`** object:

| Field          | Type                          | Required | Description                                                                                                                                                              |
|----------------|-------------------------------|----------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `name`         | string                        | yes      | Phase identifier, unique within the workflow; also the target token for `fallback.step`.                                                                                |
| `description`  | string                        | no       | What the phase does and why.                                                                                                                                            |
| `role`         | string (a `dna.yaml` role)    | no       | The role executing the phase; its directives auto-load (P3.6). Omitted when the phase only `include:`s another workflow (the included phases carry their own roles).    |
| `optional`     | boolean (default `false`)     | no       | If true the phase may be skipped when its guard/`checks.pre` are unmet, without failing the workflow.                                                                   |
| `actions`      | string[]                      | no       | Ordered **atomic** actions (P4.10 / REQ-INT-06), each an action expression (see below). Executed in order.                                                             |
| `include`      | string (a workflow `name`)    | no       | Compose a `kind: sub` workflow here (P4.16). Mutually the composition counterpart of `actions`: an `include:` phase delegates its body to the named sub-workflow.       |
| `iterate_over` | string (memory type)          | no       | With `include`, run the composed workflow **once per matching element** of this type (P4.16) instead of once. The element is bound as this workflow's `element`.        |
| `where`        | map<string, scalar \| scalar[]> | no     | Filter for `iterate_over`: a live query over current Memory frontmatter (REQ-SYS-03), each key a frontmatter field, each value an exact match or an allowed-value list. Values may interpolate `{element.field}` from the enclosing scope. |
| `produces`     | string[]                      | no       | Deliverable artifact path patterns the phase creates/updates (may contain `{id}`/`{element.field}` placeholders); used to deduce phase completion by artifact existence. |
| `checks`       | `{ pre?: string[], post?: string[] }` | no | Guard conditions. `pre` must hold before the phase runs; `post` must hold for it to complete. Each entry is a check expression (see below).                              |
| `approval`     | `{ by_role: string }`         | no       | Marks an approval gate: the phase completes only when the named role approves (agents route approval to the `approver` role — P1.7; agents never self-approve).         |
| `fallback`     | `{ step: string, set_state?: string }` | no | On rejection/failure, route back to the named phase (`step`) and optionally reset the active element's state to `set_state` before retrying.                             |

Zod shape (illustrative):

```ts
const Check = z.string();
const Phase = z.object({
  name: z.string(),
  description: z.string().optional(),
  role: z.string().optional(),
  optional: z.boolean().default(false),
  actions: z.array(z.string()).optional(),
  include: z.string().optional(),
  iterate_over: z.string().optional(),
  where: z.record(z.union([
    z.string(), z.number(), z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
  ])).optional(),
  produces: z.array(z.string()).optional(),
  checks: z.object({ pre: z.array(Check).optional(), post: z.array(Check).optional() }).optional(),
  approval: z.object({ by_role: z.string() }).optional(),
  fallback: z.object({ step: z.string(), set_state: z.string().optional() }).optional(),
});
export const Workflow = z.object({
  name: z.string(),
  kind: z.enum(["main", "sub"]),
  description: z.string().optional(),
  version: z.number().positive().optional(),
  element: z.string().optional(),
  phases: z.array(Phase).min(1),
});
```

#### Action expressions (`actions[]`)

Free-form string tokens naming one atomic operation each. The families observed in the current
workflow files:

- **Memory operations** — `memory.add(type: tech-spec)`, `memory.submit`, and (approval-gated,
  by the `approver` role only) `memory.approve` / `memory.reject` / `memory.deprecate`.
- **Element state transitions** — `element.set_state(<state>)`, e.g. `element.set_state(active)`
  (release-line: `planning → active`), `element.set_state(in-progress)` (task: `backlog → in-progress`).
- **Element cross-sync** — `bug.sync_state(where: { id: task.bug })`, recomputing a linked element's
  state from the aggregate of its derived tasks.
- **Git operations** (P4.10) — `git.create_branch("{task.id}")`, `git.merge(to: main)`.
- **Agent operations** — `agent.execute`, `agent.verify_specs`.
- **Test operations** — `tests.bdd.run`.

Arguments use the `key: value` form and may interpolate `{element.field}` / `{<type>.field}` from the
active element or enclosing iteration scope.

#### Check expressions (`checks.pre` / `checks.post`)

Free-form assertion strings, evaluated to a boolean gate. Observed forms:

- Test/coverage gates — `tests.exist`, `tests.failing`, `tests.passing`, `tests.coverage(min: 80)`,
  `tests.bdd.passing`.
- Frontmatter gates — `frontmatter.required: [title, scope]`.
- Element-state gates — `tech-spec.approved`, `"all releases where release-line={release-line.version} are status: released"`.

#### Worked example (grounded in `release-line-cycle.yaml`)

```yaml
name: release-line-cycle
kind: sub
version: 1.0
element: release-line
phases:
  - name: approve
    role: tech-lead
    actions:
      - element.set_state(active)            # release-line: planning -> active
    approval: { by_role: approver }
    fallback: { step: approve }
  - name: delivery
    include: release-cycle
    iterate_over: release
    where: { release-line: "{release-line.version}", status: [draft, planning, in-development] }
  - name: plan-next-release-line
    role: product-owner
    actions:
      - element.set_state(done)
      - 'memory.add(type: release-line)'
      - memory.submit
    produces:
      - "docs/04_memory/planning/{id}.md"
    checks:
      pre: ["all releases where release-line={release-line.version} are status: released"]
      post: ["frontmatter.required: [title, version]"]
```

And the review gate with state-resetting fallback (grounded in `dev-loop.yaml`):

```yaml
  - name: review
    role: reviewer
    actions:
      - tests.bdd.run
      - memory.submit                        # task: in-progress -> in-review
    checks:
      pre: ["tests.bdd.passing"]
    approval: { by_role: approver }
    fallback: { step: red, set_state: in-progress }   # reject -> back to `red`, task -> in-progress
```

## Consequences

- **Required config change:** rename the manifest key `includes:` → `include:` in
  `docs/self/.wingfoil/workflows.yaml`. Until done, the manifest fails Layer-1 validation (missing
  required `include`). This is the single follow-up file change this spec mandates.
- The workflow engine, `wingfoil workflow list/start/next/status/show` (P4.2–P4.7), and the
  `wingfoil://workflows` MCP resource all consume these two schemas; changing a field name here is a
  breaking change that requires updating every workflow file under `workflows/**` in the same change.
- Every existing workflow file (`sw-life-cycle`, the three ingest mains, and all sub-workflows) must
  validate against Layer 2 as-is; a field this spec omits but a file uses would surface as a validation
  error, and a new DSL field a workflow needs requires revising this spec first (traceability).
- Layer 2 fixes the vocabulary for future authors: phase composition (`include`/`iterate_over`/`where`),
  gates (`checks`/`approval`), and routing (`fallback`) are now named once, not re-invented per file.
- The action/check expression grammars are specified as **enumerated string families**, not a closed
  grammar; adding a new action or check family (e.g. a new `git.*` op) is a documentation change here,
  not a schema change, as long as the surrounding phase shape is unchanged.

## Process Notes

Grounded in the actual repo files: `docs/self/.wingfoil/workflows.yaml` (confirmed the current key is
`includes:`, plural — the rename target), `workflows/custom/release-line-cycle.yaml` and
`workflows/custom/dev-loop.yaml` (every Layer-2 field — `include`, `iterate_over`, `where`, `produces`,
`checks.pre/post`, `approval.by_role`, `fallback.step/set_state`, and the `actions`/checks expression
families — is drawn from these), plus P4.1/P4.16 in `docs/01_vision/06_features.md`.
