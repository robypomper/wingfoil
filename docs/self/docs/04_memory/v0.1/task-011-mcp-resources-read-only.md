---
id: "task-011-mcp-resources-read-only"
type: task
title: "Infrastructure: REQ-INT-01 — MCP Resources read-only"
status: in-review
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

**start.** `backlog → in-progress`. Worktree at
`WingFoil2.worktrees/task-011-mcp-resources-read-only`, branch `task/task-011-mcp-resources-read-only`.

**design (verify_specs).** No spec gap, as expected. The contract was already fully approved:
`spec-004-mcp-surface-contract` §2 (URI scheme §2.1, read shape §2.2, verbatim refusal string §2.3),
`adr-004-mcp-over-stdio` (accepted), `spec-011-storage-layout` (id→path resolution). REQ-INT-01 is the
primary ref; this task is also the read-half of REQ-SEC-05. No new tech-spec authored.

**What was built (spec-004 §2 read-only Resources channel).** Six URI forms, all conformant:
- `wingfoil://memory/{type}` — collection listing, **frontmatter only** (id, title, status, tags), no
  body (§2.1). New `src/mcp/memory-resource.ts` `registerMemoryResources`.
- `wingfoil://memory/{type}/{id}` — single document: `mimeType: "text/markdown"`, `text` = full
  frontmatter+body (re-read raw via `storage.readDocument`), plus a **top-level** `metadata` block
  `{ id, type, status, title }` (§2.2 — see the "shape" note below).
- `wingfoil://dna` + `wingfoil://dna/{section}` — new `src/mcp/dna-resource.ts`. `{section}` is any
  top-level `dna.yaml` key (`team`, `paths`, `modules`, …), not a hand-maintained allowlist.
- `wingfoil://workflows` + `wingfoil://workflows/{name}` — new `src/mcp/workflow-resource.ts`.
  Collection is summary-only (name, kind, description), sorted by name (REQ-SYS-07); `{name}` returns
  the full Layer-2 `Workflow` definition (main or sub alike).

Two new **`src/memory/query.ts`** primitives back the Memory Resources — `listMemoryDocumentsByType`
and `findMemoryDocumentByTypeAndId` — reusing task-008's `listMemoryDocumentPaths` scan (NOT a
reimplemented scan). Both filter on each document's **own frontmatter `type:` field**, not directory:
several types' `path` patterns collapse to the same static dir (`release`/`release-line` → `planning`;
`task` collapses all the way to `docs/04_memory`), so a directory-only filter would fold sibling types
into the wrong collection. A dedicated test proves release-line/release don't leak into each other.

**Refusal handling (spec-004 §2.3), structural not gated.** New `src/mcp/read-only.ts` centralizes
the verbatim string `resources are read-only` (`WRITE_REFUSAL_MESSAGE`) and refuses **both**
write-attempt shapes: (1) an unsupported `resources/write` JSON-RPC call — MCP itself defines no such
method, so `registerWriteRefusalHandler` installs a low-level `Server.setRequestHandler` that
*unconditionally throws* (no branch can succeed); (2) a `resources/read` carrying write intent — the
real `ReadResourceRequestSchema` strips unknown `params` keys (`$strip`) but leaves `_meta`
passthrough (`$loose`), so `refuseIfWriteIntent` (called **first**, before any read/scan/file-access,
in every bespoke handler) refuses on a `wingfoil/write-intent` `_meta` sentinel. There is no
`resources/write` capability and no gated write code path anywhere in the channel. Unresolvable URIs
return a **distinct** `resource not found: {identifier}` error (`resourceNotFoundError`), never
colliding with the refusal wording — asserted explicitly.

**Channel-enumeration test (shared with task-016 REQ-SEC-05).** `test/mcp/helpers/channel-enumeration.ts`
(a non-`.test.ts` fixture, so Jest won't pick it up as a suite) provides `connectReadOnlyClient`,
`snapshotFiles`/`assertFilesUnchanged`, and `attemptEveryResourceWrite`. The test snapshots the raw
bytes of every DNA/Memory/Workflow file, fires both write shapes, asserts both are refused with the
exact string, then asserts every file is **byte-for-byte unchanged**. task-016 reuses this helper
rather than duplicating it.

**Replacing task-009's placeholder.** task-009's non-conformant single-segment
`wingfoil://memory/{id}` Resource (`registerMemoryDocumentResource`) is **removed** and replaced by the
two conformant `{type}`/`{type}/{id}` forms. task-009's own `src/memory/query.ts`
`findMemoryDocumentById` primitive is **kept** (still unit-tested, still a valid type-agnostic lookup)
but nothing in `src/mcp` calls it anymore. task-009's REQ-PERF-04 benchmark
(`test/mcp/resource-latency.test.ts`) was **ported, not dropped**: it now hits
`wingfoil://memory/{type}/{id}` (fixture docs gained a `type:` frontmatter field). Re-verified p95 on
the 1,000-document reference repo: `wingfoil://memory/{type}/{id}` p95 ≈ **56 ms** (mean ≈ 35 ms),
`wingfoil://dna/show` p95 ≈ **1.8 ms** — both far under the 1000 ms budget; the 200-fetch
sustained-session no-degradation check still passes.

**task-011 vs task-030 boundary.** task-011 delivers the registrar-level, transport-agnostic channel
exercised end-to-end over the SDK's `InMemoryTransport` + a real `Client` (as task-009 did) — the
structural read-only guarantee, the six conformant URI forms, and their read/refusal/not-found
behaviors, all callable via `registerReadOnlyResources` (`src/mcp/index.ts`). task-030-implement-mcp-resources
(P5.2.1) owns wiring a **production `StdioServerTransport` / `wingfoil mcp` command** around this
registrar, plus any remaining feature richness. No production stdio entry point is wired here.

**Deviations / notes for reviewer.**
- **Bespoke `registerResource`, not the `registerCoreModules` partition.** All six Resources are
  hand-wired `McpServer.registerResource` calls, not derived from `src/core`'s `CORE_MODULES`. No
  `memoryShow`/`memoryList`/`dnaSection`/`workflowShow` `CoreOperation` exists yet, and the current
  `CoreOperation` shape (spec-006 §2: `{name, mutates, fn}`, zero parameter metadata) cannot
  mechanically derive sub-resource addressing (`{type}/{id}`, `{section}`, `{name}`). This is the same
  spec-006 §4 (Parity rule) deviation task-009 already documented — acceptable because these are
  read-only with no CLI/Tool counterpart to keep in parity with; to be reconciled (or re-confirmed as
  permanent) by task-030. The read-only guarantee is still **structural**: every one of these
  Resources is registered *only* via `registerResource`, never as a Tool, and the write-refusal is a
  handler that cannot succeed — no gated write branch exists.
- **`metadata` is a top-level result key, not inside `contents[]`.** spec-004 §2.2 depicts `metadata`
  as a sibling of `uri`/`mimeType`/`text`. The real MCP wire schema fixes each `contents[]` entry to
  `{uri, mimeType, text|blob, _meta?}`, but the top-level `ReadResourceResultSchema` object is
  passthrough (`$loose`), so an extra top-level `metadata` key survives server→wire→client-parse. The
  handler returns it via an assigned (not directly-returned) variable so TS's excess-property check
  doesn't fire. This matches the spec literally; a reviewer wanting `metadata` nested instead would
  need a spec-004 §2.2 revision first.

**refactor.** Extracted the repeated JSON result envelope into `jsonResourceResult` (`read-only.ts`);
the single-document markdown+metadata shape stays bespoke. No behavior change.

**review.** Full suite green — `npx jest` 285 passed / 31 suites; `npx tsc --noEmit` exit 0; eslint
clean on touched dirs. Coverage on new files: `src/mcp/*` 100% stmts/lines; `src/memory/query.ts`
100% stmts/lines.
