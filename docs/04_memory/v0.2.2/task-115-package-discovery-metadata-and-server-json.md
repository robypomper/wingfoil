---
id: "task-115-package-discovery-metadata-and-server-json"
type: task
title: "The package carries its discovery metadata and a `server.json`, and the tag gate keeps every copy of the version equal"
status: in-progress
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "publishing", "metadata", "mcp"]
ref: "dl-093-package-metadata-for-discovery"
bug: []
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here can never leave `triaged`. A single string is still accepted for documents predating dl-045.
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []
tmpl_version: 260703
---

## Description

The published package carries no discovery metadata (`dl-093`, ratified (a)). `dl-091` fixed the
identity it needs:
- display name WingFoil;
- MCP namespace `io.github.wingfoil/wingfoil`;
- category line "The repo-native intent layer for AI-native software engineering".

The file-level contract is `spec-015` §1, §1a and §4 as amended on 2026-09-29.

## Acceptance Criteria

1. `package.json` gets three fields:
   - `description`: one line that a registry listing shows whole, with the display name. It may carry
     the category line.
   - `keywords`: at least `spec-015` §1's list, starting from the union with the visibility session's
     list (`release-planning-rel-v0.2.2-plan`, *Visibility session outcome* §D). The approver settles
     the final list at review.
   - `mcpName`: `"io.github.wingfoil/wingfoil"`.
2. `server.json` at the root: `name` equal to `mcpName`, the description, the repository URL, and one
   `packages[]` entry for npm `wingfoil` over `stdio` with the argument `mcp`. It is not in `files`.
   The shape is checked against the MCP Registry's published schema, with its source and the date
   read recorded in Execution Notes.
3. `checkReleaseTag` (`scripts/check-release-tag.cjs`) also asserts that `server.json` `version` and
   every `packages[].version` equal `package.json` `version`. The cases are pinned in
   `test/cli/publish-metadata.test.ts`. *Red-first.*
4. `npm publish --dry-run` shows the same file manifest as before.
5. `npm test` green.

## Implementation Notes

- The repository URL is the one current when the task runs. The switch to `wingfoil/wingfoil` is
  `task-116`, including `server.json` if it names the repository.
- Publishing to the MCP Registry is not in this task: it happens with the approver at publication
  time (`dl-093` point 6, `dl-130`).

## Execution Notes

Branch `task/task-115-package-discovery-metadata-and-server-json`, worktree `../.wf2-wt/task-115`,
cut from `main` at `a6e4e9f4`. The configuration is at the root since `task-111`, so every Memory
transition below is a hand-written commit in the §5.1 format on this branch.

### design (architect)

**Contracts (`grep -m1 '^status:'`).** `spec-015-packaging-publishing` → `approved`; its §1
(`description`, `keywords`, `mcpName`), §1a (`server.json`) and §4 (the version-sync check) carry
the 2026-09-29 amendment (`0a4f7a9c`, review applied in `33d89b7c`). `dl-093-package-metadata-for-discovery`
→ `ready`, version-sync option (a); `dl-091-package-name-and-mcp-namespace` → `ready`, Q1 display name
WingFoil, Q2 (iii) `io.github.wingfoil/wingfoil`. No tech-spec is missing — `spec-015` §1/§1a/§4 is the
file-level contract of every AC — so none is scaffolded and the design approval is a pass-through.

**`depends_on` read (dl-015).** `depends_on: []` — no upstream task's Execution Notes to acknowledge.
Downstream, `task-116` names this task in its own `depends_on` and switches the slug in `server.json`
if it names the repository: it does (`repository.url`), so that is one more file for task-116's sweep.

**Scope boundaries.** Only the top-level metadata fields of `package.json` are edited (`description`,
`keywords`, `mcpName`); `dependencies` and `package-lock.json` belong to `task-117`, which runs in
parallel, and the lock is not regenerated. The repository URL stays `robypomper/wingfoil`
(`task-116`). Publishing to the MCP Registry is out of scope (`dl-093` point 6, `dl-130`).

**Design.**
- `package.json` `description` = the display name plus the category line (`dl-091` D4):
  `WingFoil — the repo-native intent layer for AI-native software engineering`. `server.json` carries
  the same string, so it must fit the registry schema's `description.maxLength: 100` (see *green*).
- `keywords` = the union of `spec-015` §1 / `dl-093` point 1 and the visibility list
  (`release-planning-rel-v0.2.2-plan`, *Visibility session outcome* §D), plus the three that were
  already there; the approver settles the final list at review.
- `server.json` at the root: `$schema`, `name` = `mcpName`, `title` WingFoil, `description`,
  `repository {url, source: github}`, `version`, one `packages[]` entry `{registryType: npm,
  identifier: wingfoil, version, transport: {type: stdio}, packageArguments: [{type: positional,
  value: mcp}]}`. `files` is unchanged, so it cannot enter the tarball.
- `checkReleaseTag(tag, version, server)` gains a third argument, the parsed `server.json`, and fails
  unless `server.version` and every `server.packages[].version` equal `version` and there is at least
  one package. The CLI entry reads `server.json` next to `package.json`; a missing or unparsable file
  fails the gate. The step already runs first in `publish.yml`'s `gate` job, so no workflow change is
  needed beyond the step name.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — `description`, `keywords`, `mcpName` | **red-first** | `mcpName` is absent, `keywords` is `["wingfoil","ai-assisted-development","determinism"]`, `description` does not carry the category line (`node -p "require('./package.json')…"` at `a6e4e9f4`) |
| 2 — `server.json` shape | **red-first** (structural pins) + verification (schema) | `ls server.json` → no such file; the full schema check is run against the registry's published schema and recorded, because a test cannot fetch it offline |
| 3 — `checkReleaseTag` asserts the `server.json` versions | **red-first** | the function takes `(tag, version)` and never reads `server.json` |
| 4 — `npm publish --dry-run` manifest unchanged | verification | compared below against the baseline |
| 5 — `npm test` green | verification | gate below |

**Baseline at `a6e4e9f4`.** `npm pack --dry-run --json --ignore-scripts` → 339 files; the file list of
`npm publish --dry-run --ignore-scripts` (its `npm notice <size> <path>` lines) is the same 339 paths
(`LC_ALL=C sort` of both, `cmp` → identical). The publish dry run then stops with `You cannot publish
over the previously published versions: 0.2.1`, as expected for a released version; the manifest is
printed before that check. `npx jest --coverage` → 155 suites / 2535 tests passed; statements
98.62 %, branches 94.18 %, functions 93.79 %, lines 99.47 %.
