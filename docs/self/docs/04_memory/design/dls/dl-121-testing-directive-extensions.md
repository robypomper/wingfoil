---
id: "dl-121-testing-directive-extensions"
type: decision-log
title: "Guards whose documentation promises more than they assert, and an environment-dependent fix that regressed with nothing to notice — two rules for the `testing` directive"
status: in-discussion
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`). Two of its dispositions have the same remedy, and
the approver ruled on 2026-09-28 that both become rules in the `testing` directive:

- a family of bugs in which a check does not check what its documentation says it checks;
- a fix to an environment-dependent defect that shipped without a regression guard, and came undone.

**"The check does not check."** Read from the bug titles at `a20b346c`
(`git grep -h -m1 '^title:' a20b346c -- docs/self/docs/04_memory/bugs/`), these ten, each still
`open` or `triaged`, describe a guard whose name, title, comment or declared
check promises more than its assertions verify:

- `bug-014-latency-guard-misses-imported-spawns`: "enforces less than its own doc claims";
- `bug-047-engines-guard-asserts-satisfies-not-equals`: the equality half is asserted nowhere;
- `bug-065-gc-auto-guard-misses-cloned-fixture`: a test titled "every fixture repo" misses one;
- `bug-070-cli-integration-helpers-fabricate-empty-stderr`: an assertion that stderr is empty asserts
  a literal;
- `bug-132-e2e-smoke-asserts-only-exit-0`: the `drive-cli` check "exit-codes match spec-005" is never
  exercised for exit 1 or 2;
- `bug-036-channel-enumeration-misses-created-files-and-commits`: a no-persistence check snapshots
  only known files;
- `bug-013-req-perf-02-command-level-unasserted`: a Fit Criterion worded against commands that
  nothing asserts at that level;
- `bug-046-lock-root-engines-never-asserted`;
- `bug-102-nothing-enforces-one-dna-path-splitter`;
- `bug-097-history-probe-behaviours-that-no-test-pins`.

In these cases the suite passes while the guard's description claims more than it checks. The reader, whether reviewer, approver or
the next implementer, believes the prose. The `testing` directive at `a20b346c` asks for test-first
work, AC classification (`dl-014`), coverage above 80%, happy and error paths, and determinism. It
says nothing about what a guard's own description may claim.

**The fix that came undone.** `task-080-fix-npm-ci-under-pinned-npm` (`done`) fixed
`bug-056-npm-ci-fails-under-pinned-npm-10-9` by restoring the hoisted `@emnapi` lock entries. It
added no check that the entries stay. When the environment's npm was later upgraded, a plain
`npm install` pruned them again (`bug-063-npm-11-erases-hoisted-emnapi-lock-entries`, `closed`).
`task-104-preserve-the-hoisted-emnapi-lock-entries-under-npm-11` (`done`) records that "`task-080`
restored the entries and nothing noticed when they came undone". It added
`scripts/check-lockfile-pins.cjs`, run as `npm run check:lockfile`, an offline check of the lockfile
itself (`git cat-file -e a20b346c:scripts/check-lockfile-pins.cjs` succeeds).
`bug-057-timestamp-assertions-reject-zulu-offset` is the same family: a defect visible only on a UTC
runner.

Statuses were read at `a20b346c` with
`git show a20b346c:<file> | awk '/^---$/{n++} n==1&&/^(status|release):/'`.

## Decision

The `testing` directive gains two rules.

- **T1 — A guard says exactly what it asserts.** The name, `describe`/`it` title, module doc, TSDoc
  and workflow `checks:` string of any test, script or gate describe what its assertions verify,
  and no more. A requirement clause, acceptance criterion or declared check that no assertion covers
  is recorded as **unasserted**: in the task's Execution Notes, and as a bug if it outlives the task.
  It is never reported as done. Narrowing the prose to match the assertions is a legitimate fix. So
  is widening the assertions to match the prose.
- **T2 — An environment-dependent fix ships a regression check.** A defect that appears only under
  some tool version, OS, timezone, locale, file ownership or runner is fixed together with a check
  that fails if the defect's condition returns. The check asserts the **invariant the fix restored**
  (the lockfile entries, the parsed offset, the file's owner), so it fails in any environment the
  suite runs in, not only the one that broke.

**Q1 — T2's form.**

- **(a) An invariant check that the normal suite exercises.** This is `task-104`'s shape:
  `scripts/check-lockfile-pins.cjs`, with `test/cli/check-lockfile-pins.test.ts` in the suite
  (`git grep -ln check-lockfile a20b346c -- test` lists it). It runs everywhere the suite runs, and
  needs no second environment.
- **(b) A CI matrix across the affected environments.** This exercises the real condition. Today CI
  runs only on a version tag (`publish.yml`, `on: push: tags`), so a matrix would first need a CI
  job on push.
- **(c) Either, with the choice justified in the task's Execution Notes.**

**Recommendation: (a), with (b) as a later addition.** The only CI trigger today is a tag push, so
(b) would detect a regression at the moment of publishing. (a) detects it at the next local run.
`task-104` shows (a) is enough to catch the actual v0.2 regression.

**Q2 — placement.** `testing.md` is a P3.8 stand-in, like `documentation.md`. The choice is the one
`dl-120-documentation-directive-extensions` Q1 puts for documentation: extend the stand-in and mark
the clauses WingFoil-specific, or use a separate custom directive. **Recommendation:** follow
whatever `dl-120` Q1 decides, so the two stand-ins are handled one way.

## Rationale

- **A false guard is worse than a missing one.** A missing check is visible as a gap. A check titled
  "every fixture repo" that covers one fewer is invisible until someone reads the assertions line by
  line.
- **T1 is `claim-evidence` applied to tests.** `claim-evidence` covers sentences about the code, and
  a test title is one. The measured instances are concentrated enough in guards to deserve a rule
  where the author of a test meets it: `testing` binds `developer` and `qa`.
- **T2 targets the invariant because the environment moves.** `task-080`'s fix was right under npm
  10.9 and was undone under npm 11 by an unrelated command. A check tied to the invariant is
  independent of which npm runs it. A check tied to one environment would have passed.
- **Alternatives considered:** a coverage threshold on guard files (rejected: coverage measures
  execution, not what is asserted); relying on review alone (rejected: all ten guards above are on
  `main`, so each passed whatever review its task had).

**Enforcement caveat.** A directive has no enforcement point today. Nothing loads one into an agent's
context, because P3.6 (auto-load by role) is not built:
`git show a20b346c:src/core/index.ts | grep -c agentExecute` prints `0`, while the same command with
`memoryApprove` prints `7`. No hook or CI job reads a commit:
`git ls-tree -r --name-only a20b346c | grep -ciE 'husky|pre-commit|lefthook|commitlint'` prints `0`,
while the same pipe with `publish.yml` prints `1`. The `dev-loop` review gate is where T1 would bite
first. How it is enforced there is `dl-097-claim-evidence-needs-an-enforcement-point` and
`dl-103-governance-enforced-outside-the-agent`, not this decision.

## Actions

1. **Ratify, choosing Q1 and Q2.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **On ratification, `docs/self/.wingfoil/directives/custom/testing.md` changes**, gaining T1 and T2
   with this decision-log cited. Under Q2's alternative, a new file under
   `docs/self/.wingfoil/directives/custom/` holds them, and `roles.yaml` binds it to `developer` and
   `qa`.
3. The ten bugs listed in Context are **not** absorbed. Each has a concrete fix, in the prose or in
   the assertions, and stays a bug. T1 prevents the next one.
4. Tasks are derived by v0.3 `release-planning` (`build-backlog`), not created here.

## Relations

- **Origin:** `retro-v0.2`.
- **Instances (T1):** `bug-013`, `bug-014`, `bug-036`, `bug-046`, `bug-047`, `bug-065`, `bug-070`,
  `bug-097`, `bug-102`, `bug-132`.
- **Instances (T2):** `task-080` → `bug-063` → `task-104`; `bug-057`.
- **Filed under:** `dl-118-choosing-between-decision-log-bug-and-directive`, rule 3.
- **Related:** `dl-120-documentation-directive-extensions` (D3/D4, the same decay in prose);
  `bug-141-coverage-omits-unrequired-source-files` (a guard whose denominator is smaller than it
  appears); `dl-014` (AC classification, already in `testing`).
- **Enforcement:** `dl-097-claim-evidence-needs-an-enforcement-point`,
  `dl-103-governance-enforced-outside-the-agent`.
- **Traceability:** P3.5, P3.8 (Testing).
