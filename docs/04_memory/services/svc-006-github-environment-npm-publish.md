---
id: svc-006-github-environment-npm-publish
type: service
title: "GitHub environment npm-publish"
status: pending
provider: "GitHub"
kind: "setting"
owner_role: "approver"
verify: "gh api repos/robypomper/wingfoil/environments/npm-publish --jq '{name,protection_rules:[.protection_rules[]|{type,reviewers:[.reviewers[]?|.reviewer.login]}],deployment_branch_policy}'"
url: "https://github.com/robypomper/wingfoil/settings/environments"
account: "robypomper/wingfoil"
renews: ""
repo_refs: [".github/workflows/publish.yml"]
decision: "adr-011-npm-staged-publishing-with-oidc"
release: "v0.2"
tmpl_version: 260929
---

## Purpose

The human gate on publishing: `publish.yml`'s `promote` job runs in the GitHub environment
`npm-publish`, so it waits until the environment's required reviewer approves the deployment
(`task-061-publish-secrets`, `adr-006`). `adr-011` point 3 keeps this gate, next to npm's own 2FA
approval of the staged version, for at least the first staged release; a decision-log after the
v0.2.2 publish keeps or drops it. The trusted publisher `adr-011` configures is keyed on this
environment's name.

## Configuration

- Created for v0.2 by `task-061`; the approver configured it per the runbook in the header of
  `.github/workflows/publish.yml` (step A): the approver is its required reviewer and deployments are
  restricted to tags `v*`.
- Protection rules, as read below: `required_reviewers` = `robypomper`; a `branch_policy` with
  `custom_branch_policies: true`, `protected_branches: false`, and one deployment policy of type `tag`,
  name `v*`.
- Environment secret: `NPM_TOKEN` (`svc-007-github-actions-secret-npm-token`), which `adr-011` removes
  once the trusted publisher exists. No other environment secret is listed (`gh secret list --env
  npm-publish`).

## Verification

`gh api repos/robypomper/wingfoil/environments/npm-publish --jq '{name,protection_rules:[…],deployment_branch_policy}'`
→ `name: npm-publish`; rules `branch_policy` and `required_reviewers` (`robypomper`, type `User`);
`deployment_branch_policy: {custom_branch_policies: true, protected_branches: false}`; and
`gh api repos/robypomper/wingfoil/environments/npm-publish/deployment-branch-policies --jq '[.branch_policies[]|{name,type}]'`
→ `[{"name":"v*","type":"tag"}]` (both run read-only by `task-124` on 2026-09-29).

## Management

- **Owner:** the `approver` role, who is also its required reviewer.
- **After the transfer to `wingfoil/wingfoil`:** re-check the environment and its reviewer
  (`release-planning-rel-v0.2.2-plan` §C) and update `url`, `account` and `verify`.
- **When the trusted publisher exists:** delete the `NPM_TOKEN` environment secret (`adr-011` point 2)
  and update Configuration here.
- **Retire:** `memory deprecate` only if the gate is dropped by the decision-log `adr-011` point 3
  calls for, or the publish pipeline changes.
