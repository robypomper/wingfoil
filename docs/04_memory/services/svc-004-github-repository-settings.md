---
id: svc-004-github-repository-settings
type: service
title: "GitHub repository settings"
status: pending
provider: "GitHub"
kind: "setting"
owner_role: "approver"
verify: "gh api repos/robypomper/wingfoil --jq '{description,homepage,topics,has_discussions,has_issues,has_wiki,has_projects}'"
url: "https://github.com/robypomper/wingfoil"
account: "robypomper/wingfoil"
renews: ""
repo_refs: []
decision: "dl-091-package-name-and-mcp-namespace"
release: "v0.2.2"
tmpl_version: 260929
---

## Purpose

How the repository presents itself to people who find it: its description, homepage, topics and
enabled features. The approver ruled on 2026-09-29 that these settings are **not** declared as code in
the project (no `.github/repository.yml`), so this element is the only record of them
(`release-planning-rel-v0.2.2-plan` §A, §B.3).

## Configuration

Applied by hand in the web interface by the approver, 2026-09-29 (§B.3):

- **description:** "The repo-native intent layer for AI-native software engineering — keeps intent and
  engineering state in git, turns them into workflows, verifies what agents deliver. CLI + MCP."
- **homepage:** `https://www.npmjs.com/package/wingfoil`, until a domain exists (domains wait until
  after v0.3, `dl-091` addendum D7).
- **topics (14):** `ai-agents`, `ai-assisted-development`, `claude-code`, `cli`, `context-engineering`,
  `determinism`, `developer-tools`, `git`, `intent-engineering`, `mcp`, `mcp-server`,
  `model-context-protocol`, `spec-driven-development`, `typescript`.
- **features:** Discussions on, Issues on, Wiki off, Projects off.
- **Discussions categories:** Announcements, Q&A, Ideas, Show and tell (General and Polls deleted) — the
  approver's report (§B.3); the `verify` command does not read them.
- **social preview:** none (`dl-128`).

## Verification

`gh api repos/robypomper/wingfoil --jq '{description,homepage,topics,has_discussions,has_issues,has_wiki,has_projects}'`
→ `homepage` `https://www.npmjs.com/package/wingfoil`, the 14 topics above, `has_discussions: true`,
`has_issues: true`, `has_wiki: false`, `has_projects: false`, and the description above verbatim
(run read-only by `task-124` on 2026-09-29). The visibility session read every value
above through the GitHub MCP on 2026-09-29 and all matched (§B.3). The Discussions categories and the
social preview are checked by eye on the repository page.

## Management

- **Owner:** the `approver` role.
- **Change:** edit the setting on GitHub, then this element's Configuration in a `docs(self)` commit
  (`dl-088` option 2), so the two never disagree. The topic list and the package `keywords` are
  settled together at `dl-093`'s metadata task (`release-planning-rel-v0.2.2-plan` §D).
- **After the transfer to `wingfoil/wingfoil`:** re-check every value (§C) and update `url`, `account`
  and `verify`.
- **Retire:** `memory deprecate` if the settings move to code or to another element.
