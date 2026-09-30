---
id: svc-010-github-release-v0.2.1
type: service
title: "GitHub Release v0.2.1"
status: active
provider: "GitHub"
kind: "listing"
owner_role: "approver"
verify: "gh release view v0.2.1 --repo wingfoil/wingfoil --json tagName,name,publishedAt,url,isDraft,isPrerelease && gh release list --repo wingfoil/wingfoil"
url: "https://github.com/wingfoil/wingfoil/releases/tag/v0.2.1"
account: "wingfoil/wingfoil (created by robypomper)"
renews: ""
repo_refs: ["CHANGELOG.md"]
decision: "dl-130-visibility-steps-in-the-release-flow"
release: "v0.2"
tmpl_version: 260929
---

## Purpose

The GitHub Release page of WingFoil's first published version, 0.2.1. A release that reaches npm and
nowhere else is invisible to people who follow the repository (`dl-130` step 1). This element records
the one Release created by hand before `dl-130`'s pipeline step exists.

## Configuration

Created by hand by the approver on 2026-09-29, on the existing tag `v0.2.1`.

- **title:** "v0.2.1 — Project Directives".
- **notes:** the `CHANGELOG.md` section for 0.2.1 plus the full 0.2.0 content, under an introduction
  that carries the install command (`npm install -g wingfoil`, then `wingfoil init`).
- **No Release for `v0.2.0` or `v0.1.0`**, on purpose (`dl-130` Q4 (a)): the `v0.2.0` tag exists but
  0.2.0 never reached npm, and 0.1.0 has no tag and was never published. A Release for a version no user
  can install would advertise something that does not exist.

## Verification

`gh release view v0.2.1 --repo wingfoil/wingfoil --json tagName,name,publishedAt,url,isDraft,isPrerelease`
→ `name` "v0.2.1 — Project Directives", `publishedAt` 2026-09-29T19:23:48Z, `isDraft: false`,
`isPrerelease: false` (read by the agent on 2026-09-29). `gh release list --repo wingfoil/wingfoil` →
the Release is marked **Latest**. The installed `gh` does not accept `isLatest` as a `--json` field,
which is why *Latest* is read from `gh release list`. The approver also read the page on 2026-09-29:
published, with that title.

## Management

From v0.3 on, `dl-130` step 1 creates each Release in the publish pipeline, from `CHANGELOG.md`. This
element covers only the Release backfilled by hand. If its notes ever need editing, they are regenerated
from `CHANGELOG.md`, never edited on the page alone. When a later Release becomes *Latest*, this element
stays `active`: the page still exists. Retire it with `memory deprecate` only if the Release is deleted.
