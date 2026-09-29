---
id: svc-001-github-organisation-wingfoil
type: service
title: "GitHub organisation wingfoil"
status: pending
provider: "GitHub"
kind: "account"
owner_role: "approver"
verify: "gh api orgs/wingfoil --jq .login"
url: "https://github.com/wingfoil"
account: "wingfoil (owner: robypomper)"
renews: ""
repo_refs: []
decision: "dl-091-package-name-and-mcp-namespace"
release: "v0.2.2"
tmpl_version: 260929
---

## Purpose

The organisation that will own the canonical repository after the transfer
`robypomper/wingfoil → wingfoil/wingfoil` (`dl-091` addendum D5; `release-planning-rel-v0.2.2-plan`
§C), the MCP Registry namespace `io.github.wingfoil` (`dl-093`) and GitHub Pages. Without it the
namespace `io.github.wingfoil/wingfoil` cannot be claimed and `adr-011`'s trusted publisher, keyed on
organisation `wingfoil`, has no owner to point at.

## Configuration

- Created by the approver from the GitHub account `robypomper`, 2026-09-29 11:05 UTC
  (`release-planning-rel-v0.2.2-plan` §"External identities registered"; `created_at:
  2026-09-29T11:05:14Z` there). Free plan, so nothing renews (`renews: ""`, §B.1).
- Settings the visibility session recommended (§B.1), and what `gh api orgs/wingfoil` returns for
  them (read-only, `task-124`, 2026-09-29):
  - require 2FA → `two_factor_requirement_enabled: true` (applied);
  - base permission "No permission" → `default_repository_permission: "none"` (applied);
  - profile name "WingFoil" with the category line → `name: "wingFoil"`: **the capitalisation differs
    from the recommendation**, for the approver to confirm or correct. The category line was not read.
- No repository lives under it yet: the transfer is the approver's last identity step, before the
  v0.2.2 publish (`task-116-repository-slug-follows-the-transfer`).

## Verification

`gh api orgs/wingfoil --jq .login` → `wingfoil` (run read-only by `task-124` on 2026-09-29, exit 0).
The settings above are read with
`gh api orgs/wingfoil --jq '{login,name,created_at,two_factor_requirement_enabled,default_repository_permission}'`
→ `created_at: 2026-09-29T11:05:14Z`, `name: wingFoil`, `two_factor_requirement_enabled: true`,
`default_repository_permission: none` (same run).

## Management

- **Owner:** the `approver` role; the only owner account recorded is `robypomper`.
- **Renew:** nothing (free plan).
- **Recover:** through the owner account; if more owners are added, record them here (public logins
  only).
- **After the transfer:** add `wingfoil/wingfoil` to Configuration and the Claude GitHub App
  installation on the organisation, which `release-planning-rel-v0.2.2-plan` §C lists among the
  post-transfer re-checks.
- **Retire:** `memory deprecate` with a `Reason:` naming what replaced it.
