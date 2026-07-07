---
id: "task-027-implement-project-dna"
type: task
title: "Implement Project DNA (structured config) (P2.4)"
status: approved
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.4"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want a structured project map (modules, tech stack, conventions, team) in `.wingfoil/dna.yaml`
so that humans and agents have a shared anatomy (US-0A-05, feature P2.4). This task is the shared
infrastructure task underlying the whole DNA pillar: implement the `DnaYaml` Zod schema and loader that
parses/validates `.wingfoil/dna.yaml` at load time (`project`, `modules`, `stacks`, `team`, `paths`),
exposes it as the single structure both `dna set`/`dna show` (task-025/026), `wingfoil paths`
(task-028), and — later — the MCP `wingfoil://dna` Resource (task-030) all consume, so the CLI and MCP
surfaces cannot drift (REQ-SYS-05). `docs/self/.wingfoil/dna.yaml` is the live, hand-authored worked
example this schema must validate.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.4-project-dna-config.feature`:

- **DNA file exists and is schema-valid after init**: validating `.wingfoil/dna.yaml` passes, and the
  file declares the sections `modules`, `tech_stack` (now `stacks`), `team`, `conventions` (now relocated
  per spec-002, see notes below).
- **Agents read DNA as the authoritative project map**: given a module (e.g. `billing`) listed in
  `.wingfoil/dna.yaml`, an agent requesting the project module map gets that module back in the parsed
  structure.
- **Error — malformed YAML in the DNA file**: loading a `.wingfoil/dna.yaml` with invalid YAML syntax
  fails with `invalid DNA: YAML parse error at line <n>`.

## Implementation Notes

- Implement exactly the `DnaYaml` Zod schema pinned in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` — `.passthrough()` on every node
  (forward-compat), `stacks.technologies`/`stacks.methodologies` as flat generic lists (not the BDD's
  legacy fixed-key `tech_stack`), `team.roles` as the canonical role registry (REQ-SYS-08), and no
  top-level `conventions` field (its former values now live in `directives/custom/`, per spec-002
  Consequences table).
- Directory/root-detection rules (where `.wingfoil/dna.yaml` must live, git-root walk-up, init-marker
  check) follow `docs/self/docs/04_memory/design/specs/spec-011-storage-layout.md`.
- `docs/self/.wingfoil/dna.yaml` is the authoritative worked example/fixture for schema tests — the
  loader must accept it as-is.
- Depends on `task-001-nodejs-typescript-scaffold` and `task-002-validation-id-engine` as prerequisites;
  `dna set`/`dna show`/`paths` (task-025/026/028) and the MCP DNA Resource (task-030) all depend on this
  task's loader/schema landing first.

## Execution Notes

Worked on branch `task/task-027-implement-project-dna` (dedicated worktree).

- **design (safety net, no gap):** verified scope against `spec-002-dna-yaml-schema` (`approved`) and
  `spec-011-storage-layout` (`approved`) — both cited in this task's own `Implementation Notes`.
  `src/dna/schema.ts`'s `DnaYaml` (task-004) matches spec-002's Zod definition field-for-field
  (`version`/`project?`/`modules`/`stacks`/`team`/`paths`, every node `.passthrough()`, `team`'s
  `superRefine` role-binding check per REQ-SYS-08, no top-level `conventions`). `src/core/loaders.ts`'s
  `loadDnaYaml` (task-004) already targets `.wingfoil/dna.yaml` per spec-011's layout. No spec gap —
  passed straight through, as spec-002/spec-011 anticipate for tasks that already cite an approved spec.
- **scope finding:** the `DnaYaml` schema and `loadDnaYaml` loader (task-004) already fully implement
  AC(a) (schema-valid, declares `modules`/`stacks`/`team`) and AC(b) (an arbitrary module round-trips
  via `.passthrough()`) — verified against the real loader, not re-implemented. The one gap was AC(c):
  `loadDnaYaml` surfaced the shared, pillar-generic `E_YAML_PARSE_ERROR` message (js-yaml's raw
  reason + `(line:column)` position + context snippet) rather than the BDD scenario's exact fit
  criterion `invalid DNA: YAML parse error at line <n>`.
- **red:** `test/dna/loader.test.ts` — 4 tests covering all three BDD scenarios end-to-end against the
  real `loadDnaYaml`/`DnaYaml`. AC(a)/AC(b) passed immediately (pre-existing behavior, characterization
  tests); the two AC(c) malformed-YAML tests failed as expected, asserting the received message was
  js-yaml's raw text instead of the fit-criterion string.
- **green:** added `extractYamlErrorLine` + a catch/re-throw in `loadDnaYaml` (`src/core/loaders.ts`)
  that maps `E_YAML_PARSE_ERROR` → `invalid DNA: YAML parse error at line <n>`, extracting the line
  from js-yaml's own `(line:column)` marker (verified stable across 5 distinct js-yaml failure shapes
  during design). Scoped to `loadDnaYaml` only — `parseYaml`/`ValidationError` and the other three
  pillar loaders (`memory.yaml`/`workflows.yaml`/directives) are untouched, so their generic
  `E_YAML_PARSE_ERROR` message is unaffected. `DnaYaml`'s shape and `loadDnaYaml`'s signature are
  unchanged (task-025/026/028/030 dependency preserved).
- **refactor:** none — the addition is small and follows the existing loader/error-mapping style
  already used elsewhere in this file (e.g. `loadWorkflowsYaml`'s `ValidationError.semantic` throws);
  no genuine refactor opportunity found.
- **checks:** full suite green (360 tests, +4 from this task), `tsc --noEmit` clean, `eslint .`
  clean on the changed files. Coverage 98.78% statements / 87.08% branches overall (project threshold
  >80%); `src/core/loaders.ts` alone is 97.14% stmts / 83.33% branches — the two uncovered branches
  are defensive fallbacks (a non-`ValidationError` re-throw, and the `extractYamlErrorLine` `null`
  case) that are structurally unreachable given `parseYaml`'s documented contract, not untested
  production behavior.
- Honest TDD note: AC(a)/AC(b) were characterization tests (behavior pre-existed from task-004); only
  AC(c) had a genuine red→green cycle.
