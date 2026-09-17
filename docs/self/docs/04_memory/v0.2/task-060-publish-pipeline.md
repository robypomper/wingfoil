---
id: "task-060-publish-pipeline"
type: task
title: "Publish flow: GitHub Actions CI/CD + ephemeral Verdaccio staging (dl-018 T3)"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "release"]
ref: "dl-018-release-publishing-strategy"
bug: ["bug-020-bin-path-autocorrected-at-publish"]
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

Deliver **dl-018 T3**: implement the publish pipeline per `adr-009` — `prepublishOnly` + `npm publish --dry-run` gate, a local-first `publish:staging` script (Verdaccio) reused as the CI staging smoke, then promote to npm with provenance/OIDC. Implements `spec-015` §2–§4.

## Acceptance Criteria

Per `spec-015` §2–§4 + `adr-009`:
- `prepublishOnly = build && test && lint`.
- `publish:staging` script: publish to ephemeral Verdaccio → `npm install -g wingfoil` from it → run the `dl-023` init+CLI e2e smoke → teardown.
- `.github/workflows/publish.yml`: gate → stage → smoke → promote (provenance via OIDC) on `vX.Y.Z` tag on `main`.
- Document local `act` run to avoid CI-debug commit churn.


**`bug-020` — drop the `./` from `bin.wingfoil` (assigned here, spec-015 §1 amended).** This task wires
`npm publish --dry-run` as the §3 stage-1 CI gate, so it is the task that would otherwise inherit a
permanent warning in every run's log:

```
npm warn publish "bin[wingfoil]" script name dist/cli.js was invalid and removed
```

`spec-015` §1 now specifies `bin.wingfoil: dist/cli.js` without the leading `./` (it previously sat
under *Unchanged* in the `./` form, which is why `task-059` correctly declined to touch it). Change
`package.json` to match, and confirm the warning is gone from `npm publish --dry-run` before wiring the
gate — otherwise stage 1 ships with expected noise on day one, which is how `bug-009`'s red lint
baseline stopped meaning anything.

Not a functional fix: `task-059`'s reviewer packed and installed a probe and confirmed the shim works
with either form. It is purely about the gate being readable.
## Implementation Notes

Source: `dl-018` T3; architecture fixed by `adr-009`; contract in `spec-015`; requirement REQ-SYS-09. Reuses the `dl-023` smoke sub-workflow.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
