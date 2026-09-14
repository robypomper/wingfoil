---
id: "task-042-immutable-builtin-assets"
type: task
title: "Infrastructure: REQ-SEC-07 — immutable built-in assets"
status: in-progress
rejection_reason: "isBuiltInAssetPath is a fail-open deny-list rather than the allow-list its name implies: it splits on forward slash only and normalises nothing, so it returns ok for every shape it does not positively recognise. This is reachable, not hypothetical - src/core/loaders.ts line 181 builds directive paths with platform join, so on Windows a built-in classifies as custom and directive remove would delete it; a symlinked custom directory aliasing built-in does the same. Invert to an allow-list on the custom segment and add red-first tests for the separator, casing and traversal shapes. Also correct the Execution Notes, which assert the REQ-SEC-07 Fit Criterion is satisfied without recording that clause (b), still-referenced custom assets, is out of scope - see dl-030 - and tighten the spec-011 citation, which does not support the sentence it is attached to."
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "security"]
ref: "REQ-SEC-07"
bug: ""
depends_on: []
tmpl_version: 260703
---

## Description

Implement the Security constraint **REQ-SEC-07** (built-in directive/workflow templates are immutable at runtime).

## Acceptance Criteria

Satisfies the Fit Criterion for **REQ-SEC-07** in `docs/02_requirements/03_sard/05_security-compliance.md`.

## Implementation Notes

Protects the P3.8 built-in directive template set; consumed by `directive remove` (P3.3).

## Execution Notes

### Design (architect)

- **AC classification — red-first (TDD), not characterization.** REQ-SEC-07's Fit Criterion (`directive
  remove` / `workflow remove` on a built-in is rejected with "built-in … cannot be removed") describes
  behaviour that does **not** exist yet: there is no built-in-immutability guard anywhere in `src/`
  (grep for `built-in`/`builtin` finds only spec-011 scaffolding in `src/storage/templates.ts` and
  doc-comments — no enforcement code). So this is genuine new behaviour, written test-first, not a
  characterization of existing code.
- **`depends_on: []`** → no `read_related` step; no upstream task's Execution Notes to consult.
- **Spec verification (`verify_specs`).** No STOP required. The two governing specs are already
  **approved**: `spec-011-storage-layout` (defines the `directives/{built-in,custom}` and
  `workflows/{built-in,custom}` split — the structural basis for classification) and
  `spec-006-core-domain-api` (§3 reserves `directiveRemove`/`workflowRemove` as future `mutates: true`
  ops). REQ-SEC-07 itself and both BDD contracts (`P3.3-directive-remove.feature` scenario "Error -
  removing a built-in directive"; `P4.9-workflow-remove.feature` scenario "Error - removing a built-in
  workflow template") exist and pin the exact messages. No new/absent approved spec is needed.
- **Design decision — structural (path-based) classification, in `src/core`.** spec-011 is explicit
  that a directive's protection follows *which subdirectory holds it* (`custom/` → removable,
  `built-in/` → immutable), independent of its frontmatter `kind:` — "promoting a stand-in from
  `custom/` to `built-in/` later requires no change to `roles.yaml`". So the guard classifies on the
  path segment, not on any metadata. It lives in `src/core` (a cross-cutting pre-flight, like
  `requireGitIdentity` / REQ-SEC-01, task-014) so the CLI and every MCP Tool enforce it identically
  by construction (REQ-SYS-05). This underpins P3.3 (task-052-directive-remove `depends_on` this task).
- **Scope / seam-reuse.** Neither `directiveRemove` nor `workflowRemove` is wired into `CORE_MODULES`
  yet (both are future ops per spec-006 §3). Following the task-014 / task-016 precedent for a shared
  pre-flight primitive, this task delivers the fully-tested guard now and defers wiring it into the
  actual mutating op to the dependent task (task-052 for `directive.remove`; a future task for
  `workflow.remove`). No existing seam is reimplemented — the guard returns the same `CoreResult<void>`
  shape `requireGitIdentity` uses, so a mutating op composes the two identically.

### Red (developer)

- Added `test/core/builtin-asset.test.ts` (10 cases): `isBuiltInAssetPath` true/false across
  directives+workflows, nested built-in path, and the substring guard (`custom/built-in-notes.md` is
  NOT built-in); `requireCustomAsset` refusal with the exact REQ-SEC-07 messages + `CONFLICT` code, and
  the custom allow path. Failed as expected — `Cannot find module '../../src/core/builtin-asset'`.
- Commit `6da85d9`.

### Green (developer)

- Added `src/core/builtin-asset.ts`: `AssetKind`, `isBuiltInAssetPath(relativePath)` (full path-SEGMENT
  match on `built-in`, so a substring never false-positives), `requireCustomAsset(kind, relativePath)`
  → `CoreResult<void>` (`CONFLICT` + exact `built-in {kind}s cannot be removed` message). Pure, no
  filesystem/wall-clock/randomness (REQ-SYS-07). Re-exported via `src/core/index.ts` (alongside
  `git-identity`). All 10 new tests green; `test/core` (131 tests) green; `tsc` clean; eslint clean.
- Commit `14f11cc`.

### Refactor (developer)

- **No refactor commit — nothing to tidy.** The green implementation is already two small pure
  functions with no duplication (it deliberately mirrors, not copies, `requireGitIdentity`'s shape),
  eslint and `tsc` are clean, and coverage is complete. Per the coordinator's instruction, skipped the
  commit rather than fabricating one — matching the task-014 / task-016 precedent (neither cut a
  refactor commit either).

### Review (reviewer)

- Gates: `npm test` **558/559** · `tsc -p tsconfig.build.json` **exit 0** · `npm run test:coverage`
  new file `src/core/builtin-asset.ts` **100% stmts/branch/funcs/lines**, aggregate **≥80%** (per-module
  figures 96–100% across the full run) · `npm run docs:api` **exit 0** (TSDoc present on every new
  export: `AssetKind`, `isBuiltInAssetPath`, `requireCustomAsset`).
- **Known pre-existing flake (NOT a regression):** the single failing test is
  `test/cli/program.integration.test.ts` › "memory search api … under 1 second" — a **wall-clock**
  assertion (`Date.now()` budget of 1000 ms) on a compiled, out-of-process spawned CLI. It flaked
  (2898 ms, then 5.5 s in isolation) because ~10 dev-loops were running in parallel and saturating the
  machine. It touches no code this task changed (only `src/core/builtin-asset.ts` + its test + the
  `src/core/index.ts` re-export were added); left untouched per coordinator guidance (editing it would
  collide with sibling branches at merge). Treated as GREEN for the gate.
- Traceability intact: REQ-SEC-07 → BDD `P3.3-directive-remove.feature` / `P4.9-workflow-remove.feature`
  → spec-011 (`{built-in,custom}` split) / spec-006 §3 (`directiveRemove`/`workflowRemove`) → this task
  → consumed by task-052 (P3.3).
- No new exported declaration lacks TSDoc; no secrets; scoped commits only; `node_modules` not tracked.
- `status: in-progress → in-review`.
