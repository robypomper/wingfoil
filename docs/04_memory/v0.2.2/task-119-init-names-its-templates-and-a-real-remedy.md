---
id: "task-119-init-names-its-templates-and-a-real-remedy"
type: task
title: "`init` names its available templates, and its already-initialised error names a remedy that exists"
status: approved
release: "v0.2.2"
priority: "low"
tags: ["v0.2.2", "init", "cli", "first-use"]
ref: "bug-140-init-never-names-its-templates"
bug: ["bug-140-init-never-names-its-templates", "bug-129-init-error-names-a-migration-command-that-does-not-exist"]
depends_on: []
tmpl_version: 260703
---

## Description

Two `init` messages mislead a first user. The task fixes both and closes `bug-140` and `bug-129`.

- **`bug-140`.** Without a TTY, `init` demands `--template`, but neither the error
  (`src/cli/init-command.ts:74`) nor the option's help (`src/cli/program.ts:120`) names the legal
  values.
- **`bug-129`.** On an initialised project, `init` says "use a migration command to change config"
  (`src/core/init.ts:54`), and no such command exists.

## Acceptance Criteria

1. The missing-argument error names the available templates, for example
   `missing required argument: --template (one of: Scrum, Kanban)`. The list is read from the
   template registry, not hard-coded, so a new template appears without editing the message.
   *Red-first.*
2. `init --help` names the same values in the `--template` description. *Red-first.*
3. The already-initialised error names what actually works: edit the files under `.wingfoil/`, or use
   the `dna` and `directive` commands, then commit. *Red-first.*
4. The exit codes are unchanged (the `spec-005` / REQ-INT-04 contract). *Characterization.*
5. `docs/cli-reference.md` matches, and `test/docs/cli-reference.test.ts` is green. `npm test` green.

## Execution Notes

### design (architect) — 2026-09-29

**`depends_on: []`** — the `dl-015` gate is vacuous. Read anyway, as the orchestrator asked:
`task-118` (done, merged `2f0bb682`) changed only `dnaYaml()` in `src/storage/templates.ts` and quoted
the missing-`--template` message as "the message task-119 owns"; it did not touch `init`'s messages
or help. `task-110` (done) edited `docs/cli-reference.md` in the `memory add` entry only, and its
notes record that `test/docs/cli-reference.test.ts` checks command headings, not option text.
`bug: [bug-140…, bug-129…]` — both synced `planned → in-progress` at `start` (`d44962b2`,
`ece70484`).

**Where the three strings live** (`grep -n`, at `ac39ccb4`):
- `src/cli/init-command.ts:74` → `emitError('missing required argument: --template', { format });`
- `src/cli/program.ts:120` → `.option('--template <name>', 'methodology template to initialize with (non-interactive)')`
- `src/core/init.ts:54` → `'WingFoil already initialized (use a migration command to change config)'`
- The registry: `src/storage/templates.ts:52` `export const TEMPLATES = [SCRUM, KANBAN]`, `:55`
  `export const TEMPLATE_NAMES = TEMPLATES.map((t) => t.name)`. The unknown-template error and the
  wizard question already interpolate `TEMPLATE_NAMES`; both new strings will too.

**Specs.** `grep -m1 '^status:'` → `spec-005-cli-command-contract: approved`,
`spec-008-cli-grammar: approved`, `spec-011-storage-layout: approved`.
- `spec-008` §4 gives the non-TTY failure as `error: missing required argument: --<name>`. The new
  message keeps that text as its prefix and appends ` (one of: Scrum, Kanban)`, the shape AC 1
  itself prescribes, so §4 is not contradicted. **Flag for the approver:** §4 does not yet mention
  the suffix; whether to amend it is left to you (an approved spec is not edited in-task).
- `spec-005` §3: a `<reason>` has no trailing period — the new messages have none.
- **The BDD contract pins the old text.** `P5.1.1-init.feature:23` →
  `And the command exits with code 1 and message "WingFoil already initialized (use a migration command to change config)"`.
  AC 3 cannot hold while that line does, so the scenario is rewritten in-task to the new message
  (precedent: `f84048d5`, `task-100` rewrote `P2.1-dna-set.feature`). Exit code `1` in the scenario is
  unchanged. `grep -rn "migration command\|already initialized" docs/04_memory/design/specs/ docs/02_requirements/03_sard/`
  → only `spec-011:19` (prose "already initialized", no message) and `spec-008:256` (the unrelated
  `dna set` "migration error") — nothing else pins the text.
- No tech-spec is missing; the design approval is a pass-through.

**Design.**
- AC 1: `selectTemplate` emits
  `missing required argument: --template (one of: ${TEMPLATE_NAMES.join(', ')})`. The test also
  re-loads `init-command` with a mocked registry holding a third name, which a hard-coded list fails.
- AC 2: `program.ts` builds the `--template` description from `TEMPLATE_NAMES` (imported from
  `../storage`, not from `./init-command`, which `test/cli/program.test.ts` mocks).
- AC 3: `WINGFOIL_ALREADY_INITIALIZED` becomes
  `WingFoil already initialized (to change its configuration, edit the files under .wingfoil/ and commit them, or use the wingfoil dna and wingfoil directive commands)`.
  "and commit them" is attached to the hand edit only, because `dna set/add/update/remove` and
  `directive create/assign/remove` commit themselves (`docs/cli-reference.md`, their **Commit:**
  lines: `wf(dna): …`, `wf(directive): …`).
- Same-class sweep, from `grep -rn "migration command\|already initialized\|missing required argument: --template\|methodology template to initialize"`
  outside Memory: `docs/cli-reference.md` (the `init` entry: option description + errors),
  `docs/user-guide.md:112` ("Running `init` again fails: the project is already initialized." — no
  remedy). `README.md:84/127`, `docs/agents.md:135` and `docs/examples/*/run.sh` only show
  `init --template <name>` with a valid value; they will be re-read against the final wording at
  refactor.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — missing-arg error names the templates, from the registry | red-first | `init-command.ts:74` is a static string (above) |
| 2 — `init --help` names the same values | red-first | `program.ts:120` is a static string (above) |
| 3 — already-initialised error names a real remedy | red-first | `init.ts:54` names a command that does not exist (`bug-129`) |
| 4 — exit codes unchanged | characterization | `2` / `1` already pinned by `test/cli/init-command.test.ts` ("no --template + not a TTY … exit 2", "already-initialized … exits 1") and `test/core/init-project.test.ts` |
| 5 — `cli-reference.md` matches, `npm test` green | characterization (docs + gate) | documentation; `test/docs/cli-reference.test.ts` checks headings only |

### red

Commit `ad2d50a8`. `npx jest test/cli/init-command.test.ts test/core/init-project.test.ts test/cli/program.test.ts`
→ **4 failed, 47 passed**, each on its assertion (genuine reds):
- AC 1, `init-command.test.ts` "no --template + not a TTY": expected
  `error: missing required argument: --template (one of: Scrum, Kanban)`, received
  `error: missing required argument: --template`.
- AC 1, new suite "a template added to the registry appears in the message": re-loads
  `init-command` under `jest.isolateModules` with `../../src/storage` mocked to
  `TEMPLATE_NAMES: ['Scrum', 'Kanban', 'Shape Up']`; expected `… (one of: Scrum, Kanban, Shape Up)`,
  received the bare message. A hard-coded list would keep failing this test.
- AC 2, `program.test.ts`: expected the `--template` description
  `methodology template, one of: Scrum, Kanban (required without a terminal or with --no-interactive)`,
  received `methodology template to initialize with (non-interactive)`; it also asserts
  `helpInformation()` contains `Scrum, Kanban`.
- AC 3, `init-project.test.ts`: expected the new `WINGFOIL_ALREADY_INITIALIZED`, received
  `… (use a migration command to change config)`; it also asserts the constant does not match
  `/migration/`.
AC 4 (characterization): the exit-`2` and exit-`1` assertions in those suites passed on first run.
The `init-command.test.ts` already-initialized test now compares against the constant rather than a
second copy of the text.

### green

- `5944bd06` — `src/cli/init-command.ts` `selectTemplate` emits
  `missing required argument: --template (one of: ${TEMPLATE_NAMES.join(', ')})`; `src/cli/program.ts`
  imports `TEMPLATE_NAMES` from `../storage` and builds the `--template` description from it;
  `src/core/init.ts` `WINGFOIL_ALREADY_INITIALIZED` carries the new hint (TSDoc updated: "do not
  reword without that scenario").
- `21a1dc83` — `P5.1.1-init.feature` scenario "Error - initializing an already-initialized project"
  pins the new message; exit code `1` unchanged.
- The three suites → 51 passed.

**End to end** (`npm run build`, then `node dist/cli.js` in a `mktemp -d` `git init` repo under the
session scratchpad, identity set locally):

| Invocation | Exit | Output |
|---|---|---|
| `init </dev/null` | `2` | `error: missing required argument: --template (one of: Scrum, Kanban)` |
| `init --no-interactive --format json </dev/null` | `2` | `{"error":"missing required argument: --template (one of: Scrum, Kanban)"}` |
| `init --help` | `0` | `--template <name>  methodology template, one of: Scrum, Kanban (required` / `without a terminal or with --no-interactive)` |
| `init --template Nope` | `2` | `error: unknown template "Nope", expected one of: Scrum, Kanban` (unchanged) |
| `init --template Scrum` | `0` | one commit `chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)` |
| `init --template Scrum` again | `1` | `error: WingFoil already initialized (to change its configuration, edit the files under .wingfoil/ and commit them, or use the wingfoil dna and wingfoil directive commands)`; still 1 commit (`git log --oneline \| wc -l` → 1), clean tree (`git status --short \| wc -l` → 0) |

The named remedy works: `dna set project.name --value Demo` → exit `0`, commit `wf(dna): set project.name`;
`directive --help` → exit `0`, lists `assign`, `create`; `wingfoil --help | grep -i migrat` → nothing
(exit `1`).

**Same-class sweep.** `grep -rn "migration command\|already initialized\|missing required argument: --template\|methodology template to initialize"`
(outside Memory) plus `grep -n -i "template\|no-interactive\|tty"` on the user docs:
- **Fixed** (`e6cd246e`): `docs/cli-reference.md` `init` entry — option row (lists where `init --help`
  names the values; required also without a terminal) and **Errors** (both new messages quoted, exit
  codes as before); `docs/user-guide.md` §3 — the missing-`--template` error and the re-init remedy
  (edit + commit, or `dna`/`directive`, §4/§6). Only the `init` entry of `cli-reference.md` was touched
  (task-120 owns the rest).
- **Checked, nothing stale:** `README.md:84` (`init [--template Scrum|Kanban]`), `README.md:127`,
  `docs/agents.md:135` (`init --template Scrum # or Kanban`), `docs/examples/*/run.sh` (all pass a
  valid `--template`). None quotes either message.
- `CHANGELOG.md` has no unreleased section; it is written by the `user-docs` phase.

### refactor

No code refactor: the change is three strings. `TEMPLATE_NAMES.join(', ')` now appears at five call
sites (`grep -c` → `init-command.ts` 4, `program.ts` 1); extracting a helper was not done because `program.ts`
cannot take it from `./init-command` (mocked in `program.test.ts`) and a storage-level helper would be
new public API for a one-liner.

Checks (`npm ci` done in the worktree):
- Coverage, `npx jest --coverage` — before (`src test` + docs checked out at `ac39ccb4`): statements
  98.62% (3874/3928), branches 94.18% (1993/2116), functions 93.79% (650/693), lines 99.47%
  (3398/3416), 2535 tests; after: 98.62% (3875/3929), 94.18% (1993/2116), 93.79% (650/693), 99.47%
  (3399/3417), 2537 tests. Not regressing.
- `npm run lint` → exit 0; `npm run docs:api` → exit 0; `npx tsc --noEmit` → exit 0.
- `main` had advanced (`git log --oneline HEAD..main` → 6 commits: task-124 filing, bug approvals,
  plan edits; no `src/`/`test/` file). Merged (`fd25af79`, no conflict), rebuilt, `npx jest` →
  155 suites, **2537 passed**.

### review

- `tests.bdd`: `P5.1.1-init.feature` is exercised by `test/core/init-project.test.ts` and
  `test/cli/init-command.test.ts`, green in the full run above.
- AC 1 ✔ red-first (`ad2d50a8` → `5944bd06`, incl. the mocked-registry test); AC 2 ✔ red-first
  (same); AC 3 ✔ red-first (same, plus `21a1dc83`); AC 4 ✔ characterization (exit `2`/`1`/`0`
  unchanged, e2e table); AC 5 ✔ (`e6cd246e`; `test/docs/cli-reference.test.ts` green; `npx jest`
  2537/2537).
- **For the approver:** (1) `spec-008` §4 still reads `error: missing required argument: --<name>`;
  the new message keeps it as a prefix and adds the list. Amend §4 or leave it — not edited in-task.
  (2) The BDD scenario text was changed in-task (`21a1dc83`), as `task-100` did for `P2.1`.

**Approver's ruling at the review gate (2026-09-29).** Approved, with `spec-008` §4 updated in-task
before approval: its non-TTY row named only `missing required argument: --<name>`, which `init`'s new
message extends. The row now names the ` (one of: …)` suffix for closed-set arguments, with a dated
revision note, signed off with this approval. The rewritten `P5.1.1-init.feature` scenario is
accepted.
