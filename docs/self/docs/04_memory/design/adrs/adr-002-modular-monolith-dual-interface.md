---
id: adr-002-modular-monolith-dual-interface
type: adr
title: "Modular monolith with a shared core, decoupled pillar configs, and dual CLI/MCP interfaces"
status: accepted
sard_ref: REQ-SYS-05, REQ-SYS-02
supersedes: ""
tmpl_version: 260703   # Orignal template version
---

## Context

WingFoil must serve two very different callers against the same project state: human operators working
from a terminal, and AI agents that need structured, machine-readable access with deterministic
behavior. Building the CLI and an agent-facing surface as separate implementations would let their
behavior diverge over time — the same operation could validate differently, or be available on one
surface and not the other — which directly undermines the Determinism Index (the product's North Star).

At the same time, the four pillars — Memory, DNA, Directives, Workflow — are conceptually distinct
concerns with independent schemas and lifecycles (`.wingfoil/memory.yaml`, `.wingfoil/dna.yaml`,
`.wingfoil/directives/`, `.wingfoil/workflows.yaml`). If they were collapsed into one monolithic config
blob, a change to one pillar (e.g. adding a new Memory element type) would risk forcing edits to,
or re-validation of, unrelated pillars (e.g. Directives), and would make each pillar harder to reason
about, test, and evolve in isolation.

Two structural alternatives were considered and rejected:
- **Microservices / client-server**, with the CLI and an agent-facing service as independent processes
  talking to a backend over a network API. This adds infrastructure to operate and deploy, which
  conflicts with WingFoil's zero-infra, git-backed design (REQ-SYS-01) and is disproportionate for an
  npm-distributed CLI tool (REQ-SYS-09).
- **A single monolithic config file** for all four pillars, which would be simpler to load but would
  couple unrelated schemas together and make independent evolution and isolated validation of each
  pillar impossible.

Without a deliberate decision here, the natural failure mode is CLI/MCP behavioral drift plus a config
model that becomes harder to validate and extend pillar-by-pillar as the project grows.

## Decision

WingFoil is structured as a **modular monolith**, not a client-server or microservices system:

- A single shared **core** holds all domain logic (Memory, DNA, Directives, Workflow pillars, plus
  storage). The **CLI** (Commander.js + chalk, for humans) and the **MCP server** (Model Context
  Protocol over stdio, Anthropic SDK, for agents) are two thin interface layers on top of that same
  core — one process, one behavior, two surfaces. Every state-mutating operation reachable from the CLI
  is reachable via an MCP Tool and vice versa (REQ-SYS-05).
- The four pillars are kept as **decoupled, independently loadable config artifacts** rather than one
  combined config blob: `.wingfoil/memory.yaml`, `.wingfoil/dna.yaml`, `.wingfoil/directives/`, and
  `.wingfoil/workflows.yaml` each has its own schema and validates in isolation; editing one does not
  require touching, or re-validating, the others (REQ-SYS-02). This is mirrored in the planned module
  layout under `src/`: `core`, `storage`, `memory`, `dna`, `directives`, `workflow`, `cli`, `mcp-server`
  (per `docs/self/.wingfoil/dna.yaml`), where `memory`, `dna`, `directives`, and `workflow` are separate
  modules loaded by the shared `core`, and `cli` / `mcp-server` are the two interface modules on top of it.

## Consequences

- **Positive:**
  - Guaranteed feature parity between humans and agents — no operation can exist on one surface and be
    missing (or behave differently) on the other, which is directly testable via an automated
    CLI/MCP parity check (REQ-SYS-05's fit criterion).
  - One place to fix or extend behavior (the core), instead of two behavioral implementations to keep
    in sync.
  - Each pillar's config can be changed, schema-validated, and reasoned about independently, lowering
    the blast radius of any single pillar's evolution (REQ-SYS-02).
  - No extra infrastructure to deploy or operate — consistent with git-backed, zero-infra storage
    (REQ-SYS-01) and npm distribution as a single CLI package (REQ-SYS-09).
- **Negative:**
  - Two interface layers (CLI and MCP server) still need to be built and tested on top of the core,
    even though they share behavior — this is not free, just centralized.
  - The modular-monolith boundary between `core` and the pillar modules (`memory`, `dna`, `directives`,
    `workflow`) must be actively maintained as code grows; nothing prevents accidental coupling except
    discipline and code review (the `code-review`/`architecture` directives).
  - Decoupled pillar artifacts mean cross-pillar consistency (e.g. a role referenced in `directives/`
    must exist in `dna.yaml`) is a runtime/validation concern rather than something a single schema can
    enforce structurally.
- **Neutral:**
  - MCP Resources remain read-only; all mutations flow through validated MCP Tools (and their CLI
    counterparts) — a consequence of the shared-core design, not a separate decision (see the
    `security` directive / REQ-SEC-05).
  - This decision governs *structure*, not *distribution*: it does not by itself decide packaging
    granularity (still a single npm package per REQ-SYS-09), only how responsibilities are divided
    inside that package.

## Process Notes

Grounded in `docs/02_requirements/03_sard/01_architecture.md` (REQ-SYS-05, REQ-SYS-02) and the
`modules:` list in `docs/self/.wingfoil/dna.yaml`. The Decision/Consequences for the CLI/MCP half
cover REQ-SYS-02 (decoupled pillar configs) and reframe the whole thing as a modular-monolith
structural decision, and this document is filed as `adr-002` at `status: pending` per this
repository's current ADR numbering and workflow.
