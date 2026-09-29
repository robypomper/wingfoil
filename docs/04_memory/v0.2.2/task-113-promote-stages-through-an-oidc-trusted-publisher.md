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

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
