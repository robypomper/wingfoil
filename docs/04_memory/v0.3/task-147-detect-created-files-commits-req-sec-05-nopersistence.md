---
id: "task-147-detect-created-files-commits-req-sec-05-nopersistence"
type: task
title: "Detect created files and commits in the REQ-SEC-05 no-persistence check"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "medium"
tags: ["v0.3", "core", "security", "tests", "mcp"]
ref: "dl-121"
bug: ["bug-036"]
depends_on: []
tmpl_version: 260703
---

## Description

`test/mcp/helpers/channel-enumeration.ts:63-79` snapshots only listed files, so a read handler that creates a file or commits stays green. v0.3 adds workflow Resources (R12) this guard must cover.

## Acceptance Criteria

- (red-first) the helper also compares `git status --porcelain --untracked-files=all` and `git rev-parse HEAD` before and after; a planted handler that writes a new file, and one that commits, each fail it.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** REQ-SEC-05; dl-121 (named instance).
- **Features:** P5.2.1.
- **Notes:** Proposal key: C42.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-147-detect-created-files-commits-req-sec-05-nopersistence`, worktree
`../.wf2-wt/task-147`, cut from `main` at `cac8a447`. Start `8a50f649`; `bug-036` `[planned →
in-progress]` `41ae8f28`.

### design (architect)

**`depends_on` (dl-015).** Empty: nothing to read.

**Specs.** `spec-004-mcp-surface-contract` is `approved` (`grep -n "^status:"` → `approved`); its
§2.3 / §3.3 "persists nothing" is what the helper evidences, and it says nothing about *how* the test
checks it, so no spec edit is needed. `dl-121` (which names `bug-036` as a T1 instance) is `ready`.

**Callers.** `grep -rn "snapshotFiles\|assertFilesUnchanged" test/` → four suites:
`read-only-resources`, `read-only-agent-channel` (×2), `server`, `role-prompts`. Each one builds its
fixture with `makeTempGitRepo()` + `commitAll()` (`grep -n "makeTemp\|commitAll"` over the four), so
every root is a committed git working tree and the helper can query `git status` and `HEAD` without a
new fixture contract. The callers pass the snapshot through untouched, so the return type can change
without editing them.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — the helper also compares `git status --porcelain --untracked-files=all` and `HEAD`; a planted file-creating handler and a planted committing handler each fail it | **red-first** | `bug-036` step 2 shows the shipped helper does not throw on either |

### red (developer)

`test/mcp/channel-enumeration-persistence.test.ts` (`c2fd564c`). One `McpServer` with a single planted
Resource whose `resources/read` handler runs a side effect before answering, over the SDK's in-memory
transport against a committed git fixture; the suite snapshots, reads the Resource, and runs
`assertFilesUnchanged`. Six cases:
- control: no side effect → passes;
- control: overwrites a listed tracked file → throws (the old behaviour, kept);
- MA: creates `.wingfoil/memory/x.md` → must throw;
- MA: creates `side-effect.txt` → must throw;
- MC: writes `side-effect.txt`, `git add`, `git commit` (clean tree afterwards) → must throw;
- MC: `git commit --allow-empty` (no file touched at all) → must throw.

`npx jest test/mcp/channel-enumeration-persistence.test.ts` → **4 failed, 2 passed**; each failure
is `Received promise resolved instead of rejected` — the four MA/MC cases; the two controls pass.

### green (developer)

`002f0529`, `test/mcp/helpers/channel-enumeration.ts` only. `snapshotFiles` now returns a
`PersistenceSnapshot` — `{ files, status, head }`: the listed files' bytes as before, plus
`git status --porcelain --untracked-files=all` and `git rev-parse HEAD`. `assertFilesUnchanged`
compares all three and throws a `channel-enumeration:` error naming which one changed (the status
diff is printed before/after). The git queries run with `--no-optional-locks`, so taking a snapshot
does not rewrite `.git/index`. The status is compared for equality with the "before" value rather than
asserted empty, so a caller whose fixture is dirty at snapshot time is not broken; every current caller
commits its fixture first.

`npx jest test/mcp` → 9 suites, 77 tests, all passed: the new suite is green, and the four existing
callers pass the stronger check unchanged — so their real read handlers create no file and make no
commit.

### refactor (developer)

The module doc of the helper now states the three-part comparison. Scope:
`git diff --stat cac8a447..HEAD` → only `test/` files besides the task and bug Memory files.

Gates on `002f0529`:

| Command | Result |
|---|---|
| `npm run -s test:coverage` | 189 suites / 3199 tests; 1 failure, `test/cli/publish-secrets.test.ts` › "publishes (dry run) the tarball…" (empty npm output). Re-run alone: `npx jest test/cli/publish-secrets.test.ts` → 24/24 passed. Load flake (8 parallel worktrees), untouched by this task. Coverage 98.84 / 95.24 / 95.01 / 99.54 — identical to the B2 gate figure on `main` (plan, B2 section), as expected: no `src/` file changed |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |

BDD: no `.feature` change — `P5.2.1-mcp-resources.feature`'s "persists nothing" outcome is the
property; this task strengthens the evidence behind it, not the contract.

**Pending amendments (approver):** none.

### review (reviewer)

AC 1: the helper compares status (untracked included) and `HEAD` (`002f0529`); the planted
file-creating handlers (two) and committing handlers (two, one with an empty commit) each fail it
(`channel-enumeration-persistence.test.ts`, red 4 failed → green 6 passed). Only test files changed.
Same-class search outside MCP: `grep -rln "byte-for-byte\|persists nothing\|writes nothing" test/`
lists ~20 non-MCP suites with their own "writes nothing" assertions; they are outside this task's
scope (REQ-SEC-05's read channel) and were not audited — reported to the coordinator as a candidate.

Submitted for the approver's review; `bug-036` synced to `in-review`.

