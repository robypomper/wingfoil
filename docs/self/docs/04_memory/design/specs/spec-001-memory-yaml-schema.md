---
id: spec-001-memory-yaml-schema
type: tech-spec
title: "memory.yaml schema (MemoryYaml): sequence/gates/waiting state machines"
status: pending
scope: "docs/self/.wingfoil/memory.yaml"
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`memory.yaml` is the **Project Memory type registry** (feature **P1.13**). It declares every Memory
element type — `release-line, release, task, adr, decision-log, tech-spec, bug` — giving each a path
pattern, an id pattern, human metadata, a template scaffold, and a state machine. It is consumed by
every `wingfoil memory *` command (add/submit/approve/reject/deprecate/show/search/history), by the
Workflow pillar (to resolve `element:` type declarations), by the ID-generation engine (reads
`id_pattern` + `path`), and by the state-machine validator that enforces **REQ-STATE-01** (every
transition validated against the type's declared machine).

The file exists today (authoritative under `docs/self/.wingfoil/memory.yaml`), but it declares each
type's lifecycle with a **`transitions: {state: [target, ...]}` dict-of-arrays**. That shape is
**structurally ambiguous**: when a state lists two legal targets (e.g. the current default machine's
`pending: [ approved, rejected ]`, or the current `task`'s `in-review: [ approved, in-progress ]`),
nothing in the schema says which target is the `approve` outcome and which is the `reject` outcome.
Today that disambiguation is delegated out to Workflow-step declarations, so the same lifecycle cannot
be validated from `memory.yaml` alone — and two agents can read the same graph and drive `reject` to
different states. This spec fixes the ambiguity **inside the schema** by replacing `transitions` with a
`sequence` / `gates` / `waiting` triple. Every type/path/id_pattern below is unchanged from the current
file; **only the state-machine encoding changes.**

## Specification

### Top-level shape

```yaml
version: 1.0            # config-file format version — a positive NUMBER (float ok), not a string
defaults:              # optional; applies to any type without its own `states` block (REQ-STATE-08)
  states: <StateMachine>
types:                 # required; one entry per Memory element type
  <type-name>: <MemoryTypeEntry>
```

TypeScript / Zod (all objects `.passthrough()` — unknown fields preserved, not fatal, so a newer
file stays readable by an older client):

```ts
const MemoryYaml = z.object({
  version:  z.number().positive(),                 // NOT .int() — 1.0 is written as a float
  defaults: z.object({ states: StateMachine }).optional(),
  types:    z.record(z.string(), MemoryTypeEntry),
}).passthrough();
```

`version` MUST be `z.number().positive()`, **not** `z.number().int()`: the file's `version: 1.0` is a
YAML float and `.int()` would spuriously reject a future `1.1`.

### Sub-schema: `StateMachine` — the sequence/gates/waiting format (REPLACES `transitions`)

A type's lifecycle is an **ordered chain** plus two optional annotations — never a free-form graph:

```ts
const StateMachine = z.object({
  sequence: z.array(z.string()).min(1),                          // ordered chain of states
  gates:    z.record(z.string(), z.object({ reject: z.string() })).optional(),
  waiting:  z.array(z.string()).optional(),
}).passthrough();
```

| Field      | Meaning |
|------------|---------|
| `sequence` | The ordered list of states. `sequence[0]` is the state `memory.add` assigns (this replaces the old explicit `initial:` field — the first element *is* the initial state). Each consecutive pair `sequence[i] → sequence[i+1]` is the type's forward edge. |
| `gates`    | `{ <state>: { reject: <target> } }`. Listing a state here means its forward edge is an **approval gate**: the forward move (to the next state in `sequence`) fires only via `wingfoil memory approve`, and `reject` names the explicit target of `wingfoil memory reject`. |
| `waiting`  | States whose forward edge has **no CLI verb at all** — it fires only as a side effect of a Workflow step's `element.set_state(...)` action or an engine trigger (e.g. another element's `supersedes:` field). `submit`/`approve` on a `waiting` state is illegal. |

**Which verb drives each forward edge — fully determined by the schema:**

- state **not** in `gates` and **not** in `waiting` → forward edge fires via `wingfoil memory submit`
  (single legal target: next in `sequence`).
- state in `gates` → forward edge fires via `wingfoil memory approve` (target: next in `sequence`,
  **never written out** — by construction there is exactly one); `reject` target fires via
  `wingfoil memory reject` (**always written explicitly**). When a `gates.<state>.reject` edge fires,
  the document's `rejection_reason` frontmatter field is also set to the `--reason` text (cleared again
  on the next `memory.submit`) — the field itself is defined in `spec-010-memory-frontmatter-schema`
  ("Base fields"); this spec only owns which state the transition lands on.
- state in `waiting` → forward edge has no verb; advanced only by a Workflow action / engine trigger.
- a state MAY be **both** in `waiting` and a key in `gates`: its forward edge is verb-less (picked up
  automatically) while it still exposes a manual `reject`/decline path.

This is why the ambiguity of the old format cannot arise: `approve`'s target is structurally fixed
(next in `sequence`), and `reject`'s target is always spelled out in `gates.<state>.reject`.

**`deprecated` is implicit.** It is a built-in wildcard edge from *any* state to a reserved
`deprecated` state, always legal, invoked via `wingfoil memory deprecate`. It is **never** declared in
`sequence`/`gates`/`waiting`; the literal string `"deprecated"` is reserved and may not appear as a
state name or a `reject` target.

**Semantic validation (post-parse):** every key in `gates` and every entry in `waiting` MUST be a
member of `sequence`. A `gates.<state>.reject` target need **not** be a member of `sequence`: it may
revert into the chain (e.g. `pending: { reject: draft }`) or name an off-chain decline state reached by
no forward edge (e.g. `bug`'s `open: { reject: closed }`). The only universal constraint on any state
name anywhere is that none may be `"deprecated"`. Errors: `E_INVALID_MEMORY_SCHEMA` (Zod shape),
`E_INVALID_STATE_GRAPH` (gate/waiting not in sequence, or `"deprecated"` declared explicitly).

### Sub-schema: `MemoryTypeEntry`

```ts
const MemoryTypeEntry = z.object({
  path:        z.string(),                       // required — document path pattern, contains {id}
  id_pattern:  z.string().optional(),            // ID template; absence ⇒ --id mandatory on add
  name:        z.string().optional(),
  description: z.string().optional(),
  tags:        z.array(z.string()).optional(),
  template:    TemplateConfig.optional(),
  states:      StateMachine.optional(),          // absent ⇒ defaults.states applies (REQ-STATE-08)
}).passthrough();

const TemplateConfig = z.object({
  frontmatter: z.object({ required: z.array(z.string()) }),  // fields enforced on submit (P4.12)
  file:        z.string(),                                   // scaffold path, relative to config root
}).passthrough();
```

`path` MAY contain named placeholders **besides** `{id}` (e.g. `task`'s `{release}`,
`release`'s `{release-line}`). Those are resolved by the Workflow pillar from the active
`element:` chain **before** the ID engine runs; the ID engine only ever substitutes `{id}` → `*`.

### `id_pattern` placeholder notation

An `id_pattern` is a string template: literal characters (which must respect the ID charset
`[a-z0-9\-.]`) plus placeholders expanded by the ID-generation engine.

| Placeholder | Expansion | Source |
|-------------|-----------|--------|
| `{n}`       | Next available integer, no padding (e.g. `12`) | counter algorithm (below) |
| `{n:N}`     | Next available integer, zero-padded to a **minimum** of N digits (`{n:3}` → `001`; overflow past N digits uses natural width) | counter algorithm (below) |
| `{slug}`    | Normalized kebab-case slug from `--slug` or `--title` | user input |
| `{version}` | The release-line / release version string (e.g. `v1`, `v0.1`) supplied by the workflow or `--version` — used by `release-line` (`rl-{version}`) and `release` (`minor-{version}`) | workflow / user input |
| `{date}`    | Current date `YYYYMMDD` (UTC) | system clock |
| `{author}`  | Slug-normalized git `user.name` | git identity |

Expansion order is fixed — `{date}` → `{author}` → `{version}` → `{slug}` → `{n}` — so the `{n}`
counter regexp always sees a fully-materialized prefix.

**Counter algorithm (no central ID registry — the filesystem is the source of truth, consistent with
"state deduced from Memory", REQ-STATE-01/REQ-STATE-02):**

1. Build a glob from the type's `path` by replacing `{id}` with `*` (all other `path` placeholders are
   already literal values by this point).
2. Scan matching files from the config root.
3. Extract the `{id}` substring from each match.
4. Apply a regexp derived from `id_pattern`, capturing the numeric group at the `{n}` / `{n:N}`
   position (e.g. `task-{n}-{slug}` → `^task-(\d+)-.+$`).
5. `next_n = max(captured) + 1`, defaulting to `1` when no file matches or no numeric group is found.

### Worked examples — every current type in the new format

The `defaults` machine and the seven types below reproduce **exactly** the legal transition set of the
current `memory.yaml`; only the encoding changes (except the deliberate default-machine collapse called
out in Consequences).

```yaml
# DEFAULT machine — was: draft→pending, pending→{approved,rejected}, rejected→draft
defaults:
  states:
    sequence: [ draft, pending, approved ]
    gates:
      pending: { reject: draft }        # reject sends straight back to draft (see Consequences)

types:
  release-line:
    path: "docs/04_memory/planning/{id}.md"
    id_pattern: "rl-{version}"
    states:
      sequence: [ draft, planning, active, done ]
      gates:
        planning: { reject: draft }     # approve: planning→active · reject: →draft
      waiting: [ active ]               # active→done: fires when every release under it is `released`

  release:
    path: "docs/04_memory/planning/{release-line}/{id}.md"
    id_pattern: "minor-{version}"
    states:
      sequence: [ draft, planning, in-development, releasing, released ]
      # draft→planning: memory.submit; the rest are workflow-phase transitions (no CLI verb)
      waiting: [ planning, in-development, releasing ]

  task:
    path: "docs/04_memory/{release}/{id}.md"
    id_pattern: "task-{n}-{slug}"
    states:
      sequence: [ draft, pending, backlog, in-progress, in-review, approved, done ]
      gates:
        pending:   { reject: draft }        # approve: pending→backlog · reject: →draft
        in-review: { reject: in-progress }  # approve: in-review→approved · reject: →in-progress
      waiting: [ backlog, approved ]        # backlog→in-progress (dev-loop starts);
                                            # approved→done (dev-loop finalizes)

  adr:
    path: "docs/04_memory/design/adrs/{id}.md"
    id_pattern: "adr-{n}-{slug}"
    states:
      sequence: [ draft, pending, accepted, superseded ]
      gates:
        pending: { reject: draft }      # approve: pending→accepted · reject: →draft
      waiting: [ accepted ]             # accepted→superseded: triggered by a later ADR's `supersedes:`

  decision-log:
    path: "docs/04_memory/design/dls/{id}.md"
    id_pattern: "dl-{n}-{slug}"
    states:
      sequence: [ draft, in-discussion, ready, in-develop, done ]
      gates:
        in-discussion: { reject: draft }  # approve: in-discussion→ready · reject: →draft
      waiting: [ ready, in-develop ]      # ready→in-develop: release-planning converts the DL into
                                          # task(s); in-develop→done: fires once every derived task
                                          # back-referencing this DL is itself `done`

  tech-spec:
    path: "docs/04_memory/design/specs/{id}.md"
    id_pattern: "spec-{n}-{slug}"
    states:
      sequence: [ draft, pending, approved, superseded ]
      gates:
        pending: { reject: draft }      # approve: pending→approved · reject: →draft
      waiting: [ approved ]             # approved→superseded: triggered by a later spec's `supersedes:`

  bug:
    path: "docs/04_memory/bugs/{id}.md"
    id_pattern: "bug-{n}-{slug}"
    states:
      sequence: [ draft, open, triaged, planned, in-progress, in-review, resolved, closed ]
      gates:
        open:      { reject: closed }        # approve: open→triaged · reject: →closed (wontfix/dup)
        in-review: { reject: in-progress }   # approve: in-review→resolved · reject: reopen →in-progress
        resolved:  { reject: in-progress }   # approve: resolved→closed · reject: reopen →in-progress
      waiting: [ triaged, planned ]          # triaged→planned (release-planning schedules it);
                                             # planned→in-progress (dev-loop starts the fix)
```

Every one of these preserves the current file's legal-transition set. Verification for the two
multi-target cases the old graph left ambiguous: old `task in-review: [ approved, in-progress ]` →
`approve`=approved, `reject`=in-progress; old `bug in-review: [ resolved, in-progress ]` →
`approve`=resolved, `reject`=in-progress; old `bug resolved: [ closed, in-progress ]` →
`approve`=closed, `reject`=in-progress; old `bug open: [ triaged, closed ]` → `approve`=triaged,
`reject`=closed. All now unambiguous by construction.

## Consequences

- **DELIBERATE BEHAVIOR CHANGE — the default machine loses its `rejected` state.** The current default
  is a five-value machine `draft → pending → approved/rejected → deprecated` in which `rejected` is a
  **real, frontmatter-visible status** with its own re-open edge (`rejected → draft`). Migrating it to
  `sequence: [draft, pending, approved]` + `gates: { pending: { reject: draft } }` collapses that:
  `memory.reject` from `pending` now writes `status: draft` **directly**, and **no document ever
  records `status: rejected` again.** This is a genuine change to what appears on disk, not a cosmetic
  rename — REQ-STATE-08's wording (`draft → pending → approved/rejected → deprecated`) describes the
  *old* behavior and must be reconciled. The rejection is **not** lost: its reason lives in the `wf(...): reject ...` git commit
  body (approver identity + reason, per P1.7), just no longer as a status value.
- **`adr` and `tech-spec` drop their `rejected` state the same way.** They currently expose an explicit
  `rejected → draft` re-open loop; the new `gates.pending.reject: draft` preserves the re-open (you land
  back on `draft`, ready to resubmit) while removing the intermediate visible `rejected` status —
  identical trade-off to the default machine.
- **`initial:` is retired.** The old machines carried an explicit `initial:` field; the new format
  derives it as `sequence[0]`, so `memory.add`'s starting state is read from the chain head.
- **State can be validated from `memory.yaml` alone.** `approve`/`reject`/`submit` targets are now
  fully determined by the schema, so the validator no longer needs Workflow-step context to know which
  edge a verb takes. Workflow `fallback.set_state` values must be *consistent with* (not independently
  choose) the type's `gates.<state>.reject`.
- **Consumers that must change with this spec:** the state-machine validator (parses
  `sequence`/`gates`/`waiting` instead of `transitions`), the ID engine (unchanged — still reads
  `path` + `id_pattern`), and `memory.yaml` itself (rewritten to this encoding). Any doc citing the
  old `transitions` shape (REQ-STATE-08, the P1.8 BDD) is downstream of this spec.
- **`decision-log`'s worked example is conditional on `dl-012-decision-log-state-machine`.** Its
  `sequence`/`gates`/`waiting` block above is `dl-012`'s proposed transition table translated into this
  spec's format; it was reconciled against `dl-012` once that decision-log's content confirmed the
  recommendation is to **adopt** the custom lifecycle. If `dl-012` is rejected or its recommendation
  changes before approval, this spec's `decision-log` worked example must be revisited to match.

## Process Notes

Grounded in the current `docs/self/.wingfoil/memory.yaml` (source of every path, id_pattern, and legal
transition here), `docs/02_requirements/03_sard/03_state-context.md` (REQ-STATE-01/-02/-08), and P1.13.
