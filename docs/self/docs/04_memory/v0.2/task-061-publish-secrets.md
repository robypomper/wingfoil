---
id: "task-061-publish-secrets"
type: task
title: "Publish secrets: CI secret store + rollback posture (dl-018 T4)"
status: backlog
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ""
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
## Implementation Notes

Source: `dl-018` T4; contract `spec-015` §5; requirement REQ-SYS-09/REQ-SEC-08. Depends on the pipeline (`task-060`).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
