---
id: "task-030-implement-mcp-resources"
type: task
title: "Implement MCP Resources (DNA + Memory) (P5.2.1)"
status: in-review
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "interaction"]
ref: "P5.2.1"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As the agent, I want to efficiently fetch DNA entries and Memory documents read-only via MCP Resources
so that I have pre-loaded project context (US-1-07, feature P5.2.1). This task implements the v0.1
"read-only skeleton" of the MCP server's Resources channel: `wingfoil://dna`, `wingfoil://dna/{section}`,
`wingfoil://memory/{type}`, and `wingfoil://memory/{type}/{id}` URIs, each resolving to the same parsed
DNA/Memory structures the CLI uses (REQ-SYS-05 parity), with no write capability whatsoever — Prompts
(P5.2.2) and Tools (P5.2.3) are explicitly out of scope for v0.1 and land in later releases.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p5-interaction/P5.2.1-mcp-resources.feature`:

- **Fetch a Memory document as an MCP resource**: requesting the resource for a Memory document (e.g.
  `decision-12`) returns its full document content and metadata (id, type, status, title), in under 1
  second.
- **Resources are read-only**: any attempt to write through the Resources interface is refused with the
  exact error `resources are read-only`, and the underlying files are left byte-for-byte unchanged.
- **Error — requesting a non-existent resource**: requesting `decision-999` returns `resource not found:
  decision-999`.

## Implementation Notes

- Implements exactly §1 (transport & channels) and §2 (Resources: URI scheme, read contract, write
  refusal) of `docs/self/docs/04_memory/design/specs/spec-004-mcp-surface-contract.md` — the URI scheme
  (`wingfoil://dna`, `wingfoil://dna/{section}`, `wingfoil://memory/{type}[/{id}]`,
  `wingfoil://workflows[/{name}]`), the exact refusal string `"resources are read-only"`, and the
  collection-listing rule (frontmatter-only for `wingfoil://memory/{type}` with no `{id}`, full content
  for `.../{id}`). §3 (Prompts) and §4 (Tools) of that spec are out of scope for this task — they are
  covered by later tasks (v0.2/v0.4).
- Resolves the same `DnaYaml` structure from `task-027-implement-project-dna` and the same per-type
  Memory `path` patterns from `memory.yaml`; must not re-implement DNA/Memory parsing independently of
  the CLI (REQ-SYS-05 — single behaviour behind both surfaces).
- `.wingfoil/` layout and root-detection algorithm consumed by the server's path resolution follow
  `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`.
- Depends on `task-004-decoupled-pillars`, `task-007-npm-distribution`, `task-009-mcp-resource-fetch-
  latency`, and `task-014-git-identity-required` as prerequisites (per the backlog's TASK-028
  dependency set), plus `task-027-implement-project-dna` for the DNA structure this Resource exposes.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

- **design (spec gap authored):** Neither `spec-004-mcp-surface-contract` (which describes only the
  *channel surface a connected client sees*) nor `spec-008-cli-grammar` §1 (nouns `memory/dna/directive/
  workflow/agent` + flat `init/paths/audit`) nor `X_cli-cmds.md` documented a command that *starts* the
  MCP server or the stdio process entry point. Authored `spec-014-mcp-server-entry-point`
  (`memory.add` → `memory.submit`, `draft → pending`) covering the `wingfoil mcp` flat command, the
  `src/mcp/server.ts` stdio entry point, and the v0.1 read-only-only channel scope. Left at `pending`
  for the orchestrator to bless `pending → approved` under standing authorization — NOT self-approved.
- **scope call (read-only-only):** `createMcpServer` registers ONLY `registerReadOnlyResources`
  (spec-004 §2), NOT `registerCoreModules(CORE_MODULES)`. The latter would advertise the task-025
  `dna.set` **mutating Tool** — Tools are P5.2.3/v0.4 scope, explicitly out of scope for the P5.2.1
  read-only skeleton (spec-004 §Consequences; spec-014 §3). Pinned by `server.test.ts`'s scope
  assertion (`getServerCapabilities().tools` undefined). Prompts (P5.2.2) / Tools (P5.2.3) grow the
  channel set inside `createMcpServer` later; the entry point is unchanged.
- **green (productionization, not reimplementation):** task-011 built + proved the read-only Resources
  CHANNEL (test-only, in-memory transport). This task added the FIRST production `McpServer`:
  `src/mcp/server.ts` `createMcpServer` (testable construction) + `startMcpServer` (the thin
  `StdioServerTransport().connect()` seam), the `wingfoil mcp` special command in `src/cli/program.ts`
  (wired directly like `init`, not a `CORE_MODULES` op), and the injectable `runMcp` handler
  (`src/cli/mcp-command.ts`, mirroring `init-command.ts`'s `runInit`) for the fail-fast root-resolution
  pre-flight (exit 1). Much of AC a/b/c is characterization over task-011's channel — the added value is
  proving it through the real production `McpServer`.
- **AC(c) identifier form (deviation noted):** the BDD's bare `resource not found: decision-999` surfaces
  from task-011's channel as the type-qualified `resource not found: memory/decision-log/decision-999`
  (ids are not unique across types — see `src/mcp/memory-resource.ts`). Not reimplemented (that would
  break task-011's committed tests); the `resource not found:` prefix + the missing id are both verbatim.
- **review:** `tsc --noEmit` exit 0; full suite 464/464 green (49 suites); global coverage
  97.73% stmts / 87.36% branch (≥80% gate met). New code: `mcp-command.ts` 100%, `server.ts`
  `createMcpServer` 100% — only `startMcpServer`'s stdio `.connect()` seam is un-unit-tested (the same
  accepted precedent as `program.ts`/`init-command`'s readline seam), verified instead by a real
  child-process stdio drive (`wingfoil mcp` in a throwaway temp repo: AC a/b/c + read-only scope + the
  exit-1 no-git-root path all confirmed).
