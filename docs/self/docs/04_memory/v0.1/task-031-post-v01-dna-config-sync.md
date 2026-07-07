---
id: "task-031-post-v01-dna-config-sync"
type: task
title: "Post-v0.1 dna.yaml config sync"
status: done
release: "v0.1"
priority: "High"
tags: ["v0.1", "dna"]
ref: "spec-002-dna-yaml-schema"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

`docs/self/.wingfoil/dna.yaml` was hand-authored before any v0.1 code existed, so several of its
entries are declared as aspirational (`paths.sources`/`paths.tests`/`paths.config` are explicitly
commented `# planned`, and `stacks.technologies` lists Commander.js/chalk/MCP SDK/Anthropic SDK/Zod/
Jest as intended dependencies rather than confirmed ones). Once `task-025-implement-dna-set`,
`task-026-implement-dna-show`, and `task-027-implement-project-dna` land — the `wingfoil dna set`/
`wingfoil dna show` commands and the `DnaYaml` schema loader itself — this task reconciles the live
`dna.yaml` against what was actually built during v0.1: the real `src/` module layout (`task-001`),
the dependencies actually added to `package.json`, and the resource paths that materialized (`src/`,
`test/`, `package.json`, `tsconfig.json`). The goal is to remove every `# planned` marker that is now
true and correct any entry that drifted from the as-implemented shape, so `dna.yaml` stops being a
forward-looking plan and becomes a truthful map of the repository, per spec-002's framing of `dna.yaml`
as "a structural map of the project ... that lets humans and agents navigate the project without full
codebase scans."

## Acceptance Criteria

- `docs/self/.wingfoil/dna.yaml` parses and validates against the `DnaYaml` Zod schema defined in
  `spec-002-dna-yaml-schema.md` (required top-level fields `version`, `modules`, `stacks`, `team`,
  `paths`; `stacks.technologies[]` entries shaped `{name, category, version?, notes?}`).
- `modules[]` matches the actual `src/` directory tree produced by `task-001` — no module listed that
  doesn't exist on disk, no implemented module missing from the list.
- `stacks.technologies[]` reflects the dependencies actually declared in `package.json` after v0.1
  (Commander.js, chalk, MCP SDK, Anthropic SDK, Zod, Jest — confirmed present, or removed/adjusted if
  the implementation diverged).
- `paths.sources`, `paths.tests`, `paths.config` no longer carry the `# planned` comment — each entry
  points at a real, existing path (`src/`, `test/`, `package.json`, `tsconfig.json`), or is corrected
  to whatever path was actually used.
- `team.roles`/`team.members` still match the canonical role catalogue (`developer, reviewer, qa,
  architect, product-owner, tech-lead, facilitator, approver`) — unchanged unless v0.1 delivery
  revealed a gap in the role set.
- `wingfoil dna show` (once implemented per `task-026`) renders the reconciled file without schema
  errors.

## Implementation Notes

- This is a **gating/closing task**: it must run near the end of v0.1, after `task-025`, `task-026`,
  `task-027` (DNA commands + schema) and ideally after most of the rest of the v0.1 backlog, since it
  depends on the real module/dependency/path shape existing to sync against — syncing early would just
  reintroduce the same "aspirational config" problem it's meant to fix.
- Do not remove or rename any `[SPEC]`-tagged field/value without first checking it against
  `spec-002-dna-yaml-schema.md`'s Consequences section (e.g. `team.roles` is load-bearing for
  REQ-SYS-08 role-name validation and must not be dropped even if unused this release).
- Keep the `[SPEC]`/`[AUTHORING]` inline provenance comments intact when editing — this task updates
  values, not the annotation convention.

## Execution Notes

Worked on branch `task/task-031-post-v01-dna-config-sync` in a dedicated worktree, off `main` at
`634f4e6` (Wave 3 complete, 536/536 green). Config-authoring task, not classic TDD — adapted the
dev-loop phases accordingly.

- **design:** `spec-002-dna-yaml-schema.md` is `approved` and settled; no gap, no new tech-spec
  needed — straight-through, as the plan anticipated. Synced against the real, as-built state:
  `ls src/` → `cli, core, directives, dna, mcp, memory, storage, validation, workflow` (9 dirs, one —
  `validation` — missing from `dna.yaml`'s `modules:`); `package.json` `dependencies` →
  `@anthropic-ai/sdk, @modelcontextprotocol/sdk, chalk, commander, js-yaml, zod` (`devDependencies`:
  `jest`, `typescript`, plus eslint/ts-jest tooling left out of scope — AC only names the six above).
- **red:** rewrote `test/core/module-layout.test.ts` from a manually-mirrored `MODULE_PATHS` list
  (which is exactly how `validation` fell out of sync unnoticed) to a self-enforcing test: it loads
  the live `docs/self/.wingfoil/dna.yaml` via the real `loadDnaYaml` (no re-implementation) and
  diffs its `modules[].path` set against `readdirSync('src')`'s real directories. Confirmed genuinely
  RED first: `expect(declaredPaths).toEqual(actualDirs)` failed with `src/validation` present on
  disk but missing from `dna.yaml`. Commit `bbf1b96`.
- **green:** hand-edited `docs/self/.wingfoil/dna.yaml` directly (not round-tripped through
  `wingfoil dna set`, which strips comments — bug-004):
  - `modules[]`: added the `validation` module (`src/validation`, spec-009's shared validation/ID
    engine) — the one implemented-but-undeclared module the red test caught.
  - `stacks.technologies[]`: added `js-yaml` (used by `src/validation/yaml.ts`, `src/core/loaders.ts`,
    `src/cli/output.ts`, `src/cli/error.ts` — a real, load-bearing dependency previously undeclared).
    Corrected two drifted `notes`: `Anthropic SDK` was noted "MCP server implementation", but
    `@anthropic-ai/sdk` is not imported anywhere in `src/` or `test/` — `src/mcp` is built entirely on
    `@modelcontextprotocol/sdk` (confirmed by grep + `src/mcp/server.ts`/`index.ts` imports), a
    drift from ADR-004's original framing. Kept the entry (still a real `package.json` dependency,
    per the AC's "confirmed present, or removed/adjusted") but corrected the note to state it's
    declared-but-unused; corrected the `Model Context Protocol` entry's note and the `mcp-server`
    module's `description` to credit `@modelcontextprotocol/sdk` instead.
  - `paths.sources`/`paths.tests`/`paths.config`: dropped the `# planned` comments (now true — `src/`,
    `test/`, `package.json`, `tsconfig.json` all exist) and the stale header note calling them
    "planned locations; tool not yet implemented".
  - `team.roles`/`team.members`: unchanged — v0.1 delivery revealed no gap in the canonical 8-role
    catalogue.
  - All `[SPEC]`/`[AUTHORING]` inline provenance comments and the field-provenance legend left
    untouched (`git diff main..HEAD -- docs/self/.wingfoil/dna.yaml` shows only value/comment
    additions inside existing sections — no `[SPEC]` field removed or renamed). Commit `e9e985b`.
- **refactor:** none — no real refactor opportunity in a value-sync change.
- **review:** `npx tsc --noEmit` → exit 0. Full `npx jest` → 56/56 suites, 538/538 tests green (536
  baseline + 2 from the rewritten module-layout test, which now runs `it.each` over 9 declared paths
  instead of a hardcoded 8). Verified `wingfoil dna show` end to end at the *operation* level (same
  `CoreFn` both `wingfoil dna show` and the MCP `wingfoil://dna` Resource call per spec-006, so this
  is the real rendering path, not a re-implementation): called `CORE_MODULES` `dna.dnaShow.fn({ root:
  'docs/self' })` against the built `dist/` — `result.ok === true`, full parsed `DnaYaml` returned, no
  schema errors. Also confirmed `loadDnaYaml('docs/self')` succeeds directly against the edited file.
  No fixture test needed correction beyond the module-layout rewrite itself — every other test that
  mentions `docs/self/.wingfoil` either uses its own inline DNA fixture string or only asserts
  generic shape (`not.toThrow()`, `.length > 0`), so none was coupled to the specific stale values
  this task changed.

**For the reviewer to scrutinize:**
- The `Anthropic SDK` stacks entry is a genuine, still-open drift this task surfaces but does not
  resolve: it's a real `package.json` dependency that no `src/` code imports. This task corrected
  `dna.yaml`'s *description* of that fact (per its own scope: sync the config to reality) but did not
  touch `package.json` itself — whether to actually remove the unused dependency is a separate,
  out-of-scope decision.
- `js-yaml`/`eslint`/`ts-jest`/`typescript-eslint` are all real `package.json` deps; only `js-yaml`
  was added to `stacks.technologies` (the AC's named list is Commander.js/chalk/MCP SDK/Anthropic
  SDK/Zod/Jest — js-yaml was implied by "check package.json ... and reconcile" in the task-launch
  brief). Left eslint/ts-jest/typescript-eslint out as tooling-internal, not distinct project-facing
  technology facts — flagging in case the reviewer wants them added too.
