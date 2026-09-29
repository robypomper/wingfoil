---
id: svc-007-github-actions-secret-npm-token
type: service
title: "GitHub Actions secret NPM_TOKEN"
status: deprecated
provider: "GitHub"
kind: "credential"
owner_role: "approver"
verify: "gh secret list --env npm-publish"
url: ""
account: "environment npm-publish of wingfoil/wingfoil"
renews: "2026-12-27"
repo_refs: []
decision: "dl-087-publish-through-npm-staged-publishing"
release: "v0.2"
tmpl_version: 260929
---

## Purpose

**Recorded to be retired.** The GitHub Actions environment secret that authenticated the v0.2 publish
to npm (`task-061`). Since `task-113` the publish workflow no longer reads it
(`grep -c NPM_TOKEN .github/workflows/publish.yml` → `0`, `task-113` Execution Notes): promotion
authenticates as a trusted publisher over OIDC (`adr-011`). It is registered because it still exists
(Verification), and `adr-011` point 2 removes it once the trusted publisher is configured.

This element holds **no secret value** — only where the secret is held, its type and its expiry.

## Configuration

- **Held in:** GitHub Actions secret `NPM_TOKEN`, environment `npm-publish`, repository
  `wingfoil/wingfoil` (`svc-006-github-environment-npm-publish`). It carried over with the transfer
  (`gh api repos/wingfoil/wingfoil/environments/npm-publish/secrets --jq '.secrets[]|{name,updated_at}'`
  → `NPM_TOKEN`, `2026-09-28T09:25:34Z`, run by `task-116` on 2026-09-29). No repository-level secret of the
  same name exists (`gh secret list` → nothing).
- **Type:** an npm granular token of the **stage-only** type. After `wingfoil@0.2.1` the approver
  revoked the all-packages read-write token the v0.2 publish used and replaced the secret's value with a
  stage-only token; the secret's update time `2026-09-28T09:25:34Z` corroborates the replacement
  (`dl-087`, 2026-09-28 section).
- **Expiry:** the approver's inputs of 2026-09-29 record exactly one granular token on the package:
  created 2026-09-28, never used, expiring **2026-12-27**, read and write, stage only, on `wingfoil`
  alone (`release-planning-rel-v0.2.2-plan` §"Approver inputs received"). That this is the token held
  in the secret is **inferred** (same type, same day, the only token recorded), not verified: GitHub
  never shows a secret's value, and no document states the link. The approver confirms it before
  approving.
- **Consumers:** none in the repository since `task-113` (above).

## Verification

`gh secret list --env npm-publish` → `NPM_TOKEN  2026-09-28T09:25:34Z` (run read-only by `task-124`
on 2026-09-29). The command shows the secret's name and last update, never its value. The token's
type and expiry are checked on npmjs.com (Access Tokens) by the approver.

## Management

- **Retired on 2026-09-29** (`memory deprecate`, `9ad827ad`). The approver revoked the stage-only
  token on npmjs.com, and `task-116` deleted the secret (`gh secret delete NPM_TOKEN --env
  npm-publish -R wingfoil/wingfoil`; then `…/environments/npm-publish/secrets` → `total_count: 0`).
  Its replacement is `svc-009-npm-trusted-publisher-for-wingfoil`, `adr-011` decision point 2. The
  deprecate `Reason:` cites point 5, the approver's registry-side setup that carried it out.

- **Owner:** the `approver` role.
- **Rotate:** not planned: the secret is being retired, not renewed.
- **Retire (`adr-011` point 2):** once the stage-only trusted publisher is configured on npmjs.com,
  revoke the token on npmjs.com, delete the environment secret, then `memory deprecate` this element
  with a `Reason:` naming `adr-011`. The runbook in the header of `.github/workflows/publish.yml`
  (step 4) is the procedure.
- **Deadline:** before 2026-12-27, when the token expires anyway; `task-116`'s post-transfer checks
  expect no `NPM_TOKEN` among the Actions secrets (`release-planning-rel-v0.2.2-plan` §C).
