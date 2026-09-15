---
id: "task-068-fix-claude-md-project-status"
type: task
title: "Fix: CLAUDE.md §1 still tells every agent the project has no source code"
status: in-progress
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

### `design` — role: architect

**`depends_on`** is `[]`, so `agent.read_related` (`dl-015`) has nothing to load; the gate is vacuously
satisfied.

**`agent.classify_acs` (T1).** All four ACs are **documentation-correctness** criteria over a single
prose artefact (`CLAUDE.md`). None is red-first, and AC-4 is a pure characterization criterion.

| AC | Classification | Reasoning |
|---|---|---|
| 1 — §1 callout describes reality | **characterization (no new behavior)** | The subject is prose, not a code path. There is no production symbol whose behavior changes; nothing can go from red to green. |
| 2 — sweep the rest of the file | **characterization** | Same: each claim is verified by reading the artefact it projects (`dna.yaml`, `memory.yaml`, `roles.yaml`, `workflows.yaml`, the filesystem). |
| 3 — manual-transition claim checked against reality | **characterization** | Answered by inspecting `CORE_MODULES` and the v0.2 backlog; the deliverable is a corrected statement, not a behavior. |
| 4 — no behavioural change; suite/`tsc`/`docs:api`/`eslint` green | **characterization (regression guard)** | The existing 69 suites are exactly the guard that `src/` was not touched. No new assertion is needed to express "nothing changed". |

**Why no red-first test — and what the honest alternative would have been.** Writing a failing test
here would mean asserting on the prose of `CLAUDE.md` (e.g. "§1 must not contain the string *no source
code yet*"). That is a fabricated red in the sense the `testing` directive prohibits: the assertion
would be authored *from* the fix rather than from a specification, it would pass forever after on a
string that nobody will reintroduce, and it would not catch the next instance of the same defect —
which will be a *different* stale sentence. A genuinely useful mechanical check **does** exist and is
already specified: `dl-025-agent-facing-docs-ownership` (now `ready`, ratified on shape **(B)**) puts
an `align-agent-docs` phase in `user-docs.yaml`, `role: architect`, whose post-check compares §4/§5/§6/§7
against `dna.yaml`/`memory.yaml`/`workflows.yaml`/`roles.yaml` — exactly the four sections this sweep
found stale. `test/docs/api-docs.test.ts` (task-062) is the precedent for how such a gate is made
executable. Building it is **explicitly not this task**: `dl-025`'s own Actions assign the
`user-docs.yaml` amendment to the next `release-planning` → `build-backlog`, this task's Implementation
Notes repeat that instruction, and the task's scope forbids touching `test/` or any workflow YAML.
So: no test is added, and the reason is scope + the no-fabricated-red rule, not absence of a
checkable property.

**`agent.verify_specs`.** No `tech-spec` governs `CLAUDE.md`'s contents, and none needs to be
scaffolded: the document is a *projection* of artefacts that already have approved schema specs —
`spec-001-memory-yaml-schema` (§5), `spec-002-dna-yaml-schema` (§4), `spec-003-workflows-yaml-schema`
(§6), `spec-011-storage-layout` (§3's `.wingfoil/` layout, incl. the `built-in/`-reserved rule) — plus
`roles.yaml` itself for §7. Correctness here means agreeing with those files, not defining a new
contract, so a spec would have no scope of its own. `design` is therefore a pass-through: no
`memory.add(type: tech-spec)`, no approver gate.

**`doc-versioning` (global directive).** Checked before editing: the directive applies to "a document
[that] carries a `**Version:**` / `version:` field". `CLAUDE.md` has **no frontmatter and no version or
date field at all** (verified by reading the file end to end). There is nothing to bump, and adding a
version field would be an unrequested convention change. No bump performed.
