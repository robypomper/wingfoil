---
id: "bug-036-channel-enumeration-misses-created-files-and-commits"
type: bug
title: "The REQ-SEC-05 no-persistence check snapshots only known files, so a read handler that creates a file or commits stays green"
status: open
severity: "medium"
release-origin: "v0.2"
release: ""
feature: "P5.2.1"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Summary

The shared MCP test helper `test/mcp/helpers/channel-enumeration.ts` proves "a read-only channel
persisted nothing" by snapshotting the bytes of a **caller-supplied list of existing files**
(`snapshotFiles`, lines 62-69) and re-reading **those same files** afterwards (`assertFilesUnchanged`,
lines 71-79). It never looks at files it was not told about, the working-tree status, or `HEAD`. So a
Resource or Prompt handler that creates a new file, or writes and commits, passes the check.

## Steps to Reproduce

1. On `main` (`8a6a091`): `sed -n 62,79p test/mcp/helpers/channel-enumeration.ts` — the only
   comparison is `readFileSync(join(root, relativePath))` per snapshotted path.
2. Executed the helper as shipped (transpiled with the repo's `typescript`, imports pointed at `dist/`)
   against a throwaway git repository holding one committed `.wingfoil/dna.yaml`:
   - `snapshotFiles(root, ['.wingfoil/dna.yaml'])`;
   - then created `.wingfoil/memory/x.md` and `side-effect.txt`, and ran
     `git add side-effect.txt && git commit -m planted`;
   - `assertFilesUnchanged(root, snapshot)` → **no throw**, while
     `git status --porcelain` → `?? .wingfoil/memory/` and `git rev-list --count HEAD` → `2`.
3. `grep -rn 'porcelain\|rev-parse\|HEAD' test/mcp` → no output: no MCP suite checks either signal.
4. Callers on `main`: `test/mcp/read-only-resources.test.ts:453-459`,
   `test/mcp/read-only-agent-channel.test.ts:119-125` (the `task-016` REQ-SEC-05 guarantee),
   `test/mcp/server.test.ts:125-134`, `test/mcp/role-prompts.test.ts:251-258`.
5. On `task/task-058-mcp-prompts-role-based` (`3f27d98`), the Prompts suites use the same helper
   (`git grep -n 'snapshotFiles\|assertFilesUnchanged' 3f27d98 -- test | wc -l` → 18). That task's
   second-pass independent review planted two mutations in a `prompts/get` handler — **MA**, creating a
   new file (`side-effect.txt` or `.wingfoil/memory/x.md`); **MC**, writing a file and making a git
   commit — and reported that both left the suites green. That review report is not recorded in the
   repository; step 2 reproduces the same blind spot independently on `main`.

## Expected Behavior

REQ-SEC-05's "Tools are the only write path" and `spec-004` §2.3 / §3.3's "persists nothing / no side
effect" are evidenced by a check that fails on **any** persistence: a changed tracked file, a new
untracked file, or a moved `HEAD`.

## Actual Behavior

Only in-place modification of pre-listed files is detected. File creation and commits are invisible to
every Resources and Prompts no-persistence assertion in the suite.

## Notes

- **Suggested fix (from the review):** in the helper, additionally capture `git rev-parse HEAD` and
  assert `git status --porcelain` is empty (fixtures committed first) and `HEAD` unchanged after the
  calls; apply it in both the Resources and Prompts suites. A regression test for the helper itself
  should plant MA and MC and expect a throw.
- **Severity `medium`, proposed:** no production defect is known — the handlers on `main` are
  read-only by construction — but this helper is the executable evidence for a security requirement
  (REQ-SEC-05), and it has been shown blind to two realistic mutation classes.
- Related: REQ-SEC-05, `task-016-read-only-agent-channel` (established the guarantee test),
  `task-011` (established the helper), `task-058-mcp-prompts-role-based` (review that found it).

## Triage & Execution Notes

- capture: raised by the second-pass review of `task-058-mcp-prompts-role-based` (Wave 2, 2026-09-17);
  the helper's blind spot reproduced on `main`; filed under
  `bug-ingest-rel-v0.2-wave2-review-findings-plan`.
