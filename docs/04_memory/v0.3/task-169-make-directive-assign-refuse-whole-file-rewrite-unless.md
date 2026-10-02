---
id: "task-169-make-directive-assign-refuse-whole-file-rewrite-unless"
type: task
title: "Make `directive assign` refuse the whole-file rewrite unless `--force`, and give successful operations a stderr warning channel"
status: in-progress
release: "v0.3"
kind: "feature"
priority: "medium"
tags: ["v0.3", "core", "directives", "cli"]
ref: "dl-062"
bug: []
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

`updateRoleAssignments` still takes a `#`-gated split: a whole-file `js-yaml` dump when the file has no comment, CONFLICT otherwise. dl-062 ratified CONFLICT whenever `setRoleAssignmentsInText` cannot apply. The whole-file rewrite becomes reachable only with `--force`, plus a stderr warning naming what it normalizes. A missing `roles.yaml` keeps the unflagged dump. The warning needs a channel no success result has today. `CoreResult`'s success arm carries only `value` and `commit`, and the registrar's success path writes only stdout. So this task adds `warnings` to the success arm, and a rendering rule: stderr on every `--format`, never stdout, and a field on the MCP Tool result. It also settles where a command-specific flag is documented in spec-008, since §2 claims universality.

## Acceptance Criteria

- (red-first) A committed `roles.yaml` with no `#`, whose shape `setRoleAssignmentsInText` cannot edit → `wingfoil directive assign` exits `1` with the pinned CONFLICT message; the file and HEAD are unchanged (`git status --porcelain` empty, no new commit).
- (red-first) The same input with `--force` → exit 0, one `wf`-scoped commit containing only `roles.yaml`, and stderr carries a `warning:` line enumerating the normalizations (comments, quoting, key order), per dl-062 Q1 option 3. Under `--format json` and `--format yaml` stdout parses and has the same content as without the warning.
- (characterization) With no `roles.yaml` committed, `directive assign` writes the whole file unflagged and emits no warning (dl-062: "nothing to preserve").
- (red-first) `coreOk` accepts `warnings: string[]`. The CLI registrar writes each to stderr and never to stdout. An MCP Tool result carries them in a declared field. A unit test per surface.
- (red-first) `docs/cli-reference.md` documents `--force` on `directive assign`; `test/docs/cli-reference.test.ts` passes.
- (characterization) spec-008 gets a dated Revision note: `--force` lives in a per-command-flag home (not §2 "Global flags"), and the CONFLICT and `global`-binding refusal strings are pinned beside the §6 error strings. The module TSDoc in `src/core/directive-assign.ts` no longer says "not implemented here".

## Implementation Notes

- **Size:** M · **wave:** 1 · **kind:** feature (`dl-133` Q1 (b)).
- **Implements:** dl-062 (Q1 option 3, flag `--force`, approve `4cd18767`; addendum "Implementation scheduling (2026-09-21)" §2–§3).
- **Features:** P3.2, P5.1.4.
- **Notes:** Proposal key: E1. files `src/core/directive-assign.ts`, `src/directives/roles-edit.ts`, `src/core/types.ts`, `src/cli/registrar.ts`, the MCP Tool result path (`src/mcp/`), `src/dna/set.ts`, `docs/cli-reference.md`, spec-008. Coordinate with the task implementing dl-050 / spec-016 §"Print `ExecutionContext.warnings` on stderr" (domain B): same stderr convention, one renderer. dl-062 remains `ready`; its `release` stamp is the approver's call. `bug-019` (the same fallback on `dna set`) is task-193's, which depends on this task for the success-warning channel. task-218 prints `ExecutionContext.warnings` through the same renderer.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-169-make-directive-assign-refuse-whole-file-rewrite-unless`, worktree
`../.wf2-wt/task-169`, cut from `main` at `cac8a447`. Start `36decaa2`. `bug: []`, so there are no
bug syncs.

### design (architect)

**`depends_on`** (dl-015): `task-127` Execution Notes read. What this task takes from them: approved
tech-specs are corrected with `memory amend` (`tech-spec` is `amendable: true` in `memory.yaml` 1.7),
so this task's spec edits are left uncommitted for the approver (Pending amendments, below). Nothing in
`task-127`'s code is reused here.

**Specs and decisions cited** (`awk '/^status:/{print $2;exit}'` on each): `spec-004`, `spec-005`,
`spec-006`, `spec-008`, `spec-016` `approved`; `dl-062` `ready`. The `dl-062` approve commit
(`git log -1 4cd1876`) ratifies Q1 option 3 with the flag `--force`, and Q2 option 1 (the `global`
wording as shipped by task-052).

**Design decisions** (to confirm at review):
1. **The channel.** `CoreResult`'s success arm gains `warnings?: readonly string[]`, and `coreOk`
   takes it as a third argument: `coreOk(value, commit?, warnings?)`. An empty list leaves no key, so
   every existing success keeps its exact shape (no existing `toEqual` changed). Plain strings, one
   operator-facing sentence each, in the order core recorded them.
2. **One CLI renderer**, `src/cli/warning.ts` (`emitWarning`, `emitWarnings`). The registrar calls it
   on success, before writing the payload. task-218 can call `emitWarning` directly for warnings it
   prints mid-run, and task-193 gets it through `coreOk` with no CLI change. The shapes are the ones
   `spec-016` §3.4 already fixed for `agent execute`, so no second convention appears: console
   `warning: <text>` (continuation lines indented, like `error.ts`'s detail lines); json one
   `{"warning": "<text>"}` per line; yaml one document per warning opened by `---`. The `---` is needed
   because two concatenated `warning:` mappings are invalid YAML (a repeated key). stderr only, under
   every `--format`, so stdout is unchanged.
3. **MCP.** A successful Tool result carries `structuredContent: {value, warnings}` when there are
   warnings. This is the success counterpart of task-130's refusal shape `{error, details}`. The text
   content stays the payload's JSON. `value` is repeated inside `structuredContent` so a client that
   prefers structured content still gets the payload. Resources get no field: no read-only operation
   returns warnings (candidate finding, below).
4. **The refusal wording changes.** The old text, `roles.yaml cannot be updated without discarding its
   comments; edit assignments.<role> by hand`, is false for a file with no comments, which now hits the
   same branch. New text: `roles.yaml cannot be updated in place; edit assignments.<role> by hand, or
   pass --force to rewrite the whole file`. It is pinned in spec-008 §6.
5. **`--force` authorizes and does not force.** If the in-place edit applies, it is used and there is
   no warning. The warning is emitted only when the whole-file `dump` actually rewrote an existing file.
   No `roles.yaml` means the unflagged dump and no warning (AC3). An idempotent request writes nothing
   and warns nothing.
6. **Warning text** lists what `dl-062`'s Context measured a `dump` loses (comments, quoting, blank
   lines, CRLF, `1.0` becoming `1`), plus key order and flow style as the AC names them:
   `roles.yaml was rewritten as a whole file (--force): comments were dropped, and quoting, key order,
   flow style, blank lines, line endings and number formatting (1.0 becomes 1) were not preserved`.
   Key order is in fact kept by `js-yaml` (insertion order). The text says "not preserved", meaning not
   guaranteed, because the AC lists it.
7. **The flag's home in spec-008**: a new §12 "Command-specific flags", which also lists `paths --list`
   (the one such flag already shipped). §2's lead line names `--reason` as its one shared, non-global
   exception and points to §12. This settles `dl-062`'s scheduling addendum §3, which left the choice to
   the spec owner.
8. **The warning rendering rule is declared in spec-008 §6**, beside the error format. The
   `CoreResult` shape is in spec-006 §2 and the MCP field in spec-004 §4.3 item 5. All three are
   pending amendments.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — no `#`, unsupported shape → exit 1 CONFLICT, nothing changed | **red-first** | on `cac8a447` a comment-free file was rewritten at exit 0 |
| 2 — `--force` → exit 0, one commit, stderr `warning:`, json/yaml stdout unchanged | **red-first** | no `--force` and no warning channel existed (`grep -rn warnings src/core/types.ts src/cli/registrar.ts` → nothing on `cac8a447`) |
| 3 — no `roles.yaml` → unflagged write, no warning | characterization | the unflagged dump already existed; the test pins that no warning is added |
| 4 — `coreOk` warnings, CLI stderr, MCP declared field, one unit test per surface | **red-first** | new |
| 5 — `docs/cli-reference.md` documents `--force`; the reference test passes | **red-first** through a new reference check (below) | the existing test checked commands and positionals, not flags |
| 6 — spec-008 Revision note; module TSDoc no longer says "not implemented here" | characterization (documentation) | — |

### red (developer)

`80b59c45`:
- `test/core/directive-assign.test.ts`: the comment-free CONFLICT case (it replaces the old "falls back
  to a whole-file rewrite only when the file has no comment to lose", which pinned the behaviour
  `dl-062` rules out), the comment case with the new wording, `--force` (rewrite, warning, one commit,
  only `roles.yaml`), `--force` on an editable file, `--force` with nothing to change, the `--force`
  flag registration, and an AC3 no-warning assertion.
- `test/core/core-result-warnings.test.ts`, `test/cli/success-warnings.test.ts` and
  `test/mcp/success-warnings.test.ts`: one suite per surface (AC4).
- `test/cli/directive-assign-force.integration.test.ts`: AC1–AC3 through `dist/cli.js` (exit codes,
  `git status --porcelain`, HEAD, stderr, `--format json|yaml` stdout parsed).
- `test/docs/cli-reference.test.ts`: a new check that every declared flag and option is named in its
  entry. A `--entry-<field>` pattern covers the derived `dna add`/`dna update` options.

The suites read `warnings` through an untyped accessor, so the red is assertion failures and not a
compile error. `npm run build && npx jest <the six suites>` gave **5 suites failed, 16 tests failed,
49 passed**. The 16 are every red-first case. The AC3 cases passed, as characterization should. The
new reference check passed at this commit, because nothing declared `--force` yet. Its red came in
green: once the flag was declared, before the reference entry was written, it failed with
`+ "directive assign: --force"` (1 failed, 3 passed).

### green (developer)

`9c0c7e99`:
- `src/core/types.ts`: `warnings` on the success arm, and the `coreOk` third argument.
- `src/cli/warning.ts` (new): the renderer. `src/cli/registrar.ts` calls `emitWarnings` before
  `renderSuccess`.
- `src/mcp/registrar.ts`: the Tool success `structuredContent`.
- `src/core/directive-assign.ts`: `rolesRewriteConflict`, `ROLES_REWRITE_WARNING`, and
  `updateRoleAssignments(…, { force })` with the `#` test removed. The module TSDoc now describes the
  implemented contract (AC6).
- `src/core/index.ts`: the `force` flag on `directiveAssign`, threaded through.
- `docs/cli-reference.md` (marked Unreleased (v0.3)): `[--force]` in the synopsis, a `--force` item,
  and a paragraph on warnings under *Exit codes*.
- `P3.2-directive-assign.feature`: two scenarios, "Error - roles.yaml cannot be edited in place" and
  "Rewrite roles.yaml as a whole file with --force". Their test cases are labelled in the integration
  suite. BDD here runs as Jest suites that mirror the scenarios (`grep -rln P3.2-directive-assign.feature
  test` → `test/core/directive-assign.test.ts`), with no runner.

`npx jest` on the six suites → 65/65 passed. `node dist/cli.js directive assign --help` lists
`--force` with its description. `directive create --force` in an empty repository → `error: unknown
option '--force'`, exit 2 (spec-008 §12's claim that an undeclaring command refuses it).

### refactor (developer)

`75bbd212`: `updateRoleAssignments`'s `options` became required. Its one caller always passes it, and
the `= {}` default was an uncovered branch (`directive-assign.ts` line 350 in the first coverage run).
The test header now names the `--force` cases.

Gates, on the final tree (`75bbd212` plus these notes), with the pending amendments in the working tree (`npm run build` first):

| Command | Result |
|---|---|
| `npm run test:coverage` | exit 0; 192 suites / 3220 tests; 98.85 / 95.26 / 95.03 / 99.54 (stmts / branches / funcs / lines). `main` `cac8a447`, measured in a temporary worktree: 3192 tests, 98.84 / 95.20 / 95.01 / 99.54, so no regression |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |

Run notes:
- `npm run -s test:coverage` also failed `test/cli/publish-secrets.test.ts` "publishes (dry run)…".
  That is the `-s` artefact `task-127` recorded: the inner `npm publish` inherits the silent
  loglevel. It passes without `-s` and alone (24/24).
- That run also failed `test/mcp/resource-latency.test.ts` (REQ-PERF-04 p95) once, under the parallel
  load of other worktrees. Alone: 4/4 passed. The run without `-s` above was green.

### review (reviewer, self)

- AC1: integration "AC1" (exit 1, exact stderr, empty porcelain, HEAD and bytes unchanged) and the core
  CONFLICT cases.
- AC2: integration "AC2" ×3 (exit 0, one commit `wf(directive): assign testing to developer` holding
  only `roles.yaml`, stderr `warning: …`, json and yaml stdout parsed equal to the payload, warning
  parsed from stderr).
- AC3: integration "AC3" (no stderr) and the core no-warning assertion.
- AC4: `core-result-warnings`, `cli/success-warnings` (stdout byte-identical with and without warnings
  under all three formats), `mcp/success-warnings`.
- AC5: the new reference check and the entry.
- AC6: spec-008 Revision note (pending amendment); `grep -n "not implemented here"
  src/core/directive-assign.ts` → nothing.
- Same-class check in files touched: `grep -rn "discarding its comments" src test docs/cli-reference.md`
  → nothing left. No other `CoreResult` success is re-wrapped in a way that could drop warnings, since
  only `directive assign` produces them today. `src/dna/set.ts`'s silent fallback (`bug-019`) is
  task-193's and was left alone; that task takes the channel from here.

### Pending amendments (approver)

Uncommitted in the worktree. Proposed `memory amend` reasons:

- `spec-008-cli-grammar`: `--reason "dl-062 Q1 option 3 and Q2, carried out by task-169: a new section 12 lists command-specific flags (directive assign --force, paths --list), and the section 2 lead line points there instead of claiming every flag is global. Section 6 pins the directive assign CONFLICT reason and the global-binding refusal, and declares the stderr warning format of a successful command (spec-016 section 3.4 shapes)."`
- `spec-006-core-domain-api`: `--reason "dl-062 Q1 option 3, carried out by task-169: section 2's CoreResult success arm gains the optional warnings list, the success-warning channel the --force rewrite needs, and says where each surface renders it."`
- `spec-004-mcp-surface-contract`: `--reason "dl-062 Q1 option 3, carried out by task-169: section 4.3 item 5 says a successful Tool result carries the operation's warnings as structuredContent {value, warnings}, the success counterpart of item 4's refusal shape."`
