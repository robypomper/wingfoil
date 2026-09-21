---
id: "dl-052-verdaccio-started-by-staging-script-in-ci"
type: decision-log
title: "spec-015 §3 says Verdaccio runs as a CI service container; the shipped pipeline starts it from scripts/publish-staging in CI too — amend the spec"
status: ready
context: "dev-loop-review"
release: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

`spec-015-packaging-publishing` §3, stage 2 (`sed -n 77-78p` on `main`, `8a6a091`):

> **stage** — start **Verdaccio** (`npx verdaccio` locally / official image as a CI service on
> `http://localhost:4873`), `npm publish` the packed tarball to it (throwaway auth token).

`task-060-publish-pipeline` (merged `117e95f`) did not use a service container. In CI, as locally,
Verdaccio is started by the staging script itself:

- `.github/workflows/publish.yml` `stage` job has no `services:` block
  (`grep -n 'services:' .github/workflows/publish.yml` → no output); its one staging step is
  `npm run publish:staging -- --tarball dist-pack/*.tgz`.
- `scripts/publish-staging.cjs` `realEffects.startRegistry` (`:197`) writes a **generated** config
  (`verdaccioConfig`, `:62`) in which the package under test has **no uplink** — "so the smoke can
  only ever install the tarball staged by this run — never a same-named package from npmjs" — then
  installs `verdaccio@6` (`VERDACCIO_PACKAGE`, `:37`) into a temp tools prefix and spawns it.

The task's Execution Notes (design point 4, `docs/self/docs/04_memory/v0.2/task-060-publish-pipeline.md`)
give the reason: a GitHub service container starts **before** `actions/checkout`, so "it cannot be given
a repo-controlled config", and it "would make CI take a different code path from the local run". (A
service container would therefore run with whatever config its image ships; whether that default
proxies `wingfoil` to npmjs was not checked here, but the no-uplink property would at least no longer
be under the repository's control.) The divergence is what the specs themselves forbid:

- `adr-009` §3 (`:68-70`): the staging→smoke flow is "a single runnable script … the GitHub Actions job
  merely invokes that script".
- `spec-015` §3's own preamble (`:72`): "the CI job invokes the same `scripts/publish-staging` a
  developer runs locally".

The local half of stage 2 is also inexact: the script does not run `npx verdaccio`; it installs a
major-pinned `verdaccio@6` into a throwaway prefix and runs its bin.

The implementer flagged this as a spec-wording deviation; per the Wave 2 review summary, the independent
reviewer concurred with amending the spec rather than the code.

## Decision

*Approver to choose.*

1. **Amend `spec-015` §3 stage 2** (recommended) to: "start **Verdaccio** from `scripts/publish-staging`
   in both environments — a major-pinned `verdaccio@6` installed into a throwaway prefix, with a generated
   config giving the package under test no uplink — on `http://localhost:4873`". No code change.
2. **Change the pipeline to a service container**, mounting a config after checkout (e.g. restarting
   the container with a workspace volume). Restores the spec's wording at the cost of a CI-only code
   path that `adr-009` §3 rejects, and of a harder local reproduction.
3. **Leave the spec as illustrative.** Cheapest, but it leaves an `approved` spec describing an
   architecture that would weaken the smoke's isolation guarantee if someone followed it.

## Rationale

- The no-uplink config is a correctness property of the smoke, not a convenience: without it, a
  published `wingfoil` of the same version could satisfy the install and mask a broken tarball.
- `adr-009` (`accepted`) outranks the example in `spec-015` on the "one script, both environments"
  question; option 1 makes the two agree with what shipped.
- Option 2 buys nothing the script does not already provide, and costs the local/CI parity that
  `adr-009` chose explicitly to limit CI debugging effort.

## Actions

- Owner **approver**: choose.
- If 1: amend `spec-015` §3 stage 2 in place with a dated Revision note (`dl-047`); no task needed.
- If 2: raise a task against `.github/workflows/publish.yml` and `scripts/publish-staging.cjs`.

Related: `adr-009` §3, `spec-015` §3, `task-060-publish-pipeline`, `dl-056` (the first real staging
run, which exercises this path for the first time), `dl-057` (publish pipeline hardening).
