---
id: "dl-093-package-metadata-for-discovery"
type: decision-log
title: "The published package carries no discovery metadata (keywords, description, `mcpName`, `server.json`), and nothing keeps it in sync with the version"
status: in-discussion
context: "retrospective"
release: "v0.2.2"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`) from the project-visibility work it absorbed
(`retrospective-rel-v0.2-plan` §6.7). The approver ruled on 2026-09-28 that package metadata is part of
the v0.2.2 patch, together with removing the unused runtime dependency `@anthropic-ai/sdk`
(`bug-138`), and that it follows the name and namespace decision (`dl-091`) in step 5 of the
implementation order (§6.8).

### What the published package says about itself

Read from `package.json` at `a20b346c`
(`node -p "const p=require('./package.json');[p.description,p.keywords,p.mcpName]"`):

- **`description`** is present and long: the five pillars in one sentence.
- **`keywords`** is `["wingfoil", "ai-assisted-development", "determinism"]`. Nothing a search for an
  MCP server, a spec-driven workflow or an agent harness would match: no `mcp`,
  `model-context-protocol`, `claude`, `cli`, `workflow`, `governance`.
- **`mcpName`** is absent, and there is **no `server.json`** at the repository root (`ls server.json`
  → no such file).
- **Version checks cover the tag only.** `scripts/check-release-tag.cjs` (`checkReleaseTag`) asserts
  that the pushed tag equals `v` + `package.json` `version` (`spec-015` §4). `test/cli/publish-metadata.test.ts`
  pins the attribution fields, `publishConfig` and the `files` allowlist, and none of the fields above.
- **`@anthropic-ai/sdk` is a runtime dependency imported nowhere** (`grep -rn "@anthropic-ai/sdk" src/
  | wc -l` → `0`; `du -sh node_modules/@anthropic-ai` → `10M`). `bug-138` records it.

### What the MCP Registry requires

Read on 2026-09-28 from the registry's documentation (`github.com/modelcontextprotocol/registry`,
`docs/modelcontextprotocol-io/package-types.mdx`, `quickstart.mdx` and `versioning.mdx`):

- a server is described by a `server.json` whose `name` is in the publisher's namespace (`dl-091`);
- for an npm package, the registry verifies ownership by reading **`mcpName` in the published
  `package.json`**, which must equal `server.json` `name`. So the field must ship in a published
  version before the listing can exist: `wingfoil@0.2.1` cannot be listed, and v0.2.2 is the first
  version that can;
- `server.json` carries a `version`, and each `packages[]` entry its own `version`; the version string
  must be unique per publication, and a published version's metadata cannot be changed afterwards.

So `server.json` introduces a second and third copy of the version, and nothing today would notice if
they drifted from `package.json`.

## Decision

v0.2.2 ships discovery metadata, and one check keeps every copy of the version equal.

1. **`keywords`** gains the terms a user searching for this kind of tool types: at least `mcp`,
   `model-context-protocol`, `mcp-server`, `ai-agents`, `cli`, `workflow`, `governance`,
   `spec-driven-development`, `claude-code`. The exact list is fixed in the task.
2. **`description`** is shortened to one line a registry listing can show whole, with the
   distinguishing descriptor `dl-091` Q1 settles.
3. **`mcpName`** is set to the name `dl-091` Q2 settles (for example `io.github.robypomper/wingfoil`).
4. **`server.json`** is added at the repository root with that `name`, the description, the
   repository URL, and one `packages[]` entry for npm package `wingfoil` over `stdio` with the
   argument `mcp` (the command `wingfoil mcp` starts, `src/cli/mcp-command.ts`).
5. **The version-sync check.** Open for the approver:
   - **(a) extend `checkReleaseTag`** so the gate job also asserts `server.json` `version` and every
     `packages[].version` equal `package.json` `version`, with the same cases pinned in
     `test/cli/publish-metadata.test.ts`;
   - **(b) generate `server.json`'s versions at publish time** from `package.json`, and version only a
     template. Nothing can drift, but the file in the repository no longer shows what was published;
   - **(c) a unit test only**, with no gate step.

   **Recommendation: (a).** The tag gate already exists for exactly this class of mistake, runs
   before anything is built, and fails the pipeline instead of publishing a mismatched listing.
6. **Publishing to the MCP Registry itself** is not part of this decision. It happens with the
   approver at publication time (§6.7), and the recurring step belongs to `dl-130`.

## Rationale

- **Discovery is metadata-bound.** npm search and the MCP directories index `keywords`, `description`
  and the registry entry; a correct package that no search reaches is invisible.
- **The registry needs a published `mcpName`.** Leaving it to v0.3.0 would make the first release
  with a listing also the release with the most other changes; v0.2.2 is the rehearsal the approver
  asked for.
- **One version, one check.** Three copies of a version and no check is the drift `spec-015` §4
  already guards against for the tag; (a) extends that guard rather than adding a second mechanism.
- **Removing the unused SDK belongs in the same patch.** It is 10 MB of the install and no
  behaviour, and the patch already touches `package.json`.

## Actions

- [ ] Ratify, choosing the version-sync option (owner: approver), after `dl-091` is `ready`.
- [ ] Amend `spec-015-packaging-publishing` §1 (published metadata) and §4 (version checks) to
      name `mcpName`, `server.json` and the sync check.
- [ ] Tasks are derived by v0.2.2 `release-planning` (`build-backlog`), not created here: the
      `package.json` fields, `server.json`, the check and its tests, and `bug-138`'s removal.
- [ ] Record the MCP Registry listing as a `service` element once it exists (`dl-088`).

## Relations

- **Origin:** `retro-v0.2`; `retrospective-rel-v0.2-plan` §6.7 (the v0.2.2 scope) and §6.8 (step 5).
- **Depends on:** `dl-091-package-name-and-mcp-namespace` (the name, descriptor and namespace).
- **Scope partner:** `bug-138-unused-anthropic-sdk-runtime-dependency`.
- **Related:** `dl-088` (the listing's `service` record), `dl-130` (MCP Registry publish in the
  release flow), `dl-087` (the publish path v0.2.2 uses), `task-059` (the attribution fields pinned
  today).
- **Traceability:** REQ-SYS-09 (distribution as an npm package); P5.2.1 (the MCP server).
