---
id: "bug-097-history-probe-behaviours-that-no-test-pins"
type: bug
title: "`core.quotePath=false` and the new history probe's `stdio` are both load-bearing and neither is pinned, and one `readStatusAt` TSDoc sentence claims a distinction the pipe does not make"
status: closed
severity: "low"
release-origin: "v0.2"
release: "v0.3"
feature: "P1.10"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

Three residues from `task-097`, raised by its reviewer, which recommended APPROVE with these below
the line. Behaviour is correct; what is missing is protection and precision.

1. **`core.quotePath=false` is load-bearing and untested.** Without it git returns a non-ASCII path
   C-quoted as `"a/caf\303\251.md"`, which `git show` cannot resolve; with it,
   `git show <sha>:a/café.md` succeeds. Its TSDoc is truthful. No test covers it, so the flag can be
   removed without anything going red.
2. **The new probe's own `stdio` is unpinned.** Removing it leaves all ten tests in
   `test/memory/history-rename-path.test.ts` green while `fatal: not a git repository` prints into the
   suite output. The implementer hit exactly this during the pass and caught it by reading the output,
   not by a failing test.
3. **One TSDoc sentence overstates.** `readStatusAt`'s comment says capturing the child's stderr "is
   what keeps a genuine `fatal:` distinguishable from a routine one — that line is how `bug-050`'s
   forged history announced itself". The pipe discards **both**; a `fatal: invalid object name` from
   that call is now equally invisible.

## Steps to Reproduce

1. Delete `-c core.quotePath=false` from the probe arguments: the suite stays green.
2. Delete `stdio: ['ignore','pipe','pipe']` from the new probe: ten of ten still pass, and
   `fatal: not a git repository (or any of the parent directories): .git` appears in the run output.
3. For (3), run the same `execFileSync` against a bogus sha with and without `stdio`: the message
   prints in the first case and vanishes in the second, routine or not.

## Expected Behavior

A behaviour the code depends on is pinned by a test that fails when it is removed. A TSDoc sentence
describes what the code does.

## Actual Behavior

Two dependencies rest on nobody deleting a line, and one sentence describes a discrimination the
implementation does not perform.

## Notes

**No protection was lost to (3), and that was measured rather than assumed.** `task-097`'s reviewer
reintroduced `bug-050`'s framing (`NUL_PLACEHOLDER`/`NUL` → `0x1f`) and ran the suite that owns it:
all three tests in `test/cli/reason-control-chars.integration.test.ts` fail and the CLI exits **1**
with `creation commit … is not present in the history walk it was derived from` — `task-089`'s
invariant, a stronger signal than the stderr line ever was. So the sentence should be trimmed to what
is true rather than the behaviour restored.

**Item (2) is the same subject as `bug-093`** — Memory git calls written without `stdio` — seen from
the regression-protection side rather than the leak side. `bug-093` proposes the durable remedy: one
helper every Memory git call goes through, instead of inspecting call sites one at a time. A pin for
this probe belongs with that work, and the AC4 harness already in the file would provide it cheaply.

**Raised by the reviewer, not by the implementer, and below the reject line on purpose.** The
engineering was verified independently, including by mutation; these are the things a second pass
would have cost more than it returned.

## Triage & Execution Notes

- triage (2026-09-24): **low**. Nothing shipped is wrong and no gate is weakened. Filed because
  `task-097` is `done` once approved, and nothing reschedules a done task's Execution Notes.
