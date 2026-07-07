---
id: "task-026-implement-dna-show"
type: task
title: "Implement wingfoil dna show (P2.2)"
status: done
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "dna"]
ref: "P2.2"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

As Jordan, I want to query and display project DNA with `wingfoil dna show` so that I understand the
team architecture (US-3-03, feature P2.2). This task implements the read-only `wingfoil dna show
[section]` CLI command: with no argument it prints the full parsed `.wingfoil/dna.yaml` structure
(`project`, `modules`, `stacks`, `team`, `paths`); with a `section` argument (e.g. `tech_stack`/`stacks`,
`team`) it prints only that subtree. It is the query counterpart to `dna set` (task-025) and must never
mutate the file.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p2-dna/P2.2-dna-show.feature`:

- **Display the full DNA**: `wingfoil dna show` output includes tech stack, modules, conventions, and
  team sections, and the query returns in under 1 second.
- **Display a single DNA subtree**: `wingfoil dna show tech_stack` prints only that subtree.
- **Error — requesting a non-existent key**: `wingfoil dna show nonexistent_section` exits `1` with
  `error: no DNA key named 'nonexistent_section'` (a read-only command can only exit `0`/`1`, never `2`,
  per the exit-code contract).

## Implementation Notes

- Reads and displays the same `DnaYaml` structure defined in
  `docs/self/docs/04_memory/design/specs/spec-002-dna-yaml-schema.md`; the schema renamed the BDD's
  `tech_stack`/`conventions` wording to `stacks` (technologies + methodologies) — `conventions` no
  longer exists as a top-level section (moved to `directives/custom/`, per spec-002 Consequences), so
  the command should resolve `tech_stack` as an alias for `stacks` for BDD compatibility.
- Output-format switching (`--format console|json|yaml`) and the sub-1-second latency budget follow
  `docs/self/docs/04_memory/design/specs/spec-005-cli-command-contract.md`; invocation grammar (bare
  positional `section` argument, global flags) follows
  `docs/self/docs/04_memory/design/specs/spec-008-cli-grammar.md`.
- Depends on `task-001-nodejs-typescript-scaffold` and `task-002-validation-id-engine` as prerequisites,
  plus a shared DNA loader (introduced alongside task-025/task-027) that both `dna set` and `dna show`
  reuse rather than each re-implementing YAML parsing.

## Execution Notes

Worked on branch `task/task-026-implement-dna-show` (dedicated worktree).

- **design (safety net, no gap):** verified scope against `spec-002-dna-yaml-schema` (`approved`,
  the `DnaYaml` shape and the `tech_stack`->`stacks` alias rationale), `spec-005-cli-command-contract`
  (`approved`, exit-code/`--format` envelope, `NOT_FOUND` -> exit `1`), `spec-006-core-domain-api`
  (`approved`, the `CoreModule`/`CoreFn`/`ParamsContext` shapes this task extends), and
  `spec-008-cli-grammar` (`approved`, bare-positional invocation grammar). No spec gap — `dnaShow` was
  already registered read-only in `CORE_MODULES` (task-006) wrapping `loadDnaYaml` (task-004/027); this
  task only needed to extend it to accept an optional section, not introduce a new concept any of the
  four specs would need to gain a clause for.
- **pattern-setter finding:** the existing CLI seam (`src/cli.ts`'s `buildParams: (ctx) => ({ root:
  ctx.root })`, `CliCommand.run(formatValue)`, `ParamsContext { moduleName, operationName, root }`) had
  no way to carry a positional argument from `wingfoil <noun> <verb> [arg]` into a core op at all — every
  registered operation so far took a bare `{ root }`. Extended the seam generically (see "How the
  positional argument was threaded" below) rather than special-casing `dna show`, since task-025
  (`dna set`) and task-028 (`paths [category]`) need the identical mechanism.
- **red:** `test/core/dna-show.test.ts` (new) — 4 tests against the real, registered `CORE_MODULES`
  `dna.dnaShow` `CoreFn` directly: AC(a) full DnaYaml (passed immediately — pre-existing behavior,
  characterization), AC(b) a `positional` section returns only that subtree + `tech_stack` resolves to
  the `stacks` subtree, AC(c) an unknown section is a `NOT_FOUND` `CoreResult.error` with the exact
  message, mapped to exit `1`. `test/cli/registrar.test.ts` — 2 tests proving `CliCommand.run`'s new
  optional second argument reaches `buildParams` as `ctx.positional`, using a generic fixture op (not
  `dna`-specific), so the seam itself has a regression guard independent of `dnaShow`'s own logic.
  `test/cli/program.integration.test.ts` — 3 end-to-end cases through the real compiled CLI (`dna show
  team`, `dna show tech_stack`, `dna show nonexistent_section`). All 3 files' new assertions failed as
  expected before green (`ParamsContext` had no `positional` field yet — 2 genuine `tsc` errors in
  `registrar.test.ts`, plus wrong-value/wrong-exit-code assertion failures in the other two).
- **green:**
  - `core/registry.ts`: `ParamsContext` gains an optional `positional?: string` — the bare CLI
    positional argument, deliberately generic (not named `section`) and unvalidated at this layer; each
    operation's own `CoreFn` interprets it however it needs.
  - `core/index.ts`: factored the `ValidationError`/`ENOENT` -> `CoreResult` mapping out of
    `wrapReadOnly` into a shared `loadOrError` helper, then added `dnaShowFn` (replacing the plain
    `wrapReadOnly<DnaYaml>(loadDnaYaml)` registration): no `positional` -> whole `DnaYaml`;
    `tech_stack` resolved via a small alias table to `stacks`; an unresolved key -> `coreErr({ code:
    'NOT_FOUND', message: "no DNA key named '<section>'" })` — never thrown, so it flows through the
    existing `exitCodeForResult` mapping to exit `1` (never `2`) with no new code path in `src/cli` or
    `exit-code.ts`.
  - `cli/registrar.ts`: `CliCommand.run` takes an optional second `positional` argument, forwarded into
    `ParamsContext.positional`.
  - `cli/program.ts`: every derived `<noun> <verb>` Commander command registers one optional bare
    `[positional]` argument uniformly (not gated per-operation, since `CoreOperation` carries no
    argument metadata to gate on) and passes it to `command.run`.
  - `cli.ts` / `test/cli/fixtures/cli-harness.cjs`: both `buildParams` implementations (production
    entrypoint and the integration-test harness that drives the identical compiled wiring) now forward
    `ctx.positional` through.
  - **MCP surface left untouched on purpose:** `registerCoreModules`'s mechanically-derived
    `wingfoil://dna/show` Resource has no URI-template slot to carry a section (spec-006 §5's own
    documented limitation), so it still returns the whole `DnaYaml` — unchanged behavior, still passing
    `test/core/parity.test.ts` and `test/mcp/registrar.test.ts` unmodified. Section-addressable MCP
    access already exists independently via `src/mcp/dna-resource.ts`'s `wingfoil://dna/{section}`
    Resource (task-011), which calls `loadDnaYaml` directly rather than through `dnaShowFn` — those two
    code paths now do overlapping but not identical alias resolution (`dna-resource.ts` has no
    `tech_stack` alias); flagged for whoever next touches that file, not fixed here (out of this task's
    scope — no BDD/spec citation requires the MCP Resource to support the alias).
  - **How the positional argument was threaded (for task-025/028 to reuse):** `program.ts` Commander
    command -> `[positional]` argument value -> `CliCommand.run(formatValue, positional)` ->
    `ParamsContext.positional` (built alongside `moduleName`/`operationName`/`root`) -> whatever key the
    caller-supplied `buildParams` chooses to put it under in the operation's own params object (today:
    passed straight through as `positional`, since `dnaShowFn` itself does the section-name
    interpretation) -> the registered `CoreFn`. A future `dnaSet`/`pathsQuery` implementation can read
    `ParamsContext.positional` (or `buildParams`'s forwarded field) the same way; if an operation needs
    *two* positionals (e.g. `dna set <key> <value>`), that is not yet covered by this single-field seam
    and would need its own small extension — flagged, not solved here, since P2.2 only needed one.
- **refactor:** none beyond the `loadOrError` extraction folded into green (real, not cosmetic — removes
  duplicated try/catch logic `dnaShowFn` would otherwise have needed); no further opportunity found.
- **checks:** full suite green — 394 tests (+9 from this task: 4 + 2 + 3), 42 suites; `npx tsc --noEmit`
  exit 0; `npx eslint .` clean on every file this task touches (one pre-existing, unrelated
  `no-require-imports` finding in `test/storage/git-backed-storage.test.ts` predates this task and is
  untouched by it). Coverage 98.73% stmts / 87.68% branch / 100% funcs / 99.26% lines overall (>80%
  threshold). Note: `src/core/index.ts` (where `dnaShowFn` lives) is excluded from the coverage report
  by this project's own `jest.config.js` (`collectCoverageFrom: [..., '!src/**/index.ts']`, a
  pre-existing barrel-file convention, not something this task changed) — the new logic is nonetheless
  fully exercised by `test/core/dna-show.test.ts`'s 4 assertions plus the CLI integration tests.
- No BDD/cucumber runner exists in this project yet (`package.json` has no such script); the three
  `P2.2-dna-show.feature` scenarios are exercised as plain jest tests (`test/core/dna-show.test.ts` +
  `test/cli/program.integration.test.ts`) tracing 1:1 to the feature's three `Scenario:` blocks, per the
  same pattern task-027 already established.
- Honest TDD note: AC(a) (full DNA) was a characterization test — the whole-file behavior pre-existed
  (task-006); AC(b)/AC(c) (section subtree, alias, NOT_FOUND) had a genuine red -> green cycle, as did
  the registrar-level positional-threading tests.
