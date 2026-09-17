---
id: "task-061-publish-secrets"
type: task
title: "Publish secrets: CI secret store + rollback posture (dl-018 T4)"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ["bug-015-scan-reads-worktree-not-index"]
depends_on: ["task-060-publish-pipeline"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T4**: wire the registry token as a CI secret (never committed) and document the human approval/rollback steps. Implements `spec-015` §5.

## Acceptance Criteria

Per `spec-015` §5 + `security-secrets`/`spec-007`:
- `NPM_TOKEN` in the GitHub Actions secret store only; transient `.npmrc` at publish time; never committed.
- Document the `approver` (Roberto) providing/rotating the secret + authorizing the tagged release (`adr-006`).
- Rollback posture: prefer `npm deprecate` + patch over `npm unpublish`; failed staging smoke blocks promotion.


**`dl-036` — promoted secret patterns + the escape hatch (assigned by `dl-036`, ratified option 1
per-pattern).** This task already cites `spec-007` and is the task that writes `NPM_TOKEN` handling
into documentation, i.e. the most likely tripper of the pattern being promoted. It therefore owns:

1. **Land the promotion in code.** `jwt-like` and `dotenv-style-secret-line` move `warn → block` in
   `src/validation/secret-scan.ts` to match the amended `spec-007` §2; `generic-high-entropy-string`
   stays `warn`. Widen `task-043`'s REQ-SEC-08 Fit-Criterion test to assert the newly-blocking set.
2. **Ship the escape hatch with the promotion, not after it.** No `.wingfoil/security-ignore` exists
   today, so the first author to trip a false positive has to discover `spec-007` §3 from the spec.
   Seed the file, or document the fence-marker/placeholder hatch where an author writing a memory
   document will meet it. `dl-036` makes this part of the decision rather than a follow-up.

Beware the self-reference: this task's own `.env`-style examples are written into a scanned surface
(`docs/self/docs/04_memory/`), so it must use the §3 hatch on its own documentation or it will fail
the gate it is landing.

**`bug-015` — guard the scanner against a staged deletion before a gate consumes it.**
`scanProjectSurface` builds its file list from `listTrackedFiles`, which enumerates the **git index**,
then reads each path with `readFileSync`, which reads the **working tree**. A path tracked in the index
but absent from disk throws `ENOENT` and takes the whole scan down instead of reporting.

Harmless in a clean checkout, which is why it survived two review passes of `task-043`. It stops being
harmless at the call site the scanner exists for — a commit-time or pre-publish gate runs against a
working tree where staged deletions are ordinary, and this task is the one wiring secret handling into
the publish path. Decide the contract deliberately while you are here: either the scanner reports on
**what is committed** (read blobs via `git show :path`), or on **what is on disk at tracked paths**
(current behaviour, plus an existence guard) — and say which in the TSDoc. `task-043`'s Fit-Criterion
test also calls its surface "this repository's own **committed** surface", which is only true under the
first reading. `bug-015` needs closing by hand — no `bug:` back-reference.
## Implementation Notes

Source: `dl-018` T4; contract `spec-015` §5; requirement REQ-SYS-09/REQ-SEC-08. Depends on the pipeline (`task-060`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
