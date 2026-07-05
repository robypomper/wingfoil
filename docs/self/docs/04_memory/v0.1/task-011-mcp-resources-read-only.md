---
id: "task-011-mcp-resources-read-only"
type: task
title: "Infrastructure: REQ-INT-01 — MCP Resources read-only"
status: in-progress
release: "v0.1"
priority: "Blocker"
tags: ["v0.1", "architecture"]
ref: "REQ-INT-01"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

Implement the MCP server's Resources channel (`src/mcp`) as strictly read-only. The server exposes
DNA entries and Memory documents as Resources under the `wingfoil://` URI scheme
(`wingfoil://dna`, `wingfoil://dna/{section}`, `wingfoil://memory/{type}`,
`wingfoil://memory/{type}/{id}`, `wingfoil://workflows`, `wingfoil://workflows/{name}`), so agents
can browse project context without any path back to mutating it. Concretely: the Resources channel
implements **no** `resources/write` capability at all — there is no code path, gated or otherwise,
that can persist a change through this channel. Mutations remain the exclusive responsibility of the
MCP Tools channel (memory.* / workflow.* actions), which is a separate, distinct primitive kind. As
Casey (the AI-agent-integrating developer persona), I want to browse DNA and Memory context over MCP
so that my agent has full project awareness with zero risk of silently corrupting project state
through the very channel it uses to read that state.

## Acceptance Criteria

Per REQ-INT-01's fit criterion: "A write attempt through the MCP Resources interface is refused with
`\"resources are read-only\"`; a read of an existing resource returns content + metadata."

Testable breakdown:
- A `resources/read` request against a resolvable URI (e.g. `wingfoil://memory/task/task-042-foo`)
  returns `{ uri, mimeType: "text/markdown", text: <full frontmatter + body>, metadata: { id, type,
  status, title } }`.
- Listing a collection (`wingfoil://memory/{type}`, no `{id}`) returns each element's frontmatter
  only (id, title, status, tags) — not full body — per spec-004 §2.1.
- Any client attempt to write through the Resources channel — an unsupported `resources/write` call,
  or a `resources/read` request carrying a write intent/payload — is refused with the exact string
  `resources are read-only`.
- After a refused write attempt, the underlying Memory/DNA/Workflow files are byte-for-byte
  unchanged (asserted by the channel-enumeration test shared with REQ-SEC-05).
- An unresolvable URI (unknown type, unknown id, malformed scheme) returns a standard MCP
  "resource not found" error — distinct from the write-refusal case above.
- See BDD `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.1-mcp-resources.feature`.

## Implementation Notes

- Full contract: `docs/self/docs/04_memory/design/specs/spec-004-mcp-surface-contract.md` §2
  (Resources) — URI scheme (§2.1), read contract shape (§2.2), and the verbatim write-refusal
  string (§2.3). This spec explicitly scopes the v0.1 "read-only skeleton" milestone to §2 only;
  §3 (Prompts, REQ-INT-02) and §4 (Tools, REQ-INT-03) land in later releases (v0.2/v0.4).
- Architectural backing: `docs/self/docs/04_memory/design/adrs/adr-004-mcp-over-stdio.md` — MCP
  over stdio (Anthropic SDK) as the agent-facing protocol; Resources/Prompts/Tools as MCP's own
  three primitive kinds, with the read/write split enforced structurally (distinct primitive kinds,
  not a convention re-checked per endpoint).
- Storage/URI resolution: `{type}` maps to a `memory.yaml` `types:` key; `{id} → path` resolves via
  that type's `path` pattern (per `spec-011-storage-layout`) — the server never takes a raw
  filesystem path from the client.
- This task is the read-channel half of REQ-SEC-05 (task-016-read-only-agent-channel); both tasks
  share the channel-enumeration test fixture rather than duplicating it.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
