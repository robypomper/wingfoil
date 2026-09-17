---
id: "task-060-publish-pipeline"
type: task
title: "Publish flow: GitHub Actions CI/CD + ephemeral Verdaccio staging (dl-018 T3)"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ["bug-020-bin-path-autocorrected-at-publish"]
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T3**: implement the publish pipeline per `adr-009` — `prepublishOnly` + `npm publish --dry-run` gate, a local-first `publish:staging` script (Verdaccio) reused as the CI staging smoke, then promote to npm with provenance/OIDC. Implements `spec-015` §2–§4.

## Acceptance Criteria

Per `spec-015` §2–§4 + `adr-009`:
- `prepublishOnly = build && test && lint`.
- `publish:staging` script: publish to ephemeral Verdaccio → `npm install -g wingfoil` from it → run the `dl-023` init+CLI e2e smoke → teardown.
- `.github/workflows/publish.yml`: gate → stage → smoke → promote (provenance via OIDC) on `vX.Y.Z` tag on `main`.
- Document local `act` run to avoid CI-debug commit churn.


**`bug-020` — drop the `./` from `bin.wingfoil` (assigned here, spec-015 §1 amended).** This task wires
`npm publish --dry-run` as the §3 stage-1 CI gate, so it is the task that would otherwise inherit a
permanent warning in every run's log:

```
npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
```

`spec-015` §1 now specifies `bin.wingfoil: dist/cli.js` without the leading `./` (it previously sat
under *Unchanged* in the `./` form, which is why `task-059` correctly declined to touch it). Change
`package.json` to match, and confirm the warning is gone from `npm publish --dry-run` before wiring the
gate — otherwise stage 1 ships with expected noise on day one, which is how `bug-009`'s red lint
baseline stopped meaning anything.

Not a functional fix: `task-059`'s reviewer packed and installed a probe and confirmed the shim works
with either form. It is purely about the gate being readable.
## Implementation Notes

Source: `dl-018` T3; architecture fixed by `adr-009`; contract in `spec-015`; requirement REQ-SYS-09. Reuses the `dl-023` smoke sub-workflow.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Branch `task/task-060-publish-pipeline`, worktree `/home/robypomper/Workspaces/.wf2-wt/task-060-publish-pipeline`
(from `main` @ `79f9fda`). `start` committed `46b13c9` (task `backlog → in-progress`) and `300698c`
(`bug-020` `planned → in-progress`, `bug.sync_state`, dl-045 absorbed bug).

**`agent.read_related` (`dl-015`, HARD gate) — `task-059-publish-metadata` Execution Notes read in full.**
Acknowledged obligations from its "Handoff to task-060 / task-061" section and review findings:

| task-059 handoff item | How this task honours it |
|---|---|
| `publishConfig.provenance: true` applies to *every* publish, incl. the Verdaccio staging publish, which has no OIDC issuer — staging must override it explicitly | the staging publish passes `--provenance=false` (asserted by a unit test on the step list); promote passes `--provenance` explicitly |
| `publishConfig.registry` is prod only; the staging address stays transient (`--registry http://localhost:4873`), written nowhere in git | the staging URL lives only as a constant in `scripts/publish-staging.cjs` and is passed as `--registry`; the throwaway `.npmrc` is written to a temp dir and removed at teardown. Precedence checked, not assumed: `npm publish --dry-run --ignore-scripts --offline --registry http://localhost:4873/ --provenance=false` printed `Publishing to http://localhost:4873/ with tag latest and public access (dry-run)` — the CLI flag wins over `publishConfig.registry` (npm 11.6.2) |
| `--dry-run` never attempts provenance, so it proves nothing about the attestation | recorded as a known limit: nothing in this task can generate an attestation (needs a real OIDC issuer + registry contact, both forbidden here) |
| `<owner>` of `repository.url` derived, needed confirmation before promote attests provenance | now observable: `git remote -v` in this worktree prints `origin git@github.com:robypomper/wingfoil.git`, which matches task-059's derived `robypomper/wingfoil` |
| no `prepublishOnly` / `publish:staging` / `.github/` / `NPM_TOKEN` / `.npmrc` shipped by 059 | §2/§3 are this task; `NPM_TOKEN`/transient prod `.npmrc`/rollback (§5) remain `task-061` — the promote job carries **no** auth wiring |
| finding 2: `bin.wingfoil` `./` warning would land in the stage-1 gate log | absorbed here as `bug-020` (spec-015 §1 amended) — AC5 below |

**Governance acknowledged.** `adr-009` (accepted), `spec-015` (approved) §2–§4 (§1 = task-059, §5 = task-061,
not done here), `dl-018` (ready, T3), `dl-023` (ready — the smoke reused at stage 3; the gate exists only as
`docs/self/.wingfoil/workflows/custom/e2e-smoke.yaml`, there is no executable smoke on `main`:
`grep -rln smoke test src` → only `test/cli/program.integration.test.ts`, whose "smoke" is its own suite),
`bug-020` (absorbed), `bug-022` (read — `npm-distribution.test.ts` packs without `--ignore-scripts`; every
`npm` call this task adds to the test suite passes `--ignore-scripts`, so it does not add a second instance),
`bug-023` (read — see Node version below).

**`agent.verify_specs` — no new tech-spec needed; design passes through.** `spec-015` names every artefact
(`prepublishOnly`, `publish:staging`, `scripts/publish-staging.*`, `.github/workflows/publish.yml`, tag
`vX.Y.Z`). BDD: `grep -rlni "npm\|publish\|verdaccio" docs/02_requirements/02_bdd/features/` → no match
(exit 1), consistent with REQ-SYS-09's traceability note ("no behavioral BDD feature").

**T1 — acceptance-criteria classification.**

| # | AC | Class | Evidence |
|---|---|---|---|
| AC1 | `prepublishOnly = build && test && lint` | red-first | `package.json` `scripts` has no `prepublishOnly` (read above) |
| AC2 | `publish:staging`: Verdaccio → `npm install -g` from it → dl-023 smoke → teardown | red-first | no `publish:staging` script, `ls scripts` → `No such file or directory` |
| AC3 | `.github/workflows/publish.yml` gate → stage → smoke → promote (OIDC provenance) on `vX.Y.Z` tag on `main` (+ spec-015 §4 tag↔version assertion) | red-first | `ls .github` → `No such file or directory` |
| AC4 | document local `act` run | red-first | no workflow file exists to document |
| AC5 | `bin.wingfoil` = `dist/cli.js` (bug-020) + clean `npm publish --dry-run` | red-first | `package.json` has `"wingfoil": "./dist/cli.js"`; the offline dry-run above prints `"bin[wingfoil]" script name dist/cli.js was invalid and removed` |

**Design decisions (architect).**

1. **Local-first script, CommonJS, not shipped.** `scripts/publish-staging.cjs` (orchestration) and
   `scripts/e2e-smoke.cjs` (the dl-023 smoke, usable against any `wingfoil` command: the installed bin
   at staging, `node dist/cli.js` in Jest). Plain Node (no build step — it must run from a bare checkout
   in CI's stage job), `.d.cts` declarations beside them so the Jest suites type-check under the
   `tsc --noEmit` gate. `scripts/` is outside `files`, so nothing here reaches the tarball (the task-059
   exhaustive-allowlist test keeps guarding that).
2. **Effects injectable, orchestration unit-tested offline.** Real Verdaccio/npm effects cannot run in
   tests (they contact a registry); the orchestrator takes its effects as parameters, so ordering,
   the staging-only flags, env scrubbing and teardown-on-failure are asserted without a network.
   The dl-023 smoke itself runs for real in Jest against the compiled `dist/cli.js`.
3. **Clean environment.** Child npm processes get a scrubbed env: every inherited `npm_config_*`
   (injected by `npm run`), `NODE_AUTH_TOKEN` and `NPM_TOKEN` are removed, and `userconfig`/`globalconfig`/
   `cache`/`prefix` point into the run's temp dir — a developer's real token can never reach the staging
   publish, and a cached or globally-installed `wingfoil` can never satisfy the smoke.
4. **Verdaccio started by the script in CI too — deviation from spec-015 §3's parenthetical
   "official image as a CI service".** A GitHub service container starts before `actions/checkout`, so
   it cannot be given a repo-controlled config, and would make CI take a different code path from the
   local run — against `adr-009` §3 ("the GitHub Actions job merely invokes that script") and spec-015
   §3's own preamble ("the CI job invokes the same `scripts/publish-staging` a developer runs locally").
   The script installs a pinned-major `verdaccio@6` into its temp dir and runs it as a direct child.
   The config gives the `wingfoil` package **no uplink** (the smoke can only ever install the tarball
   just staged, never a same-named package from npmjs) while `**` proxies npmjs for dependencies.
   Flagged for the approver as a spec-wording deviation (proposed dl in the final report).
5. **Same tarball end to end.** `gate` packs once and uploads it as an artifact; `stage` feeds that
   file to `publish-staging --tarball`; `promote` publishes that same file. Publishing a *tarball*
   does not re-run lifecycle scripts, so the gate is not re-executed mid-pipeline.
6. **Node version in CI — `22.12.0`, pinned, and `bug-023` is NOT resolved by it.** `engines.node`
   declares `>=18.0.0` but `commander@15` requires `>=22.12.0` (`bug-023`, open, v0.3). CI pins the
   lowest Node every dependency accepts, so the pipeline tests the *effective* floor rather than a
   convenient newer one; it deliberately does **not** run Node 18, and the workflow comment says so and
   cites `bug-023` — the declared `>=18` is untested by this pipeline and remains false until
   `bug-023` lands, which must happen before any real publish.
7. **Promote carries no credentials.** OIDC `id-token: write` is granted to the promote job only; the
   `NPM_TOKEN`/transient `.npmrc` wiring is `spec-015` §5 = `task-061`. Until then a real tag push would
   reach promote and fail `ENEEDAUTH` — safe (nothing publishes). The publish step is also skipped under
   `act` (`!env.ACT`), so a local `act` run can never publish.
