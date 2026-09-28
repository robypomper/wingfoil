---
id: "task-108-promote-publishes-an-explicit-tarball-path"
type: task
title: "`promote` publishes `./dist-pack/*.tgz`, an explicit path npm cannot mistake for a git repository, and a test runs the real CI npm on that argv shape before any tag"
status: done
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

### design — 2026-09-28 (role architect)

Branch `task/task-108-promote-publishes-an-explicit-tarball-path`, worktree `.wf2-wt/task-108`, cut
from `main` at `115fcb63`.

**Governance read (`dl-015`).**
- **`task-060`** wrote the step: `npm publish dist-pack/*.tgz`.
- **`task-061`** kept that argv "unchanged" around the transient `.npmrc`, and introduced the fake-npm
  cases. Its AC1 table lists the four *"promote publish step … executed with a fake npm"* cases. One of
  them asserts `publish dist-pack/wingfoil-0.2.0.tgz`, and none can parse a spec.
- **`task-078`** added `set +x` as the step's first line, the tracing-form assertions, and
  `--userconfig`. Its AC6 established the mutation-proof discipline this task reuses.
- **No tech-spec pins the argv form.** `spec-015` §3 stage 4 says "publish the same tarball"; this
  task changes nothing it states. No spec is missing.

**Measured before red.** A fixture package `wf-fixture@1.0.0` was packed into `dist-pack/`, then
published with `publish <arg> --dry-run --ignore-scripts --offline --registry http://localhost:9/`:

| npm | `dist-pack/wf-fixture-1.0.0.tgz` | `./dist-pack/wf-fixture-1.0.0.tgz` |
|---|---|---|
| installed **11.6.2** | exit **128**, `ls-remote ssh://git@github.com/dist-pack/…` | exit 0, `+ wf-fixture@1.0.0` |
| CI **10.9.0** (`npx -y npm@10.9.0`) | exit **128**, same | exit 0, same |

So **the installed npm reproduces the bug**, and AC3 does not need `npm@10.9.0` (a network fetch in the
test). **`--offline` does not stop the git attempt:** on the old form npm really runs `git ls-remote`
against github.com. A red run of a naive test would therefore touch the network.

**Test shape for AC3.** A stub `git` goes first on `PATH`; it records that it was called and exits 128.
The test:
1. extracts the tarball argument from the workflow step's own `npm publish` line (so the test cannot
   drift from the workflow);
2. expands its glob with bash in a work directory holding a packed fixture;
3. runs the real installed npm offline with `--provenance=false`;
4. asserts exit 0, `+ wf-fixture@1.0.0`, and that the stub `git` was **never** invoked. That last
   assertion is the one that says "npm treated it as a file".

**AC classification (`dl-014`/T1).**

| AC | Class |
|---|---|
| AC1 explicit path in the step | red-first, driven by AC2/AC3 |
| AC2 fake-npm assertion expects the explicit path | red-first |
| AC3 real npm parses the step's argv as a file | red-first; must go red on the old argv, proven at `red` |
| AC4 pipeline suites and step invariants unchanged | characterization |
| AC5 six gates and the reproduction record | measurement; the table above is the reproduction |

### red — `b53fe30f`

`test/cli/publish-secrets.test.ts`:
- **AC2:** the fake-npm case now expects `publish ./dist-pack/wingfoil-0.2.0.tgz`.
- **AC3:** a new `describe` block, *"a real npm reads the tarball argument as a file"*, with the shape
  recorded under *design*.

Result: `npx jest test/cli/publish-secrets.test.ts` → **2 failed, 20 passed**, each for the intended
reason:
- AC2: `Received string: "publish dist-pack/wingfoil-0.2.0.tgz …"`;
- AC3: the stub `git` **was called** (`Expected: false / Received: true`). npm reached for git on the
  old argv, and the stub stopped it before any network.

**AC4 baseline, before any change:** the five pipeline suites (`publish-secrets`, `publish-pipeline`,
`publish-staging`, `check-release-tag`, `e2e-smoke`) → 5 suites, **85** tests passed.

### green — `03f4f8a1`

One line of `.github/workflows/publish.yml`, in the `promote` step *"Publish the staged tarball to npm
with provenance"*: `npm publish dist-pack/*.tgz` → `npm publish ./dist-pack/*.tgz`. The other flags are
unchanged. `git diff` shows one line.

After it, the five pipeline suites give **86/86**: 85 plus the new case.

The `promote` job's invariants are held by their existing tests, all green:
- checkout-free;
- `environment: npm-publish`;
- `set +x` first;
- the literal `${NPM_TOKEN}` `.npmrc`, removed on success and on failure;
- `--userconfig` by absolute path.

No `uses:` line changed (`bug-136`).

**Other occurrences of the old argv:** `grep -rn "publish dist-pack"` finds only historical records
(`dl-068` Context, `task-061` Execution Notes, the v0.2 plans) and this task's own comments. Those
describe what the file said at the time. No spec pins the argv.

### refactor — `6e7b6e43`

The first full run found one failure: `test/lint/pack-ignore-scripts.test.ts` (`bug-022`'s guard)
flagged the fixture's `npm pack` without `--ignore-scripts`. The fixture has no scripts, but the rule is
uniform, so the flag was added.

**Mutation check after that change.** The old argv was restored in `publish.yml`: both the AC2 and AC3
cases go red (**2 failed, 20 passed**). Then `git checkout .github/workflows/publish.yml` restores the
fixed line, and the file is back at **22/22**.

**Six gates**, on this branch after `6e7b6e43`:
- `npx jest --coverage` exit 0: **149 suites / 2418 tests**, 98.58 / 94.03 / 98.94 / 99.41, the same
  as `main`;
- `tsc -p tsconfig.build.json --noEmit` exit 0;
- `tsc --noEmit -p tsconfig.json` exit 0;
- `npm run lint` exit 0;
- `npm run docs:api` exit 0.

**AC5, the reproduction:** see the table under *design*. With `wf-fixture@1.0.0`, both npm 11.6.2 and
`npx -y npm@10.9.0` give exit 128 with `ls-remote ssh://git@github.com/dist-pack/…` on the old argv, and
`+ wf-fixture@1.0.0` with `./`.

**Not done here, by the ACs:** the `package.json` bump, `CHANGELOG.md` and any tag. They belong to
`release-publishing` (v0.2.1) and to the approver.

**What remains unproven until the next real run:** the dry-run proves npm parses the argument as a
file. The actual registry publish with provenance can only be exercised by the `v0.2.1` tag, because
`promote` does not run under `act`.
