---
id: "bug-032-spec-004-stale-illegal-transition-example"
type: bug
title: "spec-004 §4.3 still shows the pre-dl-032 illegal-transition message, contradicting REQ-STATE-01, P1.6 and P5.2.3"
status: open
severity: "low"
release-origin: "v0.2"
release: ""
feature: "P5.2.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

`spec-004-mcp-surface-contract` §4.3's `memory.approve` example ends with an illegal-transition error
reading `illegal transition: task cannot go from draft to approved`. That wording is neither the
message `dl-032` ratified nor the one the requirement and both BDD features pin, and `dl-032`'s
implementation (`2cd936f`) did not touch `spec-004`.

## Steps to Reproduce

1. On `main` (`8a6a091`): `sed -n 207,209p docs/self/docs/04_memory/design/specs/spec-004-mcp-surface-contract.md`
   →
   ```
   // → illegal transition: MCP tool-error, message identical to CLI's
   //   "illegal transition: task cannot go from draft to approved"
   ```
2. `grep -rn 'illegal transition' docs/02_requirements` →
   - `03_sard/03_state-context.md:16` (REQ-STATE-01 Fit Criterion):
     `"illegal transition <from> -> <to> for type '<type>'"`;
   - `02_bdd/features/p1-memory/P1.6-memory-submit.feature:21`:
     `"illegal transition approved -> pending for type 'task'"`;
   - `02_bdd/features/p5-interaction/P5.2.3-mcp-tools.feature:18`: the same string.
3. `sed -n 85,98p docs/self/docs/04_memory/design/dls/dl-032-illegal-transition-message-contract.md` —
   the Actions list names REQ-STATE-01 and `spec-009` §3 as the documents to amend; `spec-004` is not
   listed. `git show --stat 2cd936f` ("implement dl-032") → no `spec-004` path.

## Expected Behavior

`spec-004` §4.3's example uses the ratified form — for the example as written (a `task` in `draft`
approved), `illegal transition draft -> <to> for type 'task'`, with `<to>` per whatever `dl-053`
settles.

## Actual Behavior

The one MCP-side example of the refusal still shows the superseded wording, while §4.3 item 3
(line 194) promises it is "rejected identically to the CLI path".

## Notes

- **Timing.** Harmless today — no MCP Tool is registered on the running server — but `spec-004` §4 is
  the spec the v0.4 MCP Tools task will implement from, and a copied example string would fail
  `P5.2.3` sc.2.
- **Coupled to `dl-053`.** The example's `<to>` for `approve` from `draft` depends on how `<to>` is
  computed for a verb with no legal edge from the current state; amend after `dl-053` is ratified, or
  choose an example whose target is unambiguous (e.g. `submit` from `approved` →
  `illegal transition approved -> pending for type 'task'`, the string `P5.2.3` itself pins).
- Tech-specs carry no `version:` field (`dl-047`); record the edit as a dated "Revision" note.

## Triage & Execution Notes

- capture: raised by the review of `task-045-memory-submit` (Wave 2, 2026-09-17), filed under
  `bug-ingest-rel-v0.2-wave2-review-findings-plan`. Severity `low`: specification text only.
