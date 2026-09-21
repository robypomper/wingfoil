---
id: "task-075-fix-pack-ignore-scripts"
type: task
title: "Fix bug-022: run npm-distribution's `npm pack` with `--ignore-scripts`, so the release gate cannot rebuild dist/ mid-suite"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "release", "testing"]
ref: "dl-056-first-real-publishing-run"
bug: ["bug-022-npm-pack-prepack-rebuilds-dist"]
depends_on: []
tmpl_version: 260703
---

## Description

Fix **bug-022**: `test/cli/npm-distribution.test.ts:117` runs

```ts
const raw = execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: REPO_ROOT, encoding: 'utf-8' });
```

without `--ignore-scripts`, so npm runs the `prepack` hook — `"prepack": "npm run build"` →
`tsc -p tsconfig.build.json` (`package.json`) — which rewrites the shared `dist/` while other Jest
workers are spawning `node dist/cli.js`. Re-verified on `main` at `8f2bce8` for this task: the line
number, the exact argument list and the `prepack` script all read as quoted above.

**The fix is one argument, and three sibling suites already carry it.** Every other `npm pack` in the
suite passes `--ignore-scripts` — `test/cli/publish-metadata.test.ts:79`,
`test/cli/license-file.test.ts:102` and `test/core/builtin-directive-templates.test.ts:251`
(`grep -rn "execFileSync('npm'" test/` returns exactly those three plus the defective one). Two of them
say why in their header comments; `license-file.test.ts:16` names `bug-022` directly. So
`npm-distribution.test.ts` is the single outlier, not a case the convention has not reached yet.

**It is no longer only a local flake — it sits inside the release gate.** `.github/workflows/publish.yml`'s
`gate` job runs `npm run prepublishOnly` (`:100-101`), and `prepublishOnly` is
`npm run build && npm test && npm run lint`, so `npm test` — and this suite — executes inside the job
that guards a tagged release. No `maxWorkers` is configured (`grep -n maxWorkers jest.config.js
package.json` → no output), so Jest picks a worker count from the runner's cores and the race is live on
a multi-core GitHub runner. The single-build `globalSetup` that closed `bug-003`
(`jest.config.js` → `test/global-setup.cjs`) is exactly what a mid-run rebuild defeats.

Ratified in **`dl-056-first-real-publishing-run` clause B** (approve commit `3655166`): the fix is the
one-argument one, **not** running the gate's tests with `--runInBand`. The approver's reason is recorded
there — the serial workaround "would hide it only in CI", while the flake also affects every developer's
`npm test`.

## Acceptance Criteria

1. **`test/cli/npm-distribution.test.ts`'s `npm pack` call passes `--ignore-scripts`,** and the suite
   still asserts what it asserted before: `dist/cli.js` and `README.md` are in the packed file list, and
   nothing under `docs/self/.wingfoil` or `test/` is. The assertions are unchanged; only the argument
   list moves.
2. **`--ignore-scripts` does not hollow out the test.** The packed list must still be the real one.
   Show that: with `dist/` present (the `globalSetup` build), record the packed paths the suite observes
   with and without the flag and state whether they differ. If they differ, say how, and decide whether
   the suite needs `dist/` guaranteed by something other than `prepack` before it can drop the rebuild —
   do not assume `globalSetup` covers it, open `test/global-setup.cjs` and confirm it actually produces
   the files the assertions name.
3. **No `npm pack` under `test/` runs lifecycle scripts any more.** After the fix,
   `grep -rn "'pack'" test/` shows every occurrence carrying `--ignore-scripts`. Put the command and its
   output in the Execution Notes; the count at the time of writing is four call sites, three of them
   already correct — re-derive it rather than trusting that number.
4. **The reason is written down where the next reader of this file will see it.** Add (or extend) the
   suite's header comment to say why the flag is there, as `publish-metadata.test.ts:29` and
   `license-file.test.ts:16` already do. A bare argument with no comment is how this outlier survived
   three sibling fixes.
5. **The change is classified honestly.** `dl-014`/T1: this is a **characterization** change, not
   red-first — the behaviour under test (the packed manifest) is unchanged and correct; what changes is
   a side effect on a shared build artefact that no assertion inside the suite can observe. Say so
   explicitly and do **not** fabricate a red. If a reproduction is attempted (e.g. repeated
   `npx jest --maxWorkers=4` runs before and after), report the real numbers, including "did not
   reproduce in N runs" if that is what happened — an intermittent race that refuses to show up is an
   honest result, and this project rejects notes that claim more than the commands showed.
6. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint` (`lint.clean`, `dl-034`).
7. **Out of scope, deliberately:** (a) `--runInBand` in the `gate` job — the alternative `dl-056`
   clause B explicitly did **not** take; (b) configuring `maxWorkers` in `jest.config.js` — a separate
   decision about suite parallelism that no element has raised, and pinning it would mask this class of
   bug rather than fix it; (c) any other change to `.github/workflows/publish.yml`, which
   `task-078-publish-pipeline-hardening` edits in the same release.

## Implementation Notes

Source: `bug-022-npm-pack-prepack-rebuilds-dist` (`triaged`, severity **medium** — re-graded from `low`
by `dl-056` clause B), `release: "v0.2"`. Ratifying decision: `dl-056-first-real-publishing-run`,
`status: ready`, approve commit **`3655166`**.

- **Why it is scheduled now, ahead of the rest of the publish chain.** `task-060-publish-pipeline` put
  `npm test` inside `prepublishOnly`, and the `gate` job runs `prepublishOnly`, so this flake can fail a
  tagged release — the one situation where the failure is public and the rollback is `npm deprecate`
  (`spec-015` §5). `dl-056`'s approve commit states the ordering constraint directly: "bug-022's fix
  must precede the first tag."
- **`ref: dl-056-first-real-publishing-run`** rather than a `REQ-*` code: no SARD requirement covers
  test-suite hygiene, and `dl-056` clause B is the decision that both re-graded the bug and chose
  between the two candidate fixes. This follows the `task-059`/`060`/`061` precedent of referencing the
  decision-log that authorises the work.
- **`dl-045` back-reference** recorded before the task starts, so `bug.sync_state` can drive
  `bug-022`'s own state from this task.
- **Related but not owned here:** `bug-003-cli-integration-dist-race` (closed) is the same class in a
  different disguise and is why `globalSetup` exists; `task-077-first-real-staging-run` runs the `gate`
  job under `act`, where this flake is one of the things that can produce a misleading failure there.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
