---
id: "task-125-mutating-verbs-check-their-required-arguments-before-the-git-identity-pre-flight"
type: task
title: "Mutating memory and directive verbs check their required arguments before the git identity pre-flight"
status: in-progress
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "cli", "exit-codes", "publish-blocker"]
ref: "bug-172-mutating-memory-and-directive-verbs-report-a-missing-git-identity-before-a-missing-required-argument"
bug: ["bug-172-mutating-memory-and-directive-verbs-report-a-missing-git-identity-before-a-missing-required-argument"]
depends_on: ["task-120-subcommand-help-describes-every-command"]
tmpl_version: 260703
---

## Description

Eight mutating verbs run `requireGitIdentity` (REQ-SEC-01, task-014) before they validate their
required arguments: `memory add|submit|approve|reject|deprecate` and `directive create|assign|remove`.
With no git identity configured, a missing required argument therefore exits `1` ("git identity not
configured") instead of the usage exit `2` that REQ-INT-04 and `spec-005-cli-command-contract` §1
require. The `dna` mutations and `init` already validate first. task-120's
`test/cli/help-positional-required.integration.test.ts` pins the exit `2` and fails in
`publish.yml`'s `gate` job, which has no git identity. That failure stopped the first `v0.2.2` tag
run (`36621412441`) before anything was staged (`bug-172`).

**Why in v0.2.2.** It blocks the v0.2.2 publish. The approver ruled on 2026-09-29: fix it in the
product (argument validation before the environment pre-flight), keep the test unchanged, and reuse
the version `0.2.2` once the fix is on `main`. This closes `bug-172`.

## Acceptance Criteria

1. In each of the eight verbs, every usage check (a missing or malformed required argument or option,
   thrown as `UsageError` → exit `2`) runs before `requireGitIdentity`. A missing required argument
   exits `2` with the same `missing required argument: …` message with or without a git identity.
   *Red-first:* a test that runs each verb with its required arguments missing and **no** git
   identity (an isolated environment: no `GIT_AUTHOR_*`/`GIT_COMMITTER_*`, `GIT_CONFIG_GLOBAL`
   pointing at an empty file, `GIT_CONFIG_NOSYSTEM=1`, an empty `HOME`) asserts exit `2` and fails
   on today's order.
2. With valid arguments and no git identity, each verb still refuses with the identity error
   (exit `1`) before it reads or writes anything. *Characterization:* the existing task-014 /
   REQ-SEC-01 tests keep passing unchanged. If one pins the old order for a missing-argument case,
   record it and update it here, with the reason.
3. The doc comments that describe the mutating-op order (the "1. requireGitIdentity pre-flight,
   2. Argument validation" lists in `src/core/index.ts`, `memoryAddFn` among them) state the new
   order. Every same-class description the task touches is fixed in-task. *Documentation.*
4. `test/cli/help-positional-required.integration.test.ts` is unchanged and passes both with the
   developer's git identity and with no git identity. The whole suite passes with no git identity,
   the way the `gate` job runs it (`env … npx jest` with the AC 1 isolation, exit `0`).
   *Verification.*
5. `npm test` green; coverage not regressing; the six gates green.

## Implementation Notes

- Out of scope: changing the test harness or `publish.yml` so an identity exists in CI (options (b)
  and (c), rejected by the approver in `bug-172`).
- Out of scope: `bug-171` (extra operands ignored) and `bug-131`, although they touch the same
  argument handling. Name them in Execution Notes if the change makes either easier or harder.
- The process gap in `bug-172` (no pre-tag check reproduces the `gate` job's environment) is not
  this task's. `release-publishing-rel-v0.2.2-plan` adds a no-identity `npx jest` run before the
  tag. A permanent fix is filed as its own element, if the review asks for one.

## Execution Notes

Branch `task/task-125-mutating-verbs-check-their-required-arguments-before-the-git-identity-pre-flight`,
worktree `../.wf2-wt/task-125`, cut from `main` at `1890f473`, with `main` merged in at `cc5a6a1a`
(`5ddc2638`). The task was added **by hand** (`4d4e3487`): the pinned and dev builds' `memory add
--type task --set release=v0.2.2` allocate `task-017`, which exists in `docs/04_memory/v0.1/`. That is
`bug-162` (`triaged`, v0.3). The locally committed `task-017` add was reset before anything else
happened. Submit `7a46e73b`; approver's `[pending → backlog]` `d8ab932e`; `bug-172` `[triaged →
planned]` `93a81dc3`; start `81f82b7d`; `bug-172` `[planned → in-progress]` `d77bc904`.

### design (architect)

**`depends_on` read (dl-015).** `task-120` is `done` (`awk '/^status:/{print $2;exit}'` → `done`).
From its Execution Notes: `CorePositional.required` is declarative and never enforced by Commander,
so the missing-argument refusal is core's own `UsageError` (`missing required argument: memory
submit <id>`). `help-positional-required.integration.test.ts` checks that behaviour through `dist/`.
Every run it records had a git identity. This task keeps that test byte-identical (AC 4).

**Specs.** `spec-005-cli-command-contract` and `spec-008-cli-grammar` are `approved`. Neither states
an order between the argument check and the identity pre-flight (`grep -n -i "identity\|pre-flight\|order"`
over both: no ordering clause). REQ-INT-04 requires exit `2` for a missing argument. REQ-SEC-01
requires that "with git identity unset, any state-mutating command fails with [the identity message]
and writes nothing". An invocation missing a required argument is not yet a command that can mutate
anything, and an argument check reads and writes nothing. Both requirements therefore hold with the
argument check first, and the P1.2 BDD scenario (a *valid* change with no identity → exit `1`) is
unaffected. No spec is missing or needs revision.

**Scope, measured on `main` `a1a2850b`** with the test harness and no git identity (`bug-172`'s
table): the 8 verbs exit `1`. `dna set|add` already exit `2`: their callers (`dnaPathPositional`,
`dnaMutationRequest`, `dnaSetFn`) validate before `runDnaMutation` runs the pre-flight, although that
function's doc comment listed the pre-flight first. `init` also exits `2` (`init` with no
`--template`, no identity: `missing required argument: --template (one of: Scrum, Kanban)`).

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — usage checks before the pre-flight, exit 2 with or without identity | **red-first** | the 8 verbs exit 1 today without an identity |
| 2 — valid arguments, no identity → exit 1, nothing written | characterization | the task-014 / REQ-SEC-01 tests already pin it; they must pass unchanged |
| 3 — the order comments | documentation | no behaviour |
| 4 — task-120's test unchanged, whole suite green without an identity | verification | the gate job's environment, reproduced locally |
| 5 — gates | verification | — |

### red (developer)

`test/core/usage-before-identity.test.ts` (`aae09854`) sweeps every registered operation with
`mutates: true` (12: memory ×5, directive ×3, dna ×4; `init` is outside `CORE_MODULES`). Each is
invoked with 8 malformed argument sets in a repository with a local identity and in one without (git
config isolated to an empty file, as `git-identity.test.ts` does). Every `UsageError` thrown in the
first must be thrown identically in the second, and every verb must throw at least one.
`npx jest test/core/usage-before-identity.test.ts` → **8 failed, 5 passed**. The 8 failures are
exactly the 8 verbs, each `Received: null` against the expected usage message. The 5 passing tests
are the 4 `dna` verbs and the vacuity guard.

One correction before the red commit: the guard first expected ≥ 13 operations and got 12. It counted
`init`, which is not a `CORE_MODULES` operation. That was a mistake in the guard, not a red. It was
fixed to ≥ 12 with the reason stated.

### green (developer)

`5adfee17`, `src/core/index.ts` only. In each of the 8 functions the two-line pre-flight moves below
the last usage check:
- `memoryAddFn`: after `parseSetOptions`.
- `memorySubmitFn`: after the `<id>` check.
- `memoryApproveFn`, `memoryRejectFn`: after `requireReason`.
- `memoryDeprecateFn`: after `optionalReason`.
- `directiveCreateFn`: after `isValidDirectiveName`.
- `directiveAssignFn`: after `--role`.
- `directiveRemoveFn`: after the `<name>` check.

Nothing else moves. Every step after the pre-flight keeps its place, so a valid invocation behaves
exactly as before. The new test → 13/13.

### refactor (developer)

AC 3, in the same commit: the 9 doc comments that listed the pre-flight before the argument check now
state the new order, with `task-125`/`bug-172`. They are `runDnaMutation`, whose list was already
wrong for `dna`; `memoryAddFn`; `memorySubmitFn`, `memoryApproveFn`, `memoryRejectFn` and
`memoryDeprecateFn`; and `directiveCreateFn`, `directiveAssignFn` and `directiveRemoveFn`.

Same-class search:
- `grep -rn "mutating-op template\|mutating-op order" src` → only those comments.
- `grep -n -i identity docs/cli-reference.md docs/user-guide.md docs/agents.md` → nothing about the
  order; "Every command that commits requires `git config user.name`…" stays true.

Gates, on `5adfee17`:

| Command | Result |
|---|---|
| `npx jest --coverage` | exit 0; 161 suites / 2638 tests; 98.65 / 94.25 / 93.84 / 99.47 (was 98.63 / 94.2 / 93.84 / 99.47 at `b1cd5db2`: no regression) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0, no output |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| **AC 4** — `env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME -u GIT_COMMITTER_EMAIL GIT_CONFIG_GLOBAL=<empty file> GIT_CONFIG_NOSYSTEM=1 HOME=<empty dir> npx jest` | exit 0; 161 suites / 2638 tests. That includes `help-positional-required.integration.test.ts` through `dist/` built from this branch, and the gate job's 5 failures |

AC 2: no existing test file changed (`git diff --stat 1890f473 HEAD -- test/` → only the new file).
The REQ-SEC-01 tests (`test/core/git-identity.test.ts` and the "no identity" cases in
`memory-submit`, `memory-reject`, `memory-deprecate`, `directive-create` and `directive-remove`) pass
unchanged in both runs.

`bug-171` and `bug-131` are untouched: the extra-operand handling was not moved, and neither is
easier or harder to fix after this change.

### review (reviewer)

The unit and BDD-contract suites are green, with and without a git identity (above). Evidence per AC:
- AC 1: `usage-before-identity.test.ts`.
- AC 2: the unchanged REQ-SEC-01 tests.
- AC 3: the 9 comments.
- AC 4: the no-identity run.
- AC 5: the gates table.

Submitted for the approver's review. `bug-172` synced to `in-review`.
