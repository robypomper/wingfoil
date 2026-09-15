---
id: "task-068-fix-claude-md-project-status"
type: task
title: "Fix: CLAUDE.md §1 still tells every agent the project has no source code"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "documentation"]
ref: "bug-008-claude-md-stale-project-status"
bug: "bug-008-claude-md-stale-project-status"
depends_on: []
tmpl_version: 260703
---

## Description

`CLAUDE.md` §1 carries a *"Project status: specification & design phase"* callout asserting there is
**no source code yet**, that the `wingfoil` CLI/MCP is **not implemented**, and instructing agents to
*"not assume runtime behaviour exists"*. All three have been false since `minor-v0.1` was released;
`main` now carries 69 test suites and 866 tests, a packaged CLI, and an MCP server.

This is the agent entry point — the first thing read in every session. Its opening section currently
misdirects anyone who does not have contradicting instructions.

## Acceptance Criteria

1. §1's status callout describes the project as it is: implementation exists and is under active
   extension, with the specs still authoritative for *what* to build. Replace the three false claims;
   do not simply delete the callout, since the "specs win" guidance around it is still correct and
   load-bearing (§10.1).
2. Sweep the rest of `CLAUDE.md` for the same staleness rather than fixing only §1 — §3's "it will
   move to the repository-root `.wingfoil/` once the tool can manage it" and §6's "Interim — no
   workflow engine yet" are the obvious neighbours. Correct what is false; **leave what is still
   true**, including the interim plan-first rule, which still holds.
3. The claim that state changes are performed manually (§6's dogfooding note) is checked against
   reality rather than assumed — the CLI does exist, so state whether the manual procedure is still
   the intended one or merely the current one.
4. No behavioural change; documentation only. Full suite, `tsc`, `docs:api` and `eslint` all green.

## Implementation Notes

Scheduled into `v0.2` under the exception extended in **`dl-034`** point 4. `bug-009` was admitted
because it gated the *verification* of every remaining v0.2 task; this gates their *orientation*.

**This fix will regress unless `dl-025-agent-facing-docs-ownership` is settled.** That decision-log
(`in-discussion`) exists precisely because **no workflow gate owns `CLAUDE.md`**, which is why the
file went stale in the first place and why this is the second time it has been caught by a review
rather than by a check. Fixing the text is this task; assigning the ownership is `dl-025`. Do not
implement a gate here — flag it if `dl-025` is still open when this runs.

`bug-008` is linked, so `dev-loop`'s `bug.sync_state` advances it automatically.

## Execution Notes
