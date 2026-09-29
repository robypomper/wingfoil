---
id: "task-113-promote-stages-through-an-oidc-trusted-publisher"
type: task
title: "`promote` stages the tarball through a stage-only OIDC trusted publisher, with no npm token, and every action runs on a supported runtime"
status: in-review
release: "v0.2.2"
priority: "high"
tags: ["v0.2.2", "publishing", "ci", "security"]
ref: "adr-011-npm-staged-publishing-with-oidc"
bug: ["bug-136-publish-workflow-pins-actions-that-target-node-20"]
depends_on: ["task-111-configuration-moves-to-the-repository-root"]
tmpl_version: 260703
---

## Description

The next publish fails under the current pipeline. The only credential left is a stage-only token,
and `promote` still runs `npm publish` (`dl-087`). `adr-011` (`accepted`, `cdf286d4`) fixes the
architecture, and `spec-015` §3 stage 4 and §5, amended on 2026-09-29, fix the file-level contract:

- promotion is `npm stage publish` with provenance;
- authentication is a trusted publisher over GitHub OIDC, limited to staging;
- there is no `NPM_TOKEN` and no `.npmrc`;
- a maintainer's 2FA approval on npm makes the version live;
- `promote` alone runs **Node ≥ 24.18.0**, the oldest Node that bundles an npm ≥ 11.15.0;
- `gate` and `stage` stay on the 22.12.0 floor.

The same workflow runs every `actions/*` pin on a Node 20 release, a runtime GitHub removed from its
runners on 2026-09-23 (`bug-136`). This closes `bug-136` and delivers `dl-087` Actions 3, 4 and 6.

## Acceptance Criteria

1. `promote` runs `npm stage publish` on the same tarball with provenance. It has `id-token: write`,
   reads no secret and writes no `.npmrc`. `NPM_TOKEN` appears nowhere in the workflow.
   *Red-first:* `test/cli/publish-secrets.test.ts` and `publish-pipeline.test.ts` pin the new step
   and the absence of the token.
2. `promote` pins an exact Node ≥ 24.18.0. `gate` and `stage` keep `env.NODE_VERSION: '22.12.0'`. The
   workflow header explains the asymmetry (`adr-011` point 4).
3. Every `uses:` is pinned by SHA to a release whose `runs.using` is a Node runtime the hosted runners
   ship. The tag it came from goes in the trailing comment, and the source of each runtime is recorded
   in Execution Notes (`bug-136`, `spec-015` §3).
4. Whether `npm stage publish` accepts `--access public`, or takes it only from `publishConfig`, is
   settled with the npm the job runs (`npm stage publish --help`, or a documented source). The result
   is recorded in `dl-068` Action 4 (`adr-011`, *Consequences*).
5. The approver's runbook in the workflow header states the registry-side steps and their order:
   - account 2FA;
   - after the repository transfer, the trusted publisher on `wingfoil`/`wingfoil`/`publish.yml`/
     `npm-publish`, stage only;
   - publishing access set to "require 2FA and disallow tokens";
   - revoking the stage-only token and deleting the secret;
   - `npm stage view` then `npm stage approve`.
6. `release-publishing.yaml`'s `publish` phase gains the npm approval step after the tag's pipeline
   run (`dl-087` Action 3).
7. `dl-057` item (e) is closed with a pointer to `dl-087` and `adr-011` (`dl-087` Action 6).
8. The workflow is exercised locally with `act` as far as `act` allows, and what could not be
   exercised is listed. OIDC and the npm approval can only be proven by the v0.2.2 publish itself.
9. `npm test` green.

## Implementation Notes

- The trusted publisher can be configured only after the transfer (`task-116`). Until then the
  pipeline cannot promote. That is expected, and v0.2.2's `release-publishing` depends on both tasks.

## Execution Notes

Branch `task/task-113-promote-stages-through-an-oidc-trusted-publisher`, worktree
`../.wf2-wt/task-113`, cut from `main` at `c3df9df3`. The configuration is at the root since
`task-111`, so the Memory transitions below are commits in the §5.1 format on this branch.

### design (architect)

**Contracts (`grep -m1 '^status:'`).** `adr-011-npm-staged-publishing-with-oidc` → `accepted`;
`spec-015-packaging-publishing` → `approved` (§3 stage 4 and §5 carry the 2026-09-29 amendment);
`dl-087` → `ready`; `dl-057` and `dl-068` → `ready` (edited here as content, no state change). No
tech-spec is missing: `spec-015` §3/§5 is the file-level contract of every AC, so none is scaffolded
and the design approval is a pass-through.

**`depends_on` read (dl-015).** `task-111` is `done` (`grep -m1 '^status:'`; `5f0e9052` `wf(task): finalize … [approved → done]`
is on `main`). What this task takes from its Execution Notes:
- the configuration and the Memory are at the root (`.wingfoil/`, `docs/04_memory/`), so the two
  files this task owns are `.github/workflows/publish.yml` and
  `.wingfoil/workflows/custom/release-publishing.yaml`, and every path cited here is a root path;
- its AC 5 hand-off list (`CLAUDE.md` §3/§5.1 staleness, left to `align-agent-docs`) touches nothing
  here;
- its refactor rule for config files: a comment or path correction bumps no `version:`. This task
  changes `release-publishing.yaml`'s *behaviour* (a new phase step), so that file's `version`
  is bumped under `doc-versioning` — the first edit after it was committed.

**Design.**
- `promote` keeps `environment: npm-publish` and `permissions: {contents: read, id-token: write}`,
  loses its `env: NPM_TOKEN`, the token guard, the `.npmrc` and the `trap`, and runs
  `npm stage publish ./dist-pack/*.tgz --provenance --access public`. The explicit `./` of
  `task-108` (`bug-135`) stays. `if: ${{ !env.ACT }}` stays, so a local `act` run can never stage.
- `promote`'s `setup-node` takes a job-level `env.PROMOTE_NODE_VERSION`, an exact Node ≥ 24.18.0;
  `gate` and `stage` keep `env.NODE_VERSION: '22.12.0'`.
- Every `actions/*` pin moves to the latest release of that action whose `action.yml` `runs.using`
  is `node24` (lookups in *green*).
- The `set +x` rule of `task-078` (`dl-057` f) is kept as the step's first command: there is no
  secret to leak any more, but the tests that forbid tracing cost nothing and would matter again if a
  credential ever came back.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — `npm stage publish`, no token, no `.npmrc` | **red-first** | today the step runs `npm publish` with `secrets.NPM_TOKEN` and a transient `.npmrc` |
| 2 — `promote` on Node ≥ 24.18.0, the others on 22.12.0 | **red-first** | today all three jobs read `env.NODE_VERSION` |
| 3 — node24 pins by SHA, tag comment, recorded source | **red-first** (pin form + table) | today the four pins are v4 releases (`runs.using: node20`); the runtime itself is established by `gh api`, recorded below, because a test cannot read `action.yml` offline |
| 4 — `--access public` with the job's npm | verification | settled with `npm stage publish --help` and a dry run, recorded in `dl-068` Action 4 |
| 5 — approver runbook | **red-first** (text contract) | the header's runbook today describes `NPM_TOKEN` provisioning and rotation; the suite pins the new steps |
| 6 — `release-publishing.yaml` npm approval step | configuration | no runtime reads the step text; the file is checked by the workflow schema suite (characterization) |
| 7 — `dl-057` (e) closed | documentation | no behaviour |
| 8 — `act` | verification | `act` is not installed (`which act` → nothing); what could not be exercised is listed |
| 9 — `npm test` green | verification | gate below |

### red (developer) — `1707fc3e`, `ff99b74b`

`test/cli/publish-secrets.test.ts` is rewritten around the stage step (the task-061 token suite
goes: its subject no longer exists) and `test/cli/publish-pipeline.test.ts` gains the Node split,
the `package-manager-cache` rule and an action-pin table. Baseline before editing, at `ae06981d`:
`npx jest test/cli/publish-secrets.test.ts test/cli/publish-pipeline.test.ts` → **37 passed**.
After: **19 failed, 27 passed** (46), every failure an assertion on the old workflow — `npm publish`
instead of `npm stage publish`, `secrets.NPM_TOKEN` read, the token named in the header, `.npmrc`
written, all jobs on `NODE_VERSION`, v4 pins (`node20`), no `package-manager-cache`, the old
runbook. The one new test that passed at once, "finds the four actions the pipeline uses", is a
characterization of the set of actions, which does not change. `ff99b74b` narrows the runbook-order
assertion to the runbook block (from `Approver runbook` to `Rollback posture`), because the header
names the trusted publisher before the runbook starts; still red.

The `task-108` real-npm test (`bug-135`) stays a `npm publish --dry-run`: the local npm is 11.6.2
(`npm -v`), which has no `stage` command, and `stage publish` parses its spec as `publish` does —
npm 11.19.0's `lib/commands/stage/publish.js` is `class StagePublish extends Publish`,
`static params = Publish.params`, `static stage = true` (read from `npm pack npm@11.19.0`, extracted
in the session scratchpad). The test reads the argument from the `npm stage publish` line.

### green (developer) — `1492f40a`, `062ec312`, `559e7749`, `0fffd1c8`

**AC 1.** `promote`: no `env`, no secret, no `.npmrc`, no guard; the step is `set +x`, `npm --version`
(so the run log records the npm it staged with), `npm stage publish ./dist-pack/*.tgz --provenance
--access public`, still `if: ${{ !env.ACT }}`. `grep -c NPM_TOKEN .github/workflows/publish.yml` → 0;
`grep -c 'secrets\.' .github/workflows/publish.yml` → 0.

**AC 2.** `jobs.promote.env.PROMOTE_NODE_VERSION: '24.21.0'`; `gate`/`stage` keep
`${{ env.NODE_VERSION }}` = `'22.12.0'`. Source, `curl -s https://nodejs.org/dist/index.json`
(2026-09-29): v24.21.0 → npm 11.19.0 (latest 24.x); v24.18.0 → npm 11.16.0, the oldest release
whose npm is ≥ 11.15.0; v24.18.1 is a `security: true` release after it; the latest 22.x, v22.23.3,
bundles npm 10.9.9, and no v22 bundles npm 11; v22.12.0 bundles npm 10.9.0. **Deviation for the
approver:** the pin is 24.21.0, not the 24.18.0 floor `adr-011` names, so that `promote` does not
start on a release older than a published security fix; the header says why. Any 24.x ≥ 24.18.0
satisfies AC 2 and the test (`major > 24 || (24 && minor ≥ 18)`).

**AC 3 — action pins.** Each is the action's `releases/latest`, whose `action.yml` declares `node24`:

| Action | Tag | SHA | `runs.using` |
|---|---|---|---|
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` | `node24` |
| `actions/setup-node` | `v7.0.0` | `820762786026740c76f36085b0efc47a31fe5020` | `node24` |
| `actions/upload-artifact` | `v7.0.1` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | `node24` |
| `actions/download-artifact` | `v8.0.1` | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | `node24` |

Sources, per action `a` and tag `t`: `gh api repos/actions/$a/releases/latest --jq .tag_name`;
`gh api repos/actions/$a/git/ref/tags/$t --jq '.object.type + " " + .object.sha'` → `commit <sha>`
(all four are lightweight tags on a commit); `git ls-remote https://github.com/actions/$a
refs/tags/$t` → the same SHA; `gh api "repos/actions/$a/contents/action.yml?ref=$t" --jq .content |
base64 -d` → `runs: using: node24`. Behaviour changes between v4 and these majors, read from each
repository's `releases` notes: checkout v6 persists credentials to a separate file (every checkout
here sets `persist-credentials: false`); setup-node v5 turns on caching by itself when
`package.json` names a package manager (v6 limits that to npm), so every setup-node step now sets
`package-manager-cache: false` — `package.json` has no `packageManager` field today
(`node -e 'console.log(require("./package.json").packageManager)'` → `undefined`), so this changes
nothing now and keeps it that way; setup-node v7 no longer exports a dummy `NODE_AUTH_TOKEN`;
download-artifact v5 changed the output path only for downloads *by id* (here: by name), and v8
fails on a digest mismatch by default; upload-artifact v7 adds opt-in unzipped uploads (default
unchanged). The v5+ majors need runner ≥ 2.327.1, which the hosted `ubuntu-24.04` runners are
expected to satisfy (not verified here).

**AC 4.** Settled, recorded in `dl-068` Action 4: `npm stage publish` accepts `--access public`,
and also takes `access` from `publishConfig`; the flag wins. Commands: `npx -y -p npm@latest npm
stage publish --help` (npm 12.1.0) and `node <npm@11.19.0>/bin/npm-cli.js stage publish --help` both
list `[--access <restricted|public|private>]`; an offline `--dry-run` of a fixture tarball with
`publishConfig.access: public` prints `... with tag latest and public access (dry-run)` with no
flag and with `--access public`, `... restricted access` with `--access restricted`. npm 11.19.0 is
what Node 24.21.0 bundles; it ran under the local Node 22.21.0 with an `EBADENGINE` warning (it
declares `^22.22.2 || ^24.15.0 || >=26.0.0`), which does not bear on argument parsing.

**AC 5.** The header's runbook: GitHub side (A, the `npm-publish` environment, kept), then npm side
in order — 1 account 2FA, 2 the trusted publisher on `wingfoil`/`wingfoil`/`publish.yml`/
`npm-publish` limited to staging, after `task-116`'s transfer, 3 publishing access "Require
two-factor authentication and disallow tokens", 4 revoke the stage-only token and delete the
environment secret — then per release 5 the deployment approval and 6 `npm stage list` / `view` /
`approve` (or `reject`). The secret is named by `gh secret list --env npm-publish`, not spelled,
because AC 1 forbids the token's name anywhere in the workflow.

**AC 6.** `release-publishing.yaml` → v1.1 (`doc-versioning`, first edit since it was committed):
the `publish` phase describes the staged pipeline and gains
`approver.execute("npm stage approve <stage-id>")` after the pipeline run, an `approval:
{ by_role: approver }` covering both gates, and a post-check "staged version approved on npm and
live". `approver.execute` is a new free-form action token — actions are free-form strings
(`src/workflow/schema.ts`, `Actions`), and no existing token names a human act outside `approval:`.
`node dist/cli.js workflow list` lists `release-publishing` (exit 0) after the edit.

**AC 7.** `dl-057` (e) carries a dated *Closed* note pointing at `dl-087` and `adr-011`. DLs have
no `version` field (`grep -c '^version' docs/04_memory/design/dls/dl-057-*.md` → 0), so none is
bumped; no state change.

Also changed, because this task made the sentence false: `security-secrets.md`'s last paragraph
pointed at "the GitHub Actions `npm-publish` environment secret" as WingFoil's publish credential;
it now says the publish holds none (`0fffd1c8`). The directive has no `version` field.

### refactor (developer)

No code to restructure: the change is a workflow, a workflow config and prose. Checks at `0fffd1c8`
(before merging `main`):
- `npx jest --coverage` → **153 suites, 2501 tests passed**; coverage Statements 98.66 %
  (3392/3438), Branches 94.25 % (1789/1898), Functions 98.98 % (584/590), Lines 99.46 % (3000/3016)
  — identical to the baseline run at `ae06981d`, as expected: no `src/` file changed
  (`git diff --stat c3df9df3 0fffd1c8 -- src` → nothing). That baseline run reported one failed
  suite, `publish-secrets`, because the file was being rewritten while it ran; the suite at
  `ae06981d` was re-run alone → 37 passed.
  That run's suite count is not explained: `npx jest --listTests | wc -l` → 152, and
  `git ls-tree -r --name-only 0fffd1c8 test | grep -c '\.test\.ts$'` → 152; both runs after the
  merge below report 152. Reported, not chased: the number of tracked test files is 152 before and
  after the merge.
- `npm run lint` → exit 0; `npm run docs:api` → exit 0; `npx tsc --noEmit` → exit 0.
- The workflow parses: `node -e 'require("js-yaml").load(fs.readFileSync(".github/workflows/publish.yml"))'`
  → jobs `gate, stage, promote`, `promote.env = {PROMOTE_NODE_VERSION: '24.21.0'}`.

**AC 8 — `act`.** Not run. `which act` → nothing; no `act` binary anywhere
(`find / -xdev -type f -name act -perm -u+x` → nothing; no `gh act` extension). Installing or
downloading it was out of this task's remit, so nothing of the workflow ran under `act`. The
runner image `catthehacker/ubuntu:act-24.04` is present in the local docker, so a machine with `act`
can run the header's commands as written. What was exercised instead: the promote step's script,
run by bash with a fake `npm` (`publish-secrets.test.ts`); its tarball argument, parsed by a real
npm; `npm stage publish` argument handling, by a dry run (AC 4); the `gate` commands through
`npm test`, `npm run lint`, `npm run build`. **Not exercised by anything here:** the four new
action majors on a runner; `setup-node` installing 24.21.0; the GitHub `npm-publish` environment
prompt (`act` ignores `environment:` anyway, `dl-068` E6); the OIDC token exchange with npm; the
trusted publisher; provenance; the stage queue; `npm stage approve` with 2FA. Those are proven only
by the v0.2.2 tag run itself.

### review (reviewer)

`main` advanced while this ran (`task-121` merged, `bug-160` filed); merged with `git merge main`
→ `b79f6b65` (no conflict; `git diff --stat 0fffd1c8 b79f6b65 -- test .github .wingfoil/workflows`
→ nothing). After the merge: `npx jest` → **152 suites, 2481 tests passed**; `npx jest --coverage`
→ 152 / 2481 passed, Statements 98.66 % (3392/3438), Branches 94.25 % (1789/1898), Functions
98.98 % (584/590), Lines 99.46 % (3000/3016) — unchanged from the baseline. BDD: no `.feature`
covers the publish pipeline (`grep -rln "publish" docs/02_requirements/02_bdd/features/` → nothing);
the acceptance tests are the two suites `dl-087` Action 4 names, green above.

Checklist against the ACs: 1 ✔ (red → green, `grep` counts above); 2 ✔ (24.21.0, see deviation);
3 ✔ (table); 4 ✔ (`dl-068` Action 4); 5 ✔ (runbook order pinned by the suite); 6 ✔ (v1.1);
7 ✔; 8 — `act` not available, listed above; 9 ✔.

**For the approver.**
- The Node pin is 24.21.0 rather than 24.18.0 (AC 2 deviation, reason above); `adr-011` point 4 and
  `spec-015` §3 say "≥ 24.18.0", so neither needs an amendment.
- `approver.execute(...)` is a new action token in `release-publishing.yaml` (AC 6).
- `package-manager-cache: false` on every `setup-node` is an addition no AC asked for; it keeps
  the new setup-node majors from caching by themselves.
- The registry-side steps are yours, in the header's order: account 2FA; after the transfer
  (`task-116`), the trusted publisher `wingfoil`/`wingfoil`/`publish.yml`/`npm-publish`, stage only;
  publishing access "Require two-factor authentication and disallow tokens"; revoke the stage-only
  token and `gh secret delete <name> --env npm-publish`. Until the trusted publisher exists, a tag
  run fails at `promote` (expected; the Implementation Notes).

**Second merge of `main`, after the submit.** `main` moved again (`task-122` and `task-123` merged)
and the submit commit `dff98406` went in before this was noticed; merged at `54ff1312` (no conflict,
none of this task's files touched by it) and every check re-run there: `npx jest --coverage` →
**154 suites, 2500 tests passed**, Statements 98.62 % (3874/3928), Branches 94.18 % (1993/2116),
Functions 93.79 % (650/693), Lines 99.47 % (3398/3416). The drop in Functions is `task-122`'s
wider `collectCoverageFrom` (index files with logic now measured), not this task: no `src/` file is
changed here (`git diff --stat main...HEAD -- src` → nothing). `npm run lint`, `npx tsc --noEmit`,
`npm run docs:api` → exit 0.
