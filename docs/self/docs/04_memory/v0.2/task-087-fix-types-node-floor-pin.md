---
id: "task-087-fix-types-node-floor-pin"
type: task
title: "Raise `@types/node` to the Node floor adr-010 declared, so `src/` is typechecked against the runtime the package promises"
status: pending
release: "v0.2"
priority: "medium"
tags: ["v0.2", "build", "distribution"]
ref: "bug-049-types-node-pinned-to-superseded-floor"
bug: ["bug-049-types-node-pinned-to-superseded-floor"]
depends_on: ["task-074-fix-engines-node-floor"]
tmpl_version: 260703
---

## Description

`@types/node` is pinned `^18.19.130` — not incidentally, but as a decision recorded in `task-001`'s
Execution Notes to match the then-current `engines.node >=18.0.0`. `adr-010-node-22-runtime-floor`
raised the declared floor to `>=22.12.0` **in this release**, so the pin no longer tracks the contract
it was set to track: `src/` is typechecked against a Node 18 API surface while the package promises
Node 22.12+. The compiler can therefore reject APIs that are available on the supported runtime, and
cannot warn about ones that are not.

v0.2 is the release that declares the new floor. Shipping it with the types pinned to the superseded
one leaves the build contract internally inconsistent in the very release that changed it.

## Acceptance Criteria

- **AC1** — `@types/node` tracks the floor `engines.node` declares. State the resolved version and the
  command that shows `engines.node` and the installed `@types/node` agreeing, rather than asserting it.
- **AC2** — The change is justified from the floor, not from "latest": say which major matches
  `>=22.12.0` and why, and do not silently adopt a newer major than the floor implies.
- **AC3** — Both typechecks stay silent: `npx tsc -p tsconfig.build.json --noEmit` and the full
  `npx tsc --noEmit -p tsconfig.json`. If raising the types surfaces **new** errors, they are real
  findings about code written against the old surface — fix them in this pass if they are small, or
  report them as proposed elements if they are not. Do not suppress them and do not widen the pin to
  make them disappear.
- **AC4** — `npm ci` succeeds under **npm 10.9.x**, the npm the pinned `NODE_VERSION` bundles, not only
  under the developer's npm. `bug-056` exists because that distinction was never made; install npm
  10.9.0 into a scratch prefix and use it explicitly. `task-080`'s hoisted `@emnapi` lock entries must
  survive your change — `test/cli/lockfile-peer-overrides.test.ts` goes red if they do not, and
  `bug-063` records that a plain `npm install` under npm 11.x erases them.
- **AC5** — Check whether `bug-046`, `bug-047` and `bug-048` — the rest of the `adr-010` engines
  cascade — are closed, made moot, or untouched by this change. Record the answer for each with the
  command that settles it. Do **not** fix them here unless a change is a one-line consequence of yours;
  if it is, say so explicitly rather than folding it in silently.
- **AC6** — All six gates green.

## Implementation Notes

- Read `task-074-fix-engines-node-floor`'s Execution Notes first (`dl-015` read_related): it raised
  `engines.node` and is the change that made this pin stale.
- `task-001`'s Execution Notes carry the original decision to pin at 18; the new decision should read
  as a deliberate successor to it, not as a drive-by bump.
- `adr-010` is `accepted`; its cascade already touched CLAUDE.md, the product brief, `dna.yaml` and
  `dl-001`. This is the build-side leaf of that same cascade.
- Classify every AC per `dl-014`/T1. Expect characterization: the existing gates are the assertion,
  and a manufactured failing test for a dependency version would be dead weight — say so plainly
  rather than fabricating a red.

## Execution Notes

<!-- filled in per phase -->
