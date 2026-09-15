---
id: "dl-026-repo-versioned-mcp-server-config"
type: decision-log
title: "Version an .mcp.json in the repository so agents consume WingFoil's own MCP server (dogfood P5.2)"
status: ready
context: "process"
release: ""
tmpl_version: 260703
---

## Context

`minor-v0.1` shipped the MCP entry point (`task-030-implement-mcp-resources`, `spec-014`, feature
**P5.2.1**): `src/mcp/server.ts` constructs a real `McpServer` and connects it over
`StdioServerTransport`, `src/cli/mcp-command.ts` exposes it as `wingfoil mcp`, and the read-only
**Resources** channel (`spec-004` §2 — DNA, Memory, Workflow) is registered on it. Prompts (**P5.2.2**)
are in `v0.2` scope (`task-039`, `task-058`); Tools (**P5.2.3**) land in `v0.4`.

That server is registered **nowhere**. The repository has no `.mcp.json`, and the project's entry in the
user-level agent configuration carries an empty `mcpServers` map. Consequently no agent working on
WingFoil has ever reached WingFoil's DNA, Memory, or Workflow through the Interaction Layer: every
session reads those files directly from disk, which is precisely the access path P5.2 exists to replace.

The project therefore dogfoods four pillars and stops short of the fifth — while `v0.2` is actively
building more of it.

## Decision

Version a `.mcp.json` at the repository root registering
`wingfoil` → `node dist/cli.js mcp`, so any agent session opened in a clone gets the read-only channel
with no per-developer setup.

Two details must be settled as part of ratification:

1. **Build prerequisite.** `dist/` is git-ignored, so a fresh clone has no server until `npm run build`.
   Options: (a) document build-first and let the registration fail loudly until then; (b) an `npm run
   prepare` hook that builds on install; (c) a dev entry running from `src/` via `ts-node`/`tsx` — which
   adds a runtime dependency and pushes against `dl-010-minimal-dependencies`.
2. **Re-verification as the channel set grows.** `v0.2`'s P5.2.2 and `v0.4`'s P5.2.3 change what the
   server advertises. The enablement should be re-checked when they land — candidate home: a step inside
   the `e2e-smoke` gate (`dl-023`), which already owns fresh-init + CLI end-to-end verification.

## Rationale

- **Dogfooding is the project's own validation strategy.** The Interaction Layer is the pillar most
  exposed to integration risk (an external protocol, an external client), and it is the only one never
  exercised by the team building it. Registering it turns every development session into a smoke test.
- **It closes a determinism question that is otherwise untested.** Two agents — one reading
  `docs/self/.wingfoil/` from disk, one reading the same content through MCP Resources — must build
  equivalent context. Until the server is actually consumed, that equivalence is asserted by unit tests
  over an in-memory transport, never observed end to end.
- **The timing is favourable.** `v0.2` is already touching the server for P5.2.2, so the work lands while
  the code is being handled anyway, rather than as an isolated visit in `v0.4`.
- **Trade-offs considered:**
  - *Vendor coupling.* `.mcp.json` is a Claude Code-specific registration format, while the North Star is
    determinism **across different AI agents**. Versioning one vendor's config file is a mild
    contradiction. Mitigation: the server itself is MCP-standard — only the registration wrapper is
    vendor-shaped — and the contribution docs can state the equivalent registration for other MCP
    clients. This is the main argument against, and should be weighed explicitly at ratification.
  - *Per-developer registration instead* (`claude mcp add …` in each developer's own config) — rejected
    as the default: it leaves dogfooding to individual initiative, is invisible to new contributors
    (`dl-020-contribution-model`), and produces exactly the divergence in agent context that the
    Determinism Index is meant to measure away. It stays valid as an interim, see Actions.
  - *Wait for `v0.4`, when Tools make the server "really useful"* — rejected. The read-only channel is
    already the whole of DNA + Memory + Workflow, which is what an agent needs most; and deferring keeps
    the integration untested through two more releases.

## Actions

- [ ] Ratify this decision, including the vendor-coupling trade-off and option (a)/(b)/(c) for the build
      prerequisite (owner: approver).
- [ ] On `ready`, derive the task(s) at the next `release-planning` → `build-backlog`:
  - [ ] Add the root `.mcp.json` registering `wingfoil` → `node dist/cli.js mcp`.
  - [ ] Implement the chosen build-prerequisite option and document it in `README.md` /
        `COLLABORATION.md` (contributor setup).
  - [ ] Add the re-verification step for P5.2.2 (Prompts, `v0.2`) and P5.2.3 (Tools, `v0.4`), most
        likely inside the `e2e-smoke` gate.
- [ ] **Interim — no task required.** A developer can register the server locally today, after
      `npm run build`, with `claude mcp add wingfoil -- node <repo>/dist/cli.js mcp`. This is
      environment configuration outside the repository and needs no Memory element; it is recorded here
      so the interim path is not mistaken for the decision itself.
