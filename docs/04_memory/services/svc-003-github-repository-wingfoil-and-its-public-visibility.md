---
id: svc-003-github-repository-wingfoil-and-its-public-visibility
type: service
title: "GitHub repository wingfoil and its public visibility"
status: active
provider: "GitHub"
kind: "setting"
owner_role: "approver"
verify: "gh api repos/wingfoil/wingfoil --jq '{full_name,visibility,private,license:.license.spdx_id}'"
url: "https://github.com/wingfoil/wingfoil"
account: "wingfoil/wingfoil"
renews: ""
repo_refs: ["package.json", ".github/workflows/publish.yml", "server.json"]
decision: "dl-068-publishing-requires-public-repository"
release: "v0.2"
tmpl_version: 260929
---

## Purpose

The repository that hosts WingFoil's source and runs its publish pipeline. Its **public visibility**
is a precondition of the pipeline, not a preference (`dl-068`, decision (a), 2026-09-21): npm
provenance and the `npm-publish` environment's required-reviewer gate both depend on it, and the
gate job's unauthenticated `git fetch origin main` works only on a public repository (`dl-068`
Context). A private repository breaks the publish of every release.

## Configuration

- `wingfoil/wingfoil`, created 2026-09-17 as `robypomper/wingfoil` (`dl-068` E1: `created_at:
  2026-09-17T07:31:01Z`), made public before the first publish (`dl-068` §Decision), MIT-licensed,
  default branch `main`. Transferred to the organisation `wingfoil` by the approver on 2026-09-29.
  The old URL redirects (`gh api repos/robypomper/wingfoil --jq .full_name` → `wingfoil/wingfoil`).
- `package.json` `repository.url` points at it; npm provenance checks that URL against the repository
  that builds the package (`release-planning-rel-v0.2.2-plan` §C).
- It moved to `wingfoil/wingfoil` before the v0.2.2 publish (`dl-091` addendum D5); the slug change
  in the repository is `task-116-repository-slug-follows-the-transfer`. Historical documents keep the
  old slug, because GitHub redirects (§C).
- Its descriptive settings (description, topics, features) are a separate element,
  `svc-004-github-repository-settings`.

## Verification

`gh api repos/wingfoil/wingfoil --jq '{full_name,visibility,private,license:.license.spdx_id}'` →
`full_name: wingfoil/wingfoil`, `visibility: public`, `license: MIT` (run read-only by `task-116`
after the transfer, 2026-09-29). Before the transfer `task-124` ran the same command against
`robypomper/wingfoil`.

## Management

- **Owner:** the `approver` role. Since 2026-09-29 the repository is owned by the organisation
  `wingfoil` (`svc-001-github-organisation-wingfoil`).
- **Never make it private** while the pipeline relies on provenance and the environment gate: `dl-068`
  options (b) and (c) are the recorded fallbacks, and choosing one is a new decision, not a setting.
- **Transfer:** after it, update `url`, `account` and `verify` in a `docs(self)` commit (`dl-088`
  option 2) and re-run the checks `release-planning-rel-v0.2.2-plan` §C lists.
- **Retire:** `memory deprecate`, naming the replacement repository.
