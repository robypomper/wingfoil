---
id: bug-165-illegal-approve-names-a-wrong-target
type: bug
title: "The illegal-transition error names the verb's canonical edge instead of the attempted move, so `approve` on a `planned` bug reads `planned -> triaged`, a backward step"
status: open
severity: "low"
release-origin: "v0.2.2"
release: ""
feature: "P1.7"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

When a Memory verb is illegal from the current state, the error is `illegal transition <from> ->
<to> for type '<type>'`. The `<to>` is the verb's **canonical edge**: the target the verb reaches from
the first state in `sequence` where it is legal (`contractTarget`, `src/memory/state-machine.ts`,
per `dl-032` option (c) and `dl-053` option 1). It is not the state the user's call would have
reached, and not a state reachable from `<from>`. On the `bug` machine that makes `approve` on a
`planned` bug print `planned -> triaged`, which reads as a backward move, and `approve` on a
`triaged` bug print `triaged -> resolved`, skipping three states.

## Steps to Reproduce

1. On a throwaway clone of `main` at `fa3e80b6`, with `dist/cli.js` built from it.
2. `memory approve bug-128-subcommand-help-describes-no-command-and-no-argument --reason probe` (a
   `planned` bug).
3. `memory approve bug-013-req-perf-02-command-level-unasserted --reason probe` (a `triaged` bug).

## Expected Behavior

The message tells the user that the verb cannot move this element from here, without naming a move
that is either backward or not reachable from `<from>`. For example `<to>` is `(none)` for a state
with no edge of that verb. Or the `detail` line leads with "`approve` is not available from
`planned` (a waiting state)".

## Actual Behavior

- Step 2: `error: illegal transition planned -> triaged for type 'bug'`, exit 1.
- Step 3: `error: illegal transition triaged -> resolved for type 'bug'`, exit 1.

HEAD is unchanged in both cases. Observed on 2026-09-29 (session scratchpad), and first reported by
`task-114`'s end-to-end run.

## Notes

- Found at `task-114`'s review (2026-09-29). The approver ruled it a bug.
- The behaviour is the ratified contract, not a slip. `dl-053` removed the earlier wrong targets
  (`draft -> pending` for a `reject`), but the canonical-edge rule still names a target that is
  meaningless from `<from>` on machines with `waiting` states. The fix probably needs `dl-053`
  (`ready`) revisited, or a new decision-log, before any code, and BDD `P1.6` sc.2 / `P5.2.3` sc.2 pin
  the current string for `task` (`approved -> pending`).

## Triage & Execution Notes

<!-- triage (bug-ingest): severity call; fix: pointer to the fix task(s). -->
