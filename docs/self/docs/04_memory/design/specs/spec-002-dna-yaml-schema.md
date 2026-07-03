---
id: spec-002-dna-yaml-schema
type: tech-spec
title: "dna.yaml schema (DnaYaml)"
status: pending
scope: "docs/self/.wingfoil/dna.yaml"
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

`dna.yaml` is the **Project DNA** configuration file (P2.4). It is a structural map of the project —
`project` identity, `modules`, `stacks` (technologies + methodologies), `team` (members / agents /
roles), and `paths` — that lets humans and agents navigate the project without full codebase scans.
WingFoil manages its own development, so the authoritative live instance is
`docs/self/.wingfoil/dna.yaml` (it will move to the repository-root `.wingfoil/dna.yaml` once the tool
can manage it).

Without a single shared schema definition, the CLI and the MCP server would each re-implement parsing
and validation of this file, and they could drift — a divergence forbidden by **REQ-SYS-05** (one
behaviour behind both surfaces). This spec pins the **DnaYaml** Zod schema that validates the file at
load time and is shared verbatim by:

- `wingfoil dna show` / `wingfoil dna set` — display and mutate the DNA map (P2.4).
- `wingfoil paths [category]` — query the `paths` section by category (P2.5).
- MCP Resource `wingfoil://dna` — read-only exposure of the same parsed structure (REQ-SYS-05).
- Any engine resolving role-to-directive bindings — role **names** are consumed from `team.roles`
  (see [Role binding](#role-binding-req-sys-08) below).

The schema is deliberately **project-shape-agnostic**: `stacks` holds flat, generically-shaped lists
rather than fixed per-surface keys, so the same schema fits a CLI tool, a web service, a GUI app, or a
batch job — not only WingFoil's own CLI+MCP shape.

## Specification

`DnaYaml` is the top-level Zod object. The TypeScript type is derived exclusively via
`z.infer<typeof DnaYaml>` — no hand-written duplicate `interface`. Every object node is declared with
`.passthrough()` (forward-compat convention): unknown keys are **preserved, not stripped**, so a file
written by a newer WingFoil version stays loadable by an older client, with validation still
succeeding.

### Top-level fields

| Field      | Type        | Required | Provenance                | Notes                                                          |
|------------|-------------|----------|---------------------------|----------------------------------------------------------------|
| `version`  | `number`    | yes      | [AUTHORING]               | Config-file format version (e.g. `1.1`). `z.number().positive()`. |
| `project`  | `Project`   | no       | [AUTHORING]               | Identity/strategy block; `north_star` is its one [SPEC] field. |
| `modules`  | `Module[]`  | yes      | [SPEC: P2.4]              | Ordered list of project modules.                               |
| `stacks`   | `Stacks`    | yes      | [SPEC: P2.4]              | Technologies + methodologies, as flat generic lists (see below). |
| `team`     | `Team`      | yes      | [SPEC: P2.4 / REQ-SYS-08] | Members, agents, and the canonical role catalogue.             |
| `paths`    | `Paths`     | yes      | [SPEC: P2.5]              | Resource path categories queried by `wingfoil paths`.          |

`conventions` is **not** a top-level field of `DnaYaml` — the "how we work" rules it used to hold now
live in `.wingfoil/directives/custom/` (see [Consequences](#consequences) for the value-by-value
mapping).

### Zod definition

```typescript
import { z } from "zod";

const Project = z.object({
  name:        z.string().optional(),
  description: z.string().optional(),
  license:     z.string().optional(),
  repository:  z.string().optional(),
  methodology: z.string().optional(),
  north_star:  z.string().optional(),   // [SPEC] Product Brief North Star / REQ-SYS-07
}).passthrough();

const Module = z.object({
  name:        z.string(),              // [SPEC: P2.4]
  description: z.string().optional(),   // [AUTHORING]
  path:        z.string().optional(),   // [AUTHORING]
}).passthrough();

// A technology in use. `category` is a FREE STRING, not a fixed enum — e.g. language, runtime,
// framework, library, testing, protocol, sdk, storage, distribution, versioning, and (for other
// project shapes) database, ui_toolkit, ci_cd, … This is what keeps the schema flexible across
// project shapes. [SPEC: P2.4] values ← Product Brief §Technical Stack; list/entry shape [AUTHORING].
const TechEntry = z.object({
  name:     z.string(),
  category: z.string(),
  version:  z.string().optional(),
  notes:    z.string().optional(),
}).passthrough();

// A practice/methodology in use. `phase` is a free string naming the workflow phase it is scoped to
// (e.g. inception, specification, delivery) when applicable; omitted when project-wide. [AUTHORING].
const MethodologyEntry = z.object({
  name:  z.string(),
  phase: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

// stacks replaces the old fixed-key tech_stack (cli/mcp/testing sub-objects). Both lists are
// optional so a minimal project may declare technologies without methodologies (or vice versa).
const Stacks = z.object({
  technologies:  z.array(TechEntry).optional(),        // [SPEC: P2.4] (values) / [AUTHORING] (shape)
  methodologies: z.array(MethodologyEntry).optional(), // [AUTHORING]
}).passthrough();

const TeamMember = z.object({
  name:  z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),           // role names → validated against team.roles[].name
}).passthrough();

const AgentEntry = z.object({
  name:               z.string(),
  executes_as:        z.array(z.string()),
  approval_authority: z.boolean().optional(),  // always false — agents never approve (REQ-SYS-08)
}).passthrough();

const RoleEntry = z.object({
  name:        z.string(),              // [SPEC: REQ-SYS-08] canonical role name
  description: z.string().optional(),   // [AUTHORING]
}).passthrough();

const Team = z.object({
  members: z.array(TeamMember),         // [SPEC: P2.4]
  agents:  z.array(AgentEntry).optional(),  // [AUTHORING] agent execution model
  roles:   z.array(RoleEntry),          // [SPEC: REQ-SYS-08] canonical role catalogue
}).passthrough();

// paths: category name → list of path strings. Fixed category names per P2.5 / X_cli-cmds.md,
// but tolerant of extra categories via passthrough.
const Paths = z.object({
  sources:    z.array(z.string()).optional(),
  tests:      z.array(z.string()).optional(),
  docs:       z.array(z.string()).optional(),
  config:     z.array(z.string()).optional(),
  governance: z.array(z.string()).optional(),
}).passthrough();

export const DnaYaml = z.object({
  version: z.number().positive(),
  project: Project.optional(),
  modules: z.array(Module),
  stacks:  Stacks,
  team:    Team,
  paths:   Paths,
}).passthrough();

export type DnaYaml = z.infer<typeof DnaYaml>;
```

### `stacks` — why a generic list

The old `tech_stack` object used fixed keys (`cli: { framework, formatting }`, `mcp: { protocol,
transport, sdk }`, `testing: { framework, coverage_target }`, …). That shape only fits a TypeScript
CLI+MCP project. `stacks` instead holds two flat lists whose entries are generically shaped:

- `stacks.technologies` — `{ name, category, version?, notes? }`. `category` is a free string, so a
  web service can declare `database` / `http_framework`, a GUI app `ui_toolkit`, etc., without any
  schema change.
- `stacks.methodologies` — `{ name, phase?, notes? }`. Lets agents discover which practices apply and,
  via `phase`, when. Representative values on this project: Lean Inception (inception), User Story
  Mapping / Specification by Example (BDD) / SARD (specification), TDD (delivery).

Beyond navigation, `stacks` is what lets an engine select which directive content (`testing`,
`code-quality`, `architecture`, …) is relevant for a given technology or methodology.

### Role binding (REQ-SYS-08)

`team.roles` is the **canonical role catalogue**: each entry is `{ name, description? }`, and it
enumerates every role the project recognises (`developer, reviewer, qa, architect, product-owner,
tech-lead, facilitator, approver`). Role names referenced elsewhere — `team.members[].roles`,
`team.agents[].executes_as`, and the bindings in `.wingfoil/roles.yaml` and workflow/directive
definitions — are **referenced by name** and semantically validated against this list. This keeps a
single source of truth for "what roles exist" (BDD `P4.20` — role not defined in `dna.yaml`). Agents
execute under a role but never hold approval authority; `agents[].approval_authority`, when present,
is always `false`.

`team.roles` is **not** delegated to `.wingfoil/roles.yaml`: that file *binds directives to roles*
(P3.2/P3.7) — it is keyed by role name but does not define the role set. It omits `facilitator` and
`approver` (which carry no directive bindings) and carries no per-role `description`, so it cannot
serve as the catalogue. `dna.yaml` therefore remains the authoritative role registry.

### Categories (P2.5)

`wingfoil paths [category]` queries `paths` by the five category names **sources, tests, docs, config,
governance** (X_cli-cmds.md). Each maps to an ordered `string[]`; missing categories are permitted,
and `.passthrough()` allows a future category to be added without invalidating existing files.

### Minimal valid instance

```yaml
version: 1.1
modules:
  - name: core
    path: src/core
stacks:
  technologies:
    - name: TypeScript
      category: language
    - name: Node.js
      category: runtime
      version: "18+"
team:
  members:
    - name: Roberto Pompermaier
      email: robypomper@gmail.com
      roles: [ developer, approver ]
  roles:
    - name: developer
    - name: approver
paths:
  sources: [ src/ ]
  tests: [ test/ ]
  docs: [ docs/ ]
  config: [ package.json ]
  governance: [ docs/self/.wingfoil/ ]
```

## Consequences

- **Load-time contract.** Every `wingfoil` invocation validates `dna.yaml` against `DnaYaml` before
  running; a schema failure is fatal (the command aborts). CLI and MCP share this exact schema
  (REQ-SYS-05), so neither surface can accept a file the other rejects.
- **`stacks` replaces `tech_stack`.** The fixed-key `cli`/`mcp`/`testing` sub-objects are gone; the
  same facts are now list entries. Every former `tech_stack` value survives as a
  `stacks.technologies` entry — `language: TypeScript` → `{ name: TypeScript, category: language }`,
  `mcp.transport: stdio` → folded into the Model Context Protocol entry's `notes`, `testing.coverage_target: ">80%"`
  → the Jest entry's `notes`, `versioning: semantic versioning` → `{ name: semantic versioning,
  category: versioning }`, and so on. Any consumer that read `tech_stack.<key>` must now scan
  `stacks.technologies` by `name`/`category`.
- **`conventions` removed; every value relocated (nothing lost).** The former `conventions:` section
  is gone from `dna.yaml`; its rules now live where they are actually enforced:

  | Former `conventions` value                        | New home                                                     |
  |---------------------------------------------------|--------------------------------------------------------------|
  | `documentation.versioning`                        | `directives/custom/doc-versioning.md` (already stated it)    |
  | `documentation.traceability`                      | `directives/custom/traceability.md` (already stated it)      |
  | `engineering.methodology` (TDD / test-first)      | `directives/custom/testing.md` (already stated it)           |
  | `engineering.coverage` (`>80% (Jest)`)            | `directives/custom/testing.md` (already stated it)           |
  | `engineering.versioning` (semantic versioning)    | `stacks.technologies` — the `semantic versioning` entry      |
  | `process.determinism`                             | `directives/custom/determinism.md` (already stated it)       |
  | `process.commits` (conventional commits; state change = git commit w/ author + timestamp) | `directives/custom/code-quality.md` — **new bullet added**   |
  | `process.release_cadence` (~1 release/week, one pillar per release) | `directives/custom/traceability.md` — **new bullet added**, tied to task→release assignment |

  The first six were already covered by an existing directive (or, for semantic versioning, by the
  `stacks` list) and were simply dropped. The last two were not captured anywhere, so they were
  **added** to the directive files noted above rather than lost.
- **`team.roles` stays load-bearing.** It is the canonical role registry (REQ-SYS-08 / BDD P4.20);
  removing it would break role-name validation. `roles.yaml` binds directives to roles but does not
  define the role set, so it is not a substitute.
- **Forward-compatible.** Because every node is `.passthrough()`, additive fields do not break older
  clients — schema evolution can proceed without a hard version bump, provided existing required
  fields are preserved.
- Depends on this staying stable: `wingfoil dna show/set`, `wingfoil paths`, the `wingfoil://dna` MCP
  Resource, and any role-binding resolution.
