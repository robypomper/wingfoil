---
id: "task-115-package-discovery-metadata-and-server-json"
type: task
title: "The package carries its discovery metadata and a `server.json`, and the tag gate keeps every copy of the version equal"
status: in-review
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

### red (developer) — `1b8e4f5b`

`test/cli/publish-metadata.test.ts` gains three blocks (discovery metadata, `server.json`, version
sync); `test/cli/check-release-tag.test.ts` now passes an in-sync `server.json` so the tag stays its
only variable; `scripts/check-release-tag.d.cts` declares the third argument (type only, so the red
is behavioural, not a compile error). `npx jest test/cli/publish-metadata.test.ts
test/cli/check-release-tag.test.ts` → **19 failed, 56 passed** (75). Every failure is an assertion on
missing behaviour: `mcpName` undefined, `description` without `WingFoil` and longer than 100, the
keyword subsets missing, `server.json` absent (`ENOENT`), and `checkReleaseTag` returning `ok: true`
for every mismatched `server.json` because it ignored the argument. Two new cases passed on first run
and are guards, not reds: *tag mismatch still rejected with `server.json` in sync* (existing
behaviour) and *`server.json` not in the tarball* (true of any file outside `files`). `npx tsc
--noEmit` and `eslint` on the three files → clean.

### green (developer) — `9ed25d51`

- `package.json`: `description` = `WingFoil — the repo-native intent layer for AI-native software
  engineering` (74 characters, `node -p "require('./package.json').description.length"`);
  `keywords` = the 15 below; `mcpName` = `io.github.wingfoil/wingfoil`. No other field, and
  `package-lock.json` untouched (`git diff main --stat -- package-lock.json` → empty).
- **Keyword list for the approver to settle** — the union of `spec-015` §1 / `dl-093` point 1, the
  visibility list (§D) and the three already present: `wingfoil`, `mcp`, `model-context-protocol`,
  `mcp-server`, `ai-agents`, `ai-assisted-development`, `claude-code`, `cli`, `workflow`,
  `governance`, `spec-driven-development`, `intent-engineering`, `context-engineering`,
  `developer-tools`, `determinism`. The visibility session omitted `workflow` and `governance`; they
  stay because `spec-015` §1 makes them a minimum, and the test pins that minimum. The repository
  topics (§B.3) also carry `git` and `typescript`; they are not added, since no decision names them.
- `server.json` at the root, `version` and `packages[0].version` `0.2.1` (the current
  `package.json` `version`), `repository.url` `https://github.com/robypomper/wingfoil` (task-116
  switches it).
- `scripts/check-release-tag.cjs`: `checkReleaseTag(tag, version, server)` checks the tag first, then
  `server.version`, then that `packages` is a non-empty array whose every `version` equals `version`.
- **Schema check (AC 2).** Source: `https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json`,
  read 2026-09-29 (`curl` → HTTP 200; sha256 of the file as fetched
  `3fba09590c99f61735d234822279f4223fab9e300c0a81e81c91ab62a4114de0`). It is the registry's current
  schema: `pkg/model/constants.go` on `modelcontextprotocol/registry` `main` (`bf4e88cb`, read the
  same day with `gh api`) sets `CurrentSchemaVersion = "2025-12-11"`. Validated with ajv 8.20.0 +
  ajv-formats (both already in `node_modules`, transitively; not added as dependencies), draft-07,
  `allErrors`: `server.json` → **valid**; a negative control (101-character `description`, a package
  without `registryType`/`transport`) → invalid, 3 errors. What the schema fixed in the design:
  `description.maxLength: 100` (why the description is one short line shared by both files) and
  `name` pattern `^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$`. `title` is optional and set to the display name.

`npx jest test/cli/publish-metadata.test.ts test/cli/check-release-tag.test.ts
test/cli/publish-pipeline.test.ts` → 97 passed. `node scripts/check-release-tag.cjs v0.2.1` → exit 0.

### refactor (developer) — `cb30a596`

- The CLI entry reads `server.json` through `readServerJson`, which returns `undefined` when the file
  is missing or not JSON, so the gate fails closed through the same `checkReleaseTag` path the unit
  case *no server.json was read* pins (no separate error branch).
- Descriptions made stale by this change, fixed here: `.github/workflows/publish.yml` header (the
  `gate` line and the `act` tag-event hint) and the gate step's name, now *Tag, package.json and
  server.json versions match*; `test/cli/publish-pipeline.test.ts` header (where the tag-check cases
  live); `test/cli/publish-metadata.test.ts` header (its "nothing here asserts a script" scope now
  names the exception). The step's `run:` line is unchanged, so `publish-pipeline.test.ts`'s order
  assertion still holds.
- Not stale, left alone: `spec-015` §1/§1a/§4 already describe exactly this change (amended
  `0a4f7a9c`); `dl-093` Context and `dl-057`/`dl-074` describe the check as it was at a dated commit.
  README, `COLLABORATION.md`, `CLAUDE.md`, `docs/*.md` carry no package description, keyword list or
  MCP namespace (`grep -rn -i "mcpName\|io\.github\.\|server\.json\|keywords\|mcp registry" README.md
  COLLABORATION.md CLAUDE.md CHANGELOG.md docs/*.md` → no match, exit 1). The long product sentence
  in `docs/01_vision/00_index.md` and `.wingfoil/dna.yaml` `description` is the product statement,
  not the package metadata; re-baselining the vision is `task-121` (`dl-096`).

### Checks (after merging `main` at `f0c87536` into the branch, `43aa0e25`)

- `npx jest --coverage` → **155 suites / 2556 tests passed** (+21). Coverage unchanged: statements
  98.62 %, branches 94.18 %, functions 93.79 %, lines 99.47 % (no `src/` change; `scripts/` is outside
  `collectCoverageFrom`).
- `npm run lint` → exit 0; `npx tsc --noEmit` → exit 0; `npm run docs:api` → exit 0.
- **AC 4.** `npm pack --dry-run --json --ignore-scripts` and the file lines of `npm publish --dry-run
  --ignore-scripts` → 339 paths each, `cmp` against the baseline → **identical**; `server.json` is not
  among them. The publish dry run again stops at `You cannot publish over the previously published
  versions: 0.2.1`, as on the baseline. The packed `package/package.json` (`npm pack` into the
  scratchpad, `tar -xzOf`) carries `mcpName` `io.github.wingfoil/wingfoil`, the new description and
  15 keywords — the field the registry reads from the published manifest.

**For the release.** `server.json`'s two versions must be bumped with `package.json` at the v0.2.2
version bump; the gate refuses the tag otherwise. That is the intended behaviour, and the first
place it will fire.

### review (reviewer)

`main` was merged before the checks above (`43aa0e25`); `git log --oneline HEAD..main` → empty at
submit time, so the checks ran on the tree being submitted. BDD: no `.feature` covers publishing or
package metadata (`grep -rlni "publish\|server.json\|keywords\|mcpName"
docs/02_requirements/02_bdd/features/` → no match, exit 1); the acceptance tests are the
`publish-metadata.test.ts` and `check-release-tag.test.ts` cases, green above.

Checklist against the ACs: 1 ✔ (red → green; the keyword list is the approver's to settle);
2 ✔ (structural pins red → green; schema validation recorded under *green*); 3 ✔ (red → green,
9 rejection cases + accept + the real-file gate run); 4 ✔ (manifest identical, 339 paths); 5 ✔.

**For the approver.**
- Settle `keywords` (15, listed under *green*) and the `description` text: `WingFoil — the
  repo-native intent layer for AI-native software engineering`. Both files share it; the registry caps
  it at 100 characters.
- `server.json` names `robypomper/wingfoil`; `task-116` (which lists `server.json` already) switches it
  with the other three URLs.
- The v0.2.2 version bump must update `server.json`'s two versions with `package.json`, or the gate
  refuses the tag.
