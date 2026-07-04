---
id: adr-004-mcp-over-stdio
type: adr
title: "MCP over stdio as the agent-facing integration protocol"
status: accepted
sard_ref: "REQ-INT-01, REQ-INT-03, REQ-SYS-05"
supersedes: ""
tmpl_version: 260703
---

## Context

WingFoil needs a way for AI agents to consume project context (DNA, Memory documents, Directives) and
to drive state changes (submit, approve, reject, deprecate) without going through the human-facing CLI
transcript. adr-002 already settled the higher-level architecture question — CLI + MCP over a
microservices/HTTP-service split, so that both interaction surfaces share one in-process core (REQ-SYS-05)
instead of talking to a separately deployed backend. What adr-002 left open is *which protocol* the agent
surface itself should speak.

The realistic options for the agent-facing channel were: (a) a custom REST or GraphQL API exposed over
HTTP, requiring WingFoil to run and secure a network-listening server, define and version its own
resource/schema conventions, and have every agent runtime carry an HTTP client plus bespoke
authentication; or (b) the Model Context Protocol (MCP), an existing open protocol purpose-built for
LLM-agent-to-tool integration, already supported by the Anthropic SDK and increasingly by other agent
runtimes, with a stdio transport that requires no network exposure at all.

Without a decision here, every future feature that touches the agent surface (P5.2.1 Resources, P5.2.2
Prompts, P5.2.3 Tools) would have to re-litigate transport, message shape, and auth from scratch, and the
project would be committing to maintaining a bespoke protocol surface with no ecosystem interoperability.

## Decision

WingFoil's agent-facing integration protocol is the **Model Context Protocol (MCP) over stdio transport**,
implemented via the Anthropic SDK — not a custom REST or GraphQL API. The MCP server (`src/mcp`, per
`dna.yaml` `modules`) exposes exactly three primitive kinds, matching MCP's own vocabulary:

- **Resources** — read-only exposure of DNA entries and Memory documents (REQ-INT-01). Any write attempt
  through this channel is refused with `"resources are read-only"` (REQ-SEC-05); an agent that wants to
  browse context reads Resources and can never corrupt state through that path.
- **Prompts** — role-specific instruction templates that embed the requesting role's currently assigned
  directives at session start (REQ-INT-02), so an agent executing as `developer`/`reviewer`/`qa`/`architect`
  is pre-loaded with its rules without a manual fetch-and-splice step.
- **Tools** — the only channel through which agents mutate state (`memory.submit`, `memory.approve`, etc.),
  validated against the same state-machine and role-authority checks the CLI enforces, and producing the
  same kind of attributable git commit (REQ-INT-03).

This gives WingFoil `tech_stack.mcp` (per `dna.yaml`): `protocol: Model Context Protocol`,
`transport: stdio`, `sdk: Anthropic SDK`. The stdio transport is a deliberate part of the decision, not an
implementation detail: it means the MCP server is a local subprocess spawned per agent session, with no
network socket to bind, expose, or authenticate — every mutation still flows through the shared `core`
module (REQ-SYS-05), so CLI and MCP enforce identical validation by construction rather than by
convention.

## Consequences

- **Positive**
  - Interoperability: any MCP-compatible agent runtime (not just a WingFoil-specific client) can consume
    WingFoil's Resources/Prompts/Tools with no bespoke integration code.
  - No network attack surface: stdio transport means there is no listening port to secure, rate-limit, or
    expose accidentally — the read/write split (REQ-INT-01, REQ-SEC-05) is enforced in-process, not by a
    perimeter.
  - Read/write separation is structural: because Resources and Tools are distinct MCP primitive kinds, the
    "agents can read but never mutate through the read channel" guarantee (REQ-SEC-05) is a protocol-level
    property, not something that has to be independently re-verified per endpoint the way it would on a
    single REST surface.
  - Reuses an existing, evolving spec (MCP) and its official SDK instead of inventing and maintaining a
    parallel API contract, schema versioning scheme, and client library.

- **Negative**
  - Couples the agent interface to the Anthropic SDK and the MCP specification's own pace of change and
    stability guarantees; a breaking MCP spec revision requires a coordinated WingFoil update.
  - stdio transport is inherently single-session/local-process: it does not by itself support remote or
    multi-tenant agent access the way an HTTP API would, so any future need for a networked agent
    integration would require an additional transport, not a drop-in swap.
  - Debugging/observability tooling for MCP-over-stdio is less mature than the mainstream HTTP
    tooling (curl, Postman, browser devtools) that a REST/GraphQL API would have offered.

- **Neutral**
  - The CLI surface is unaffected: humans keep using `wingfoil` commands; MCP is additive for the agent
    surface only, per adr-002's CLI + MCP split.
  - Resources/Prompts/Tools map cleanly onto WingFoil's existing pillar shape (DNA + Memory as Resources,
    Directives-by-role as Prompts, memory operations as Tools), so no new conceptual model is introduced
    beyond adopting MCP's three primitive kinds.

## Process Notes

Grounded in `docs/02_requirements/03_sard/04_integrations.md` (REQ-INT-01, REQ-INT-02, REQ-INT-03),
`docs/02_requirements/03_sard/05_security-compliance.md` (REQ-SEC-05), and the `tech_stack.mcp` /
`modules` sections of `docs/self/.wingfoil/dna.yaml`; no prior-art source material was available, so the
document was authored directly from these ground-truth files and the ADR brief.
