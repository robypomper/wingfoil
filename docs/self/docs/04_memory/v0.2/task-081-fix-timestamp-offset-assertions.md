---
id: "task-081-fix-timestamp-offset-assertions"
type: task
title: "Accept git's `Z` zero-offset in the two `%aI` timestamp assertions so `prepublishOnly` passes on a UTC runner"
status: backlog
release: "v0.2"
priority: "high"
tags: ["v0.2", "release", "testing"]
ref: "task-077-first-real-staging-run"
bug: ["bug-057-timestamp-assertions-reject-zulu-offset"]
depends_on: []
tmpl_version: 260703
---

## Description

`bug-057-timestamp-assertions-reject-zulu-offset` (`open`, high, **release blocker**):
`test/core/memory-approve.test.ts:168` and `test/memory/versioning-audit-trail.test.ts:61` both assert
`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/` against git's `%aI` author date. Git >= 2.55
renders a zero offset as `Z`, which is valid ISO-8601/RFC-3339, so on a UTC runner both fail — and with
them `prepublishOnly`, which `spec-015` §2 requires to be passable in the release gate. GitHub's
`ubuntu-24.04` image ships **Git 2.55.0** (`actions/runner-images` readme) and its runners are UTC, so
this fires on GitHub, not only under `act`.

**The assertions are wrong, not git**, and the fix shape is already in this repository:
`test/cli/program.integration.test.ts:471` asserts the same kind of value as
`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/`. Adopt that alternation in both failing
assertions.

P1.2 requires the audit trail to carry an ISO-8601 timestamp; it does not require one spelling of a
zero offset, so widening these regexes weakens no specified behaviour.

## Acceptance Criteria

1. **AC1 — both assertions accept `Z`.** `test/core/memory-approve.test.ts:168` and
   `test/memory/versioning-audit-trail.test.ts:61` use `(?:Z|[+-]\d{2}:\d{2})` in place of
   `[+-]\d{2}:\d{2}`, matching `test/cli/program.integration.test.ts:471` verbatim.
2. **AC2 — the suite passes under `TZ=UTC` with a git that emits `Z`.** Run
   `TZ=UTC npx jest test/core/memory-approve.test.ts test/memory/versioning-audit-trail.test.ts` in an
   environment whose `git --version` is **>= 2.55** — e.g. inside `catthehacker/ubuntu:act-24.04`,
   which ships 2.55.0 — and record both the git version and the exit code in the Execution Notes. A run
   under the developer machine's git 2.43.0 does **not** satisfy this AC: 2.43.0 writes `+00:00` even
   under `TZ=UTC` (measured in `bug-057`), so it passes with or without the fix.
3. **AC3 — red before green, in that same environment.** The two assertions fail before the change and
   pass after it, shown by two runs of the identical command.
4. **AC4 — no other assertion carries the same literal.** Sweep the tree —
   `grep -rn '\[+-\]\\d{2}:\\d{2}' test/ src/` — and either fix every hit or record in the Execution
   Notes why a hit is legitimately offset-only. `bug-057` deliberately asserts nothing about other
   suites; this AC settles it by running the command.
5. **AC5 — `+HH:MM` still passes.** Both widened assertions still accept a non-zero offset (the
   developer-machine case, `TZ=Europe/Rome`), so this is a widening and not a swap.
6. **AC6 — the existing gates stay green**: `npx jest`, `npx jest --coverage` (non-regressing, >80%),
   `npx tsc -p tsconfig.build.json --noEmit`, `npm run lint`, `npm run docs:api` all exit 0.
7. **AC7 — `bug-057` is carried to `resolved`** by `bug.sync_state` off this task's `bug:` field.

## Implementation Notes

- **The environment is the hard part, not the regex.** The change is two characters of alternation; the
  work is producing a git >= 2.55 to prove it. Cheapest route recorded by `task-077`:
  `docker run --rm catthehacker/ubuntu:act-24.04 bash -lc '…'` — it needs no `act`, no workflow and no
  artifact server. Running the whole Jest suite inside that image is heavier but is what AC2 asks for;
  running only the two named suites is sufficient.
- **Do not "fix" this by pinning a TZ in the test setup.** Forcing `TZ=Europe/Rome` (or any non-zero
  offset) in Jest config would make the assertion pass by preventing the input it rejects. That hides
  the defect, and would also mask the next assertion that makes the same mistake.
- **Do not change production code.** Nothing in `src/` is wrong here: `%aI` is git's output and P1.2 is
  satisfied by either spelling. If a production path is found to *parse* `%aI` with the same narrow
  regex, that is a separate finding — file it, do not absorb it silently.

**Must be re-verified at execution time, not read from this task:**

1. The two line numbers — `test/core/memory-approve.test.ts:168`,
   `test/memory/versioning-audit-trail.test.ts:61` — and the reference line
   `test/cli/program.integration.test.ts:471`. All three are pinned to `main` at `b505473` and any merge
   can move them; re-locate by content (`grep -n '\[+-\]\\d{2}:\\d{2}' test/`), not by line.
2. `git --version` inside whatever image is used for AC2, printed alongside the run.
3. That GitHub's `ubuntu-24.04` image still ships a git that emits `Z`, if the fix is deferred long
   enough for the image to move:
   `curl -sS https://raw.githubusercontent.com/actions/runner-images/main/images/ubuntu/Ubuntu2404-Readme.md | grep -i '^- Git '`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass.
     AC classification (dl-014/T1, `testing` directive): AC2/AC3 are red-first — the failure is
     reproducible today in a git >= 2.55 environment and must be shown red first; AC4/AC5/AC6 are
     characterization. -->
