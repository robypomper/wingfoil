---
id: svc-002-npm-organisation-wingfoilhq
type: service
title: "npm organisation wingfoilhq"
status: pending
provider: "npmjs.com"
kind: "account"
owner_role: "approver"
verify: "curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/org/wingfoilhq/package"
url: "https://www.npmjs.com/org/wingfoilhq"
account: "wingfoilhq (owner: robypomper)"
renews: ""
repo_refs: []
decision: "dl-091-package-name-and-mcp-namespace"
release: "v0.2.2"
tmpl_version: 260929
---

## Purpose

The npm scope `@wingfoilhq` for future auxiliary packages; `@wingfoil` belongs to another project,
wingfoil-io (`dl-091` addendum D6; `release-planning-rel-v0.2.2-plan` §A). The main package stays the
unscoped `wingfoil` (`svc-005-npm-package-wingfoil`), so nothing depends on this organisation today:
it is a reservation.

## Configuration

- Created by the approver from the npm account `robypomper`, 2026-09-29
  (`release-planning-rel-v0.2.2-plan` §"External identities registered", §B.2).
- Free organisation, unlimited public packages, so nothing renews (§B.2).
- It holds no package (`https://registry.npmjs.org/-/org/wingfoilhq/package` → `{}`, below).

## Verification

`curl -s -o /dev/null -w '%{http_code}' https://registry.npmjs.org/-/org/wingfoilhq/package` → `200`
(run read-only by `task-124` on 2026-09-29). The body is `{}`: the organisation exists and holds no
package, as read by the visibility session and by the release-planning session on 2026-09-29 (§B.2).

## Management

- **Owner:** the `approver` role; the only owner account recorded is `robypomper`.
- **Renew:** nothing (free).
- **Use:** when an auxiliary package is published under `@wingfoilhq`, record it as its own `service`
  (`kind: listing`) and list it here.
- **Retire:** `memory deprecate`; the `Reason:` says whether the scope was released or replaced.
