---
id: "bug-048-ci-node-version-fails-eslint-engines"
type: bug
title: "CI's pinned NODE_VERSION 22.12.0 does not satisfy eslint@10.6.0 / @eslint/js@10.0.1, so the publish gate installs with EBADENGINE warnings"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: ""
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`.github/workflows/publish.yml:78` pins `NODE_VERSION: '22.12.0'`, chosen as "the lowest version every
dependency accepts". Two **dev** dependencies do not accept it: `eslint@10.6.0` and `@eslint/js@10.0.1`
both declare `engines.node` `^20.19.0 || ^22.13.0 || >=24`, which excludes 22.12.0 by one minor. The
gate job's `npm ci` therefore emits `EBADENGINE` warnings on every release run, and the workflow's own
comment claiming 22.12.0 satisfies everything is false.

## Steps to Reproduce

Measured 2026-09-21 in a clean worktree of `main` at `bcc66a9`, after `npm ci` (exit 0). Local
runtime is `node v22.21.0`, so the warnings are **not** observable locally — the ranges are evaluated
against the *installed tree*, which is what is measured below.

1. Read the pin and the claim:

```
$ grep -n "NODE_VERSION\|node-version" .github/workflows/publish.yml
45:# Node version: pinned once in `env.NODE_VERSION` to 22.12.0 — the lowest version every dependency accepts
78:  NODE_VERSION: '22.12.0'
91:          node-version: ${{ env.NODE_VERSION }}     # gate
123:          node-version: ${{ env.NODE_VERSION }}     # stage
141:          node-version: ${{ env.NODE_VERSION }}     # promote
```

2. Read the ranges from the installed manifests and evaluate 22.12.0 against each:

```
$ node -e 'for (const p of ["eslint","@eslint/js","typescript","jest","typedoc","typescript-eslint","ts-jest"])
            console.log(p + " -> " + require(path.resolve("node_modules",p,"package.json")).engines.node)'
eslint@10.6.0            ^20.19.0 || ^22.13.0 || >=24
@eslint/js@10.0.1        ^20.19.0 || ^22.13.0 || >=24
jest@30.4.2              ^18.14.0 || ^20.0.0 || ^22.0.0 || >=24.0.0
typescript@6.0.3         >=14.17
typedoc@0.28.20          >= 18
typescript-eslint@8.62.1 ^18.18.0 || ^20.9.0 || >=21.1.0
ts-jest@29.4.11          ^14.15.0 || ^16.10.0 || ^18.0.0 || >=20.0.0

$ node -e 'semver.satisfies("22.12.0", <each range above>)'
FAIL   eslint@10.6.0               ^20.19.0 || ^22.13.0 || >=24
FAIL   @eslint/js@10.0.1           ^20.19.0 || ^22.13.0 || >=24
OK     jest@30.4.2
OK     typescript@6.0.3
OK     typedoc@0.28.20
OK     typescript-eslint@8.62.1
OK     ts-jest@29.4.11
OK     commander@15.0.0            >=22.12.0        (exactly satisfied — the reason 22.12.0 was chosen)
OK     @hono/node-server@1.19.14   >=18.14.1
```

`^22.13.0` is `>=22.13.0 <23.0.0`; `22.12.0 < 22.13.0`, so the whole union is unsatisfied. The miss is
**one minor version**.

3. Confirm the consequence is a warning, not a failure, and that `npm ci` is where it surfaces.
   Reproduced with a throwaway devDependency declaring `engines.node >=99.0.0`:

```
$ npm ci                    # devDependencies included by default
ci exit=0
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: 'wf-engine-probe@1.0.0',
npm warn EBADENGINE   required: { node: '>=99.0.0' },
npm warn EBADENGINE   current: { node: 'v22.21.0', npm: '11.6.2' }
npm warn EBADENGINE }
$ npm ci --omit=dev
exit=0, EBADENGINE occurrences: 0
```

## Expected Behavior

The CI runtime satisfies every dependency it installs, and `publish.yml:45`'s claim that 22.12.0 is
"the lowest version every dependency accepts" is true.

## Actual Behavior

`eslint` and `@eslint/js` are unsatisfied by one minor. The gate job installs them anyway with
`EBADENGINE` warnings, and the comment overstates the pin's correctness.

## Notes

### Scope: the gate job only — a received framing corrected

This was raised as "every publish.yml job emits EBADENGINE for them". Checked against the three job
bodies (`publish.yml:82-160`), that is **not** the case:

- **`gate`** (`:82`) — `actions/checkout` + `setup-node` + **`npm ci`** (`:99`) + `npm run
  prepublishOnly` (build/test/**lint**). This is the only job that installs devDependencies, so it is
  the only one that can warn. It also *runs* eslint, on a Node the eslint authors exclude.
- **`stage`** (`:114`) — checkout + `setup-node` + `download-artifact` + `npm run publish:staging`.
  No `npm ci`, no devDependency install in this repository's tree.
- **`promote`** (`:131`) — `setup-node` + `download-artifact` + `npm publish` of the prebuilt tarball.
  **No checkout at all**, so there is nothing to install.

`grep -rn "npm ci" .github/ scripts/ package.json` returns exactly one invocation, `publish.yml:99`.
So the blast radius is one job, not three.

### Why it is low severity

- `EBADENGINE` is a **warning** by default; npm installs and the command works (step 3, and
  `adr-010-node-22-runtime-floor` E4 for the global-install case). It becomes a hard failure only
  under `--engine-strict` / `engine-strict=true`, which nothing in this repository sets
  (no `.npmrc` is committed).
- The affected packages are **dev-only** lint tooling. They are not in the production closure, are not
  in the published tarball (`files: ["dist", "README.md"]`), and cannot reach a consumer.
- Nothing is currently broken: the pipeline has never run (`dl-056-first-real-publishing-run`;
  `dl-068-publishing-requires-public-repository` records that `origin` is empty), so no run has yet
  emitted these warnings.

### Why it is worth filing anyway

The gate is a gate. `spec-015` §3 stage 1 makes `npm ci` + `prepublishOnly` + `npm publish --dry-run`
the pre-publish check, and `spec-015` §1's amendment for `bug-020` already argued the principle: "a
gate whose output carries permanent expected noise is a gate people stop reading." Two permanent
`EBADENGINE` blocks on every release run are exactly that noise. Separately, running eslint on a Node
its own authors exclude is not a configuration anyone chose — it is a side effect of picking the
minimum that `commander@15` accepts.

### Fix shape — do NOT apply as part of this report

Two candidates, both cheap; the choice interacts with `adr-010`:

1. **Raise `NODE_VERSION` to `22.13.0`** (or a later 22.x). It still satisfies `commander@15`'s
   `>=22.12.0` and clears both eslint ranges. Note this makes CI's runtime *higher* than the declared
   `engines.node` floor `adr-010` sets at `>=22.12.0` — which is fine (CI need not run the minimum),
   but if the intent is "CI runs the declared minimum", then `adr-010`'s floor and this pin have to be
   reconciled deliberately rather than by accident. `bug-047` is the neighbouring gap about what the
   floor is allowed to be.
2. **Correct the comment at `:45`** to say 22.12.0 is the lowest version every **production**
   dependency accepts, and that dev tooling warns. Cheaper, and honest, but leaves the noise.

Owner: publish-pipeline ground — `task-060-publish-pipeline` (`done`) built the file;
`task-078-publish-pipeline-hardening` (`backlog`, `v0.2`) is the natural carrier.

Severity **low**: warning only, dev-only packages, nothing published is affected, and no run has yet
occurred.

## Triage & Execution Notes

Raised during the v0.2 release-governance ingest (2026-09-21), from the review of
`task-074-fix-engines-node-floor` (`backlog`). Filed unfixed per the ingest plan — the agent stops at
`open`.

The EBADENGINE **behaviour** (warn + install, exit 0; suppressed under `--omit=dev`) was measured with
a throwaway probe package, not assumed. The eslint/22.12.0 mismatch itself was computed with `semver`
against the ranges read from the installed manifests — it could **not** be observed directly, because
no Node 22.12.0 runtime was available here; the local runtime is 22.21.0, which satisfies `^22.13.0`.
Whoever fixes this should confirm the warnings on a real 22.12.0 runner before and after.

Related: `adr-010-node-22-runtime-floor` (`pending`, sets the declared floor at 22.12.0),
`bug-023-engines-node-floor-contradicts-commander` (`planned`, why 22.12.0 was chosen),
`bug-047-engines-guard-asserts-satisfies-not-equals` (what the floor is allowed to be),
`task-060-publish-pipeline` (`done`), `task-078-publish-pipeline-hardening` (`backlog`),
`bug-020-bin-path-autocorrected-at-publish` (the gate-noise principle),
`spec-015-packaging-publishing` §3 stage 1, `.github/workflows/publish.yml` `:45`, `:78`, `:99`.
