---
id: "task-108-promote-publishes-an-explicit-tarball-path"
type: task
title: "`promote` publishes `./dist-pack/*.tgz`, an explicit path npm cannot mistake for a git repository, and a test runs the real CI npm on that argv shape before any tag"
status: pending
release: "v0.2"
priority: "high"
tags: ["v0.2", "publishing", "ci", "hotfix"]
ref: "bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo"
bug: ["bug-135-promote-publishes-a-relative-tarball-path-npm-reads-as-a-git-repo"]
depends_on: ["task-060-publish-pipeline", "task-061-publish-secrets", "task-078-publish-pipeline-hardening"]
tmpl_version: 260703
---

## Description

The first real run of `publish.yml` (run `36399049170`, tag `v0.2.0`, 2026-09-28) failed in `promote`
after the approver approved the deployment. The step ran `npm publish dist-pack/*.tgz --provenance
--access public …`, and npm 10.9.0 (the npm bundled with the pinned Node 22.12.0) read
`dist-pack/wingfoil-0.2.0.tgz` as a GitHub `user/repo` shorthand. It then ran `git ls-remote
ssh://git@github.com/dist-pack/wingfoil-0.2.0.tgz.git` and exited 128. Nothing was published.

**This closes `bug-135`.** It is the hotfix the approver ordered for v0.2 on 2026-09-28: the release
ships as **v0.2.1**, and `v0.2.0` stays on the remote as a documented, never-published tag. The version
bump and the CHANGELOG are **not** this task's work; they belong to `release-publishing` Step 3, redone
for 0.2.1.

Two things let the defect through, and this task closes both:
- **The one test that executes the step pinned the broken form.** `test/cli/publish-secrets.test.ts`
  runs the step's script with a fake npm and asserts
  `expect(args).toContain('publish dist-pack/wingfoil-0.2.0.tgz')`, so it certified the argv that npm
  rejects.
- **No test ran a real npm on that argv.** The fake npm cannot parse a package spec. `stage` publishes
  `resolve(tarball)`, an absolute path, and the `promote` step never runs under `act`
  (`if: ${{ !env.ACT }}`).

## Acceptance Criteria

**AC1 — the promote step publishes an explicit path.** `publish.yml`'s step *"Publish the staged
tarball to npm with provenance"* runs `npm publish ./dist-pack/*.tgz` (or an absolute path), with its
other flags unchanged: `--provenance --access public --userconfig "$PWD/.npmrc"`. No other line of the
workflow changes. In particular no `uses:` pin changes: that is `bug-136`, scheduled for v0.3, and
`release-publishing-rel-v0.2-plan` H9 forbids it here.

**AC2 — the fake-npm test pins the fixed form.** In `test/cli/publish-secrets.test.ts`, the assertion
on the npm argv expects the explicit path. Before the change, that test must go red against the fixed
workflow and green against the old one, or the reverse; record which.

**AC3 — a real npm parses the step's argv as a file.** A test takes the tarball argument exactly as the
workflow's step spells it and expands it in a directory holding `dist-pack/wingfoil-<v>.tgz`. It then
runs a real `npm publish <arg> --dry-run --ignore-scripts` with no network or registry dependency (for
example `--offline` and a `localhost` registry, as `publish-pipeline.test.ts` already does for its
dry-run). It asserts that npm treats the argument as a local tarball, not as a git spec, so that
exit 128 or `ls-remote` in the output fails the test.

Run it with the **installed** npm, and state which version that is. **Measure** whether the installed
npm reproduces the bug on the old form. If it does not (a newer npm may parse differently), say so and
decide with evidence whether the test also needs the CI npm (`npm@10.9.0`). Do not assume either way.
A test that cannot fail on the old argv does not close the gap.

**AC4 — nothing else in the pipeline regresses.** These suites stay green: `publish-secrets`,
`publish-pipeline`, `publish-staging`, `check-release-tag`, `e2e-smoke`. The `promote` job stays
checkout-free, stays in `environment: npm-publish`, keeps `set +x` before the token check, and keeps
the transient `.npmrc`. `task-078`'s shell-tracing guard and `task-061`'s secret handling are pinned by
their own tests; do not weaken either.

**AC5 — the six gates, and a reproduction record.** The six gates are green. The Execution Notes carry
the local reproduction: `npx -y npm@10.9.0 publish dist-pack/<tgz> --dry-run` → exit 128, and
`./dist-pack/<tgz>` → `+ wingfoil@…`. Pin the command and the npm version.

## Implementation Notes

- **Classify each AC before writing code (`dl-014`/T1):**
  - AC1, AC2 and AC3 are **red-first**: the old argv must make a test fail;
  - AC4 is **characterization**;
  - AC5 is measurement.
- **Read the Execution Notes of `task-060`, `task-061` and `task-078` before designing (`dl-015`).**
  They built the step, its secret handling and its tracing guard, and their tests encode decisions
  this change must keep.
- **The v0.2.1 tag flow is not this task's.** Do not bump `package.json`, do not edit `CHANGELOG.md`,
  and never create a tag. Those steps are `release-publishing`'s and the approver's.
- **`dl-087`** (`in-discussion`) will later replace this command with `npm stage publish` in v0.3.
  Keep the change minimal, so that the migration starts from a correct command rather than from a
  reshaped one.
- Local reproduction, measured on 2026-09-28 in the `release-publishing` phase:
  `npx -y npm@10.9.0 publish dist-pack/wingfoil-0.2.0.tgz --dry-run --ignore-scripts` → `npm error code
  128` / `ls-remote ssh://git@github.com/dist-pack/…`; with `./dist-pack/…` → `+ wingfoil@0.2.0`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
