---
id: "dl-044-typecheck-gate-for-test-sources"
type: decision-log
title: "test/** lost its only standing typecheck gate when ts-jest moved to tsconfig.test.json"
status: in-discussion
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`task-065-fix-commander-esm-jest-harness` gave ts-jest its own `tsconfig.test.json`
(`module: CommonJS`, `moduleResolution: Node10`) so commander's ESM loads in-process. The fix is
correct and dependency-free. It also has a consequence the task did not disclose, which its reviewer
established empirically by dropping one probe file containing `import { Command } from 'commander'`
into each tree:

| | `npx jest` | `npx eslint` | `npx tsc --noEmit` |
|---|---|---|---|
| baseline `d933cbe` | **FAILS** (ts-jest diagnostic TS1479) | — | fails |
| head `f50fbdd` | **PASSES** | exit 0 | **fails** TS1479 |

Before the change, ts-jest read `tsconfig.json` (`module: Node16`), so **`npm test` itself** enforced
the project's real module semantics on test sources. It now reads a strictly more permissive config.

Nothing else covers the gap:

- `dev-loop.yaml:73` `refactor.checks.post` is
  `["tests.passing", "tests.coverage(min: 80)", "docs.api.public-complete", "docs.api.build", "lint.clean"]`
  — `tsc --noEmit` is **not** a declared check.
- `typedoc.json` reads `tsconfig.build.json`, which `exclude`s `test`.
- `test/global-setup.cjs:23` builds `src` only.
- `eslint.config.js` is not type-aware (no `parserOptions.project`).

The task hit the mirror-image instance (TS2835 on `await import('../../src/cli')`), fixed that
instance, and recorded `tsc --noEmit` as a hand-run "AC (b) regression guard". A human habit is not a
gate — and REQ-SYS-07 / the `determinism` directive say to prefer explicit declared config over
inferred behaviour.

### Correction — the gap is wider and older than the framing above

The paragraphs above describe what `task-065` changed, and they are accurate as far as they go. But
they invite a wrong reading: that `npm test` *used to* type-check `test/**` and stopped. It never did.

`tsconfig.json` sets **`isolatedModules: true`**, which puts ts-jest in **transpile-only** mode. What
survives transpile-only is **emit-level** diagnostics — and TS1479, the probe used above, is exactly
that: a statement about what the import will compile to. A purely **semantic** error does not
surface. Measured on both sides rather than inferred: a file containing
`const n: number = "definitely not a number"` **passes `npx jest` at `ab19a05` (pre-`task-065`) and at
`a3ddf1e` (post)**, while `npx tsc --noEmit -p tsconfig.json` reports it in both.

So `task-065` narrowed which *emit* errors surface. It did not remove a type-check gate, because
there was none to remove. Semantic type checking of `test/**` has been absent for the whole project's
life, behind `tsconfig.build.json`'s `exclude: test` on one side and transpile-only ts-jest on the
other.

**There is a live instance**: `bug-026-type-error-on-main-untested-by-any-gate` — a TS2339 sitting on
`main` in `test/core/directive-create.test.ts:159`, which arrived with `task-050` and passed that
task's dev-loop, its independent review and its merge with every declared gate green.

This strengthens the recommendation below rather than weakening it, and it changes what the check has
to be: not a restoration of something lost, but a **new** gate, and one that must run the full-project
`tsconfig.json` (which includes `test/`) rather than `tsconfig.build.json`.

## Decision

Open, with a recommendation.

**Add a `typecheck.clean` check to `dev-loop`'s `refactor.checks.post`**, running `npx tsc --noEmit`
over the whole project (`tsconfig.json`, which includes `test/`), asserted by a suite in `test/lint/`
the way `dl-034` did for `lint.clean`. `dl-034` is the direct precedent: same shape, same file, same
reason — a quality bar with no gate behind it is not a bar.

Sub-questions:

- **Scope**: only `dev-loop`'s `refactor`, or also a repo-level gate (`e2e-smoke`, CI)?
- **Bump**: this makes `dev-loop.yaml` v1.3, and — per the `dl-034` lesson — the v0.2 **plan file**
  under `docs/05_plans/rl-v1/rel-v0.2/` must be updated in the same change, since under the
  no-engine interim regime agents execute against the plan, not the YAML.

**Second item, same decision.** `tsconfig.test.json` carries `ignoreDeprecations: "6.0"`, required
today (without it TypeScript 6 errors TS5107) because TypeScript 7 removes `node10` resolution. It is
a **loud** time-bomb — a hard compile error, not silent drift — and is documented where it lives, so
it does not merit its own bug. But it must be a tracked item rather than a line in a done task's
notes. Decide whether the eventual answer is a different module strategy for the test runtime, or
simply accepting the pin until TypeScript 7 forces the hand.

## Rationale

The harness change was the right engineering call and should not be reverted to restore the gate —
the gate should be declared explicitly instead, which is strictly better than the accident that
provided it before. That the coverage was accidental is itself the finding: nobody chose ts-jest as
the typecheck gate, so nobody noticed when it stopped being one.

## Actions

- Ratify, then add `typecheck.clean` to `dev-loop.yaml` `refactor.checks.post` + the v0.2 plan file,
  with an asserting suite under `test/lint/`.
- Track the `ignoreDeprecations: "6.0"` pin to its resolution.
- Record the regression in `task-065`'s Execution Notes (the instance is recorded; the regression is
  not).

Related: `dl-034` (precedent), `task-065`, `bug-007`, `REQ-SYS-07`,
`bug-026-type-error-on-main-untested-by-any-gate` (the live instance), `task-050` (where it entered).
