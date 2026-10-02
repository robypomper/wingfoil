---
id: bug-197-ten-cli-suites-keep-local-spawn-helpers-several-reading-a-killed-child-as-exit-1
type: bug
title: "Ten CLI suites keep local spawn helpers, several reading a killed child as exit 1"
status: closed
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.3"     # optional — release where the bug was FOUND (dl-016), e.g. "v0.1"
release: "v0.3"            # optional — fix/implementation release, stamped by release-planning/build-backlog (dl-016)
feature: "P5.1"            # optional — related feature ID, e.g. "P1.6"
contributor: ""        # optional — who originated this contribution, if not the git author (dl-020); credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note (dl-020)
tmpl_version: 260703   # Orignal template version
tags: ["v0.3"]
---

## Summary

`task-145` gave the CLI suites one spawn helper (`test/cli/helpers/spawn-cli.ts`), which throws when a child is killed by a signal. Ten other `test/cli` suites keep local `spawnSync` helpers. Several map a missing status to exit 1, so a crashed child reads as an ordinary exit 1 and can falsely pass a `toBe(1)` assertion.

## Steps to Reproduce

1. Read `test/cli/approval-authority-baseline.integration.test.ts` (around lines 41–45): `status: run.status ?? 1`.

## Expected Behavior

Every CLI suite spawns through the shared helper.

## Actual Behavior

Ten local helpers remain: approval-authority-baseline, check-governance, directive-inventory-at-head, dirty-document-refusal, history-scaffold-phantom, memory-add-set, memory-add-type-baseline, own-memory, reads-resolve-at-head, reason-control-chars.

## Notes

- Found by `task-145`'s developer and independent reviewer.

## Triage & Execution Notes

Captured on 2026-10-02 by `bug-ingest-rel-v0.3-w1b3-review-findings-plan`, from the independent reviews of wave 1
batch B3 (`dev-loop-rel-v0.3-plan`).

**Closing note (2026-10-02, `task-152`).** What `task-152` resolved is narrower than the Expected
Behavior's "every CLI suite spawns through the shared helper":

- The ten suites named under Actual Behavior now spawn through `test/cli/helpers/spawn-cli.ts`.
  Nine of them used to coalesce `status ?? 1`; `check-governance` called `spawnSync` directly.
- Two more files had the same `status ?? 1` coalescing and were moved too:
  `directive-assign-force.integration.test.ts`, and the two helpers in
  `test/memory/history-rename-path.test.ts`.
- `test/lint/no-signal-as-exit.test.ts` fails on any `status ??` or `status ||` in a TypeScript or
  JavaScript source under `test/`, so the coalescing cannot come back.

Some suites still call `spawnSync` directly: `extra-operand-refusal`, `dirty-target-refusal`,
`derived-option-namespace`, `workflow-list-diagnostics`, `mcp-registration`, `check-lockfile-pins`
and the `publish-*` suites. They keep `status: number | null`, so a signal reads as `null` and cannot
pass a `toBe(1)`. They are not hazardous, and moving them is left to a follow-up.
