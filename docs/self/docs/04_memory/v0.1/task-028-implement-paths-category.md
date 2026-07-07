---
id: "task-028-implement-paths-category"
type: task
title: "Implement wingfoil paths [category] (P2.5)"
status: in-review
release: "v0.1"
priority: "High"
tags: ["v0.1", "dna"]
ref: "P2.5"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Alex, I want to query resource paths by category (`wingfoil paths sources/tests/docs/config/
governance`) with drill-down and console/json/yaml output so that I confirm all resources are mapped for
agent navigation (US-0A-22, feature P2.5). This task implements the `wingfoil paths [category]` CLI
command: it reads the `paths` section of the parsed DNA structure (task-027's loader), lists the entries
for a given category (`sources`, `tests`, `docs`, `config`, `governance` — the fixed category names per
`X_cli-cmds.md`), supports `--list` drill-down, and renders in `console`/`json`/`yaml` per the shared
output-format contract.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.5-paths.feature`:

- **List paths for a category**: `wingfoil paths sources --list` outputs `src/` (per DNA's `paths.sources`
  mapping) and exits `0`.
- **Output formats are supported**: `wingfoil paths sources --format <console|json|yaml>` produces valid
  output in each of the three formats.
- **Error — querying an undefined category**: `wingfoil paths governance` when no `governance` category
  is mapped in DNA exits `1` with `error: no paths mapped for category 'governance'`.

## Implementation Notes

- Reads the `Paths` node of the `DnaYaml` schema (`sources`, `tests`, `docs`, `config`, `governance`,
  each an optional `string[]`, `.passthrough()` for future categories) as defined in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md` §"Categories (P2.5)".
- `--format console|json|yaml` envelope rules and the read-only exit-code restriction (`0`/`1` only, no
  `2` once parsing succeeds) follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md`; invocation grammar follows
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- `docs/self/.wingfoil/dna.yaml`'s own `paths:` block (`sources: [src/]`, `tests: [test/]`, `docs: [...]`,
  `config: [...]`, `governance: [docs/self/.wingfoil/]`) is the reference fixture this command must query
  correctly.
- Depends on `task-001-nodejs-typescript-scaffold`, `task-002-validation-id-engine`, and
  `task-027-implement-project-dna` (the DNA loader/schema this command queries) as prerequisites.

## Execution Notes

- **design**: verified against spec-002 (§"Categories (P2.5)"/`Paths` node), spec-005
  (§4's worked example fixes the exact success shape, `{"category":"sources","paths":[...]}`), and
  spec-008 (§1: `paths` is explicitly a **flat** command — `wingfoil <noun> [args] [flags]` — not a
  `<noun> <verb>` one). No gap found; no tech-spec added.
- **Architectural gap found and closed (not a spec gap, a code gap)**: neither `src/core`'s
  `CoreOperation`/`ParamsContext` seam nor the CLI/MCP registrars had ANY support for a command
  taking a positional argument or a custom flag, or for a flat (no-verb) command — every operation
  registered through task-006/task-027 was a bare `{ root }` read under `<noun> <verb>`. task-026
  (`dna show [section]`, running in parallel) was expected to have established the pattern first
  (per the orchestrator's brief), but its branch/worktree had zero commits at the time this task
  started — so this task originates the seam: `CoreOperation.positional`/`.flags` (name lists) +
  `ParamsContext.positional`/`.flags` (parsed values) in `src/core/registry.ts`; `deriveVerb`'s
  self-named-operation (`module.name === operation.name`) → empty-verb case for the flat-command
  form; `CliCommand.positional`/`.flags` + `run`'s two additive optional params in
  `src/cli/registrar.ts`; `src/cli/program.ts`'s `resolveCommandTarget` (flat vs. nested) +
  `deriveActionParams` (Commander action-args → named positional/flag values); `src/mcp/registrar.ts`'s
  `deriveMcpToolName`/`deriveMcpResourceUri` empty-verb collapse (`wingfoil://paths`, not a
  trailing-slash `wingfoil://paths/`). All additive/optional — every op registered before this task
  is unaffected (verified: `dna show`/`directives list`/`workflow list` integration tests still pass
  unchanged). **Orchestrator should reconcile this seam with whatever task-026 (and 019/029) land on
  `src/core/index.ts`/`src/cli.ts`** — this task did not wait for/copy an existing pattern because
  none existed yet.
- **`--list` flag / no-category MCP behavior (design judgment, not a spec gap)**: spec-005 §4's own
  worked example (`paths sources --format json`) produces the full `{category, paths}` list WITHOUT
  `--list`, and no approved spec defines a "collapsed" alternative shape — so `--list` is accepted
  (a real Commander boolean flag, threaded through to `PathsParams.list`) but is currently a no-op on
  the payload; a DNA `paths` category is already a flat `string[]` with nothing coarser to collapse
  to. `category` omitted entirely returns the WHOLE `paths` node (`coreOk(dna.paths)`) rather than
  erroring — this is what the MCP surface's mechanical, zero-argument `wingfoil://paths` Resource
  gets (it has no per-request parameter mechanism, same limitation `src/mcp/dna-resource.ts` already
  documents for `dnaShow`/`{section}`); on the CLI side `category` is a required Commander
  `<category>` argument, so this branch is never reached from `wingfoil paths` itself, only from MCP.
  No BDD scenario exercises `wingfoil paths` with no category at all, so this is deliberately
  untested by the CLI integration suite beyond confirming the real exit code (see below).
- **`category` required, not `[category]`-optional-with-show-all**: `X_cli-cmds.md`'s synopsis shows
  `[category]` (brackets), but spec-008 §1's own grammar table describes `category` as "User
  specifies" with no "shows all" default (unlike `dna show`'s `section`, whose table row explicitly
  says "shows all" when omitted) — and all three BDD scenarios always pass a category. Registered
  `category` as a required Commander `<category>` argument; manually confirmed (compiled dist)
  `wingfoil paths` with no category exits `1` via Commander's own `missing required argument
  'category'` — the same real-vs-aspirational exit-code deviation this codebase's
  `program.integration.test.ts` already documents for unknown commands (spec-008's exit-`2`
  usage-error grammar isn't implemented by `program.ts`). This exit-`1` outcome happens to also
  satisfy spec-005 §1's stricter override for read-only commands ("can only exit `0` or `1`... never
  `2`"), so it is arguably more spec-compliant than the general table's exit-`2` would have been.
  Added an integration test asserting this real behavior.
- **task-013's deferred check delivered**: `test/cli/program.integration.test.ts` now has the
  `paths sources --format json`/`--format yaml` REQ-INT-05 parse-equivalence assertion task-013
  explicitly deferred to this task (its own Execution Notes: "`wingfoil paths --format json|yaml`
  parse checks → task-028"), run against the real compiled `dist/` exactly like the existing
  `dna show` one.
- No rejection — first pass through review.
