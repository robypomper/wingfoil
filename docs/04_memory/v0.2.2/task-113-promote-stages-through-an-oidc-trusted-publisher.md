---
id: "task-113-promote-stages-through-an-oidc-trusted-publisher"
type: task
title: "`promote` stages the tarball through a stage-only OIDC trusted publisher, with no npm token, and every action runs on a supported runtime"
status: in-progress
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
