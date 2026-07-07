---
id: "task-025-implement-dna-set"
type: task
title: "Implement wingfoil dna set (P2.1)"
status: in-progress
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.1"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want to define/update project DNA with `wingfoil dna set` so that I can set initial modules,
stack, and conventions without hand-editing YAML (US-0A-08, feature P2.1). This task implements the
`wingfoil dna set <dotted.key.path> <value>` CLI command: it resolves a dotted key path (e.g.
`stacks.technologies.0.version` or a top-level section like `project.name`) against the parsed
`.wingfoil/dna.yaml` structure, writes the new value, re-serializes the file, and commits the change to
git. This is the only *mutating* entry point into DNA — `dna show` (task-026) is read-only, and the
`paths`/init commands depend on this command's write path existing first.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.1-dna-set.feature`:

- **Set a DNA field**: `wingfoil dna set tech_stack.language python` writes `language: python` under
  the target section in `.wingfoil/dna.yaml`, commits the change to git, and exits `0`.
- **Update an existing DNA field**: setting a key that already has a value overwrites it in place
  (idempotent write, no duplicate keys).
- **Error — invalid dotted key path**: `wingfoil dna set ..language python` leaves `.wingfoil/dna.yaml`
  unchanged and exits `2` with `error: invalid key path: '..language'` (usage error, per the exit-code
  contract below).

## Implementation Notes

- The written file must validate against the `DnaYaml` Zod schema in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` — a `dna set` that would produce
  a schema-invalid file must be rejected before the write is persisted.
- Exit codes / `--format`/error-message shape follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md` (invalid key path is a usage
  error → exit `2`; a value that fails schema validation is a logic error → exit `1`).
- Invocation grammar (`wingfoil dna set <path> <value>`, global flags position, element-ref conventions)
  follows `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- Depends on `task-001-nodejs-typescript-scaffold` (TS/Node project scaffold) and
  `task-002-validation-id-engine` (shared validation plumbing) as prerequisites.
- The live worked example of the target schema is `docs/self/.wingfoil/dna.yaml` itself (note its
  `stacks.technologies`/`stacks.methodologies` list shape, not a fixed `tech_stack` object — the BDD
  scenario's `tech_stack.language` phrasing predates the spec-002 schema rename to `stacks`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (architect) — spec verification, no gap; one CLI-grammar discrepancy flagged

Verified scope against the four approved specs; **no missing/insufficient tech-spec** was found, so no
`memory.add(tech-spec)` was needed — every artefact `dna set` touches is already pinned:

- **spec-002-dna-yaml-schema** — the `DnaYaml` Zod schema the written file must re-validate against.
  Every node is `.passthrough()`, so an additive key stays valid; `tech_stack` is a BDD-compat alias for
  the renamed `stacks` node (spec-002 Consequences), so `dna set tech_stack.language` writes under
  `stacks` (symmetric with `dna show`'s existing alias).
- **spec-005-cli-command-contract** — the 0/1/2 exit contract + `error: <reason>` shape. §1 classifies a
  malformed argument (invalid key path) as a **usage error → exit 2**; a value that fails schema
  validation is a logic error → exit 1.
- **spec-006-core-domain-api** — `dnaSet` is `mutates: true` (§3 dna table) ⇒ MCP **Tool** + CLI command
  by construction; all logic lives in `src/core` (surfaces stay thin); `requireGitIdentity` is the
  mutating-op pre-flight (task-014).
- **spec-008-cli-grammar** — invocation grammar, positional args, and the exit-code table (§5).

**Discrepancy flagged (no self-approval; for the approver/orchestrator):** `docs/01_vision/X_cli-cmds.md`
(approved v1.2) line 60 lists the invocation as `wingfoil dna set [--field FIELD] [--value VALUE]`
(flag/interactive form), whereas the acceptance contract **BDD `P2.1-dna-set.feature`** and this task's
own Acceptance Criteria use the **positional** form `wingfoil dna set <key> <value>`. Per the
traceability chain (feature → US → **BDD** → REQ → task) and CLAUDE.md §10.1, the BDD acceptance contract
governs behaviour, so this task implements the **positional** form. The `--field/--value` flag form is
**deferred** (it additionally needs value-bearing CLI flags, which the current boolean-only `flags` seam
does not carry); X_cli-cmds.md §Pillar-2 and spec-005/008 may want reconciling in a follow-up. No spec
was invented or edited here.

**Design decisions carried into red/green (all within spec-006's `src/core` scope, no new spec):**
1. **CLI seam** carries only a single `positional` + boolean `flags` today; `dna set` needs two data
   inputs (`<key> <value>`), so the seam is extended **additively** with `positionals: readonly string[]`
   (the full positional list), keeping `positional === positionals[0]` so `dna show [section]` /
   `paths [category]` are untouched. task-020's `memory add` reuses `positionals`.
2. **exit 2 for a malformed key path** is surfaced via a new `src/core` `UsageError` (exitCode 2, clean
   message) mapped by a new `exitCodeForThrow` helper — keeping "core owns exit-code selection"
   (spec-008 Consequences); a schema-invalid write is instead returned as `CoreResult.error`
   (`VALIDATION` → exit 1) with **no** file write.
3. **First real `mutates: true` op**: registering `dnaSet` in `CORE_MODULES` flips the production parity /
   MCP "zero mutating ops today" tests (task-006/011/016 wrote them as placeholders that, by their own
   comments, activate "with task-018+") — those are updated to expect the `dna.set` Tool.
