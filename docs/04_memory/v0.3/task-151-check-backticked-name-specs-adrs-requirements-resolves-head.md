---
id: "task-151-check-backticked-name-specs-adrs-requirements-resolves-head"
type: task
title: "Check that every backticked name in specs, ADRs and requirements resolves at HEAD"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "process", "docs", "testing", "parity"]
ref: "dl-116"
bug: []
depends_on: []
tmpl_version: 260703
---

## Description

About one bug in six is a document disagreeing with the code; only the CLI reference has a parity test. A generic Jest check resolves backticked identifiers shaped like `src/` symbols, config key paths, commands or element ids, with an allowlist for retired names quoted on purpose. Warn for one release, then fail.

## Acceptance Criteria

- (red-first) `test/docs/name-resolvability.test.ts` resolves each class at HEAD; a fixture document with a dangling name produces a finding; an allowlisted one does not.
- (characterization) warn mode for v0.3 (findings reported, suite green), with the switch to fail named for v0.4 in the test header; the first run's findings counted in Execution Notes.

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-116 (Q1 (C) with (B) first, Q2 (a), Q3 (ii)).
- **Notes:** Proposal key: D38.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

### design (architect, 2026-10-02)

- **Sources.** `dl-116` (`ready`) is the decision; it cites no tech-spec, and none governs `test/docs/`
  (`grep -n "test/docs" docs/04_memory/design/specs/*.md` → two hits, `spec-016` and `spec-017`, both
  naming only `test/docs/cli-reference.test.ts`), so no spec is
  missing or needs revising. `depends_on: []`, so no upstream Execution Notes to read (`dl-015`).
  `dl-116` Actions 2 and 4 are other tasks: the Q15 definition is `task-222`/`task-233`, naming the
  check in `dev-loop.yaml`'s `review` phase is `task-221`.
- **Scope.** "Specs, ADRs and requirements" = the tracked `*.md` directly under
  `docs/04_memory/design/specs/`, `docs/04_memory/design/adrs/` and `docs/02_requirements/03_sard/`
  (`dl-116` Q1 (B): "a spec, ADR or requirement"). USM, BDD and the agent guide are out of scope
  (the agent-guide enumeration is `task-187`'s (A) side).
- **Layout.** Engine `test/docs/support/name-resolvability.ts` (pure functions plus an index built
  from `git ls-files`), allowlist `test/docs/name-resolvability.allowlist.ts`, gate
  `test/docs/name-resolvability.test.ts`, fixture `test/docs/fixtures/name-resolvability/sample.md`.
  Test-only: nothing under `src/` changes.
- **Classes** (first match wins; spans with `{ } < > * … |` placeholders, prose and fenced blocks
  are skipped):
  `command` (`wingfoil …`: command path from the Commander tree `buildProgram` derives from
  `CORE_MODULES`, plus Commander's implicit `help`; each `--flag` an option of that command or of the
  program); `element` (Memory id short or full → a tracked file under `docs/04_memory/` or
  `docs/05_plans/`; release/release-line/plan ids; `REQ-*` → a SARD heading); `path` (first segment
  a tracked top-level directory, or a bare file name → tracked file or directory); `symbol`
  (camelCase / two-hump PascalCase / UPPER_SNAKE, optionally dotted and called → every segment a word
  in tracked `src/`, `scripts/`, `.github/`, or the chain a config key); `config` (lowercase dotted →
  a key chain in `.wingfoil/` and `.github/` YAML or `package.json`, a list item's `name` counting as
  a segment so `dev-loop.review` resolves; a `<type>.<field>` of a Memory template; or verbatim in a
  `.wingfoil/` YAML or `src/` file, which covers action names like `memory.add`).
- **Keys, not offsets.** A finding is `document|class|name` (`dl-075`): it does not move when text
  above it does, and a name repeated in one document is one finding.
- **Warn vs fail** (`dl-116` Q3 (ii)): a `MODE` constant in the test, `'warn'` now, header naming the
  switch to `'fail'` for v0.4. In both modes an **unlisted** finding fails, and so does an entry
  without a reason, out of order or duplicated (the coordinator's brief: fail on new names or on the
  allowlist growing without reason). Warn mode reports, without failing, the `UNTRIAGED` entries and
  the stale ones; fail mode fails on both. **Approver to confirm:** this ratchet is stricter than the
  AC's literal "findings reported, suite green" for a *new* dangling name; at HEAD the suite is green.
- **AC classification** (testing directive T1):

  | AC | Classification | Why |
  |---|---|---|
  | 1 — engine resolves each class; a dangling fixture name is a finding; an allowlisted one is not | red-first | no such check existed (`ls test/docs` → `api-docs`, `cli-reference`, `dl-086-citations`) |
  | 2 — warn mode for v0.3, switch named for v0.4, first-run count in these notes | characterization (as filed) | the warn branch shipped in the same green commit as AC 1; the red commit covered it too, since the suite could not load (below). Kept as filed rather than inventing a second red |

### red (2026-10-02)

- Honest sequence: the engine was prototyped in the working tree first, to measure the first-run
  findings and tune the shapes against real documents (false positives removed: `Node.js`-style
  technology names, Commander's implicit `help`, `package.json`/`.github` keys, phase names
  `workflow.phase`, Memory template fields `task.release`, camelCase config keys like `mcpName`). It
  was moved out of the tree before the red commit and was not committed with the test.
- `73d4d9b3 test(docs): task-151 — failing test: …` (test + fixture). Failing run:
  `npx jest test/docs/name-resolvability.test.ts` → `Cannot find module './name-resolvability.allowlist'`,
  `Test Suites: 1 failed, 1 total`, `Tests: 0 total`.

### green (2026-10-02)

- `4b11e759 feat(docs): task-151 — name-resolvability check …` (engine + allowlist).
  `npx jest test/docs/name-resolvability.test.ts` → `Tests: 7 passed, 7 total`, with the warn report
  `84 untriaged first-run finding(s), 0 stale allowlist entries`.
- Mutation checks (not committed): appending ``Probe: `src/teleport/probe.ts`.`` to `spec-005` →
  `1 failed` with `…spec-005-cli-command-contract.md|path|src/teleport/probe.ts` unlisted (reverted
  with `git checkout`); setting `MODE` to `'fail'` → `1 failed`, `Received + 86` (the 84 untriaged keys)
  (reverted).

### first-run findings (AC 2)

At base `903b87a6`, **236 findings in 26 of the 35 scanned documents** (count:
`grep -c "^  { document" test/docs/name-resolvability.allowlist.ts` → 236). By class
(`grep -o "nameClass: '[a-z]*'" … | sort | uniq -c`): symbol 106, command 48, config 44, path 36,
element 2. By reason: planned 124, UNTRIAGED 84, retired on purpose 12, ADR record 9, example id 2,
counterexample 2, example 1, external 1, historical 1.

Classification rule used to generate the entries (one-off script, not committed): a hand list for
the names quoted on purpose (each with its own reason, after reading the sentence: e.g. "There is no
`defaults.amendable`"); every other finding in an ADR → `ADR_RECORD`; otherwise **planned** when the
name (for a command, its first two words, e.g. `agent execute`) occurs in a v0.3 task file whose
status is not `done`, citing up to three such tasks; else `UNTRIAGED`. Most `UNTRIAGED` are spec-006,
spec-016 and spec-017 names of the agent/workflow surface that the planned-rule's literal match
missed (`workflowNext` vs "workflow next").

**Candidate stale names (not fixed here: approved specs need `memory amend`).** Each is unresolved per
the gate; whether the spec or the code is wrong is not verified here:
- `docs/self/…` paths (moved to the root by `task-111`; `git ls-files | grep -c "^docs/self/"` → 0):
  `spec-002` (1), `spec-007` (2), `spec-011` (3), `spec-003` (`docs/self/`).
- `spec-008`: `src/mcp-server` (module lives at `src/mcp`), `tech_stack.cli` (dna key retired),
  `noColor`/`flags.noColor`/`noInteractive`, `NO_COLOR` (`grep -rln NO_COLOR src` → nothing: the
  spec's `NO_COLOR` behaviour may be unimplemented — candidate bug), `E_UNKNOWN_COMMAND`.
- `spec-015`: `scripts/publish-staging` (file is `scripts/publish-staging.cjs`), `NPM_TOKEN`,
  `docs/user-docs-v0.2` (a branch name — candidate for an "external/historical" reason instead).
- `spec-001`/`spec-009`: `E_INVALID_MEMORY_SCHEMA`, `E_INVALID_STATE_GRAPH`,
  `E_INVALID_{DNA,MEMORY,WORKFLOWS}_YAML_SCHEMA`, `E_INVALID_GATES_REF` — not words in `src/`.
- `spec-004`: `workflow.yaml` (the file is `workflows.yaml`); `spec-010`: `wingfoil memory show`,
  `states.initial`; `spec-009`: `wingfoil.type`; `spec-007`: `.wingfoil/security-ignore`.

### refactor (2026-10-02)

All run in the worktree, one jest process at a time:
- `npm test` → `Test Suites: 201 passed, 201 total`, `Tests: 3373 passed, 3373 total`.
- `npm run test:coverage` → `All files | 98.85 | 95.39 | 95.18 | 99.56` (stmts/branch/funcs/lines);
  not regressing vs main by construction: `git diff --stat main -- src` → empty, and the new files are
  under `test/`, outside `collectCoverageFrom`.
- `npm run lint` → clean; `npm run docs:api` → clean; `npx tsc --noEmit -p tsconfig.json` → exit 0;
  `npx tsc -p tsconfig.build.json --noEmit` → exit 0.
- Runtime (`npx jest test/docs/name-resolvability.test.ts --json`): the repository scan 1332 ms, the
  other six tests 14–113 ms each; the index (one `git ls-files`, ~1.2k files) is built once in
  `beforeAll`.
- BDD: no feature file covers a documentation gate (`dl-116` names no P-feature); none added.

### review (self, reviewer, 2026-10-02)

- AC 1: `name-resolvability.test.ts` "resolves a name of each class at HEAD" (one name per class in
  the fixture's first section → no finding), "reports a dangling name of each class as a finding"
  (exactly five keys, one per class), "does not report a dangling name the allowlist lists" (and the
  same entry is `stale` against no findings). Met.
- AC 2: `MODE = 'warn'`, header "switch `MODE` to `'fail'` in v0.4"; the warn report prints counts and
  per-document lines; first-run count above. Met, with the ratchet noted under design.
- Determinism: inputs from `git ls-files` (sorted), findings sorted by key, allowlist order enforced
  by the test; no wall-clock or randomness in the engine.
- Pending amendments (approver): none — no Memory element other than this task file was edited.
