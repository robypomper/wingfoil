---
id: "task-051-directive-assign"
type: task
title: "Implement `wingfoil directive assign`"
status: approved
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.2"
bug: ""
depends_on: ["task-034-role-based-binding"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.2** (US-4-05): assign a directive to a role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.2-directive-assign.feature`.

Key scenario: `wingfoil directive assign --directive testing --role developer` → role lists `testing`; exit 0.

## Implementation Notes

Depends on REQ-SYS-08 role-based binding (`task-034`). Writes `roles.yaml`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Directives loaded: architecture, determinism, traceability (+ global doc-versioning, documentation,
security-secrets).

#### Ground truth checked before classifying

- `grep -rn "directiveAssign\|directive assign" src test` → only doc comments (`src/core/index.ts:749`
  names `directiveAssign` as later scope; `src/dna/roles.ts:22`); no declaration, no registration.
- `grep -rn "unknown directive" src test` → **no hit**. `unknown role '<role>' (not defined in dna.yaml)`
  exists only as `UnknownRoleError`'s message (`src/dna/roles.ts`, task-034) and
  `grep -rn "UnknownRoleError\|assertRoleDefined\|isRoleDefined" src | grep -v src/dna/roles.ts` finds
  only the `src/dna/index.ts` re-exports — no command path calls it.
- Nothing in `src/` writes `.wingfoil/roles.yaml` except `wingfoil init`'s scaffold
  (`rolesYaml()`, `src/storage/templates.ts:278`, block style, with comments).
- Baseline on the branch point (`8a6a091`): `npx jest --maxWorkers=4` → **85 suites / 1142 tests passing**.

#### T1 — acceptance-criteria classification (`agent.classify_acs`)

AC source: `docs/02_requirements/02_bdd/features/p3-directives/P3.2-directive-assign.feature`
(3 scenarios) + the constraints handed to this task at design (comment preservation, determinism,
idempotence, built-in assignability, dl-029 role without assignments).

| AC | Criterion | Class | Evidence |
|----|-----------|-------|----------|
| AC1 | Sc.1 `directive assign --directive testing --role developer` → `developer` lists `testing`; exit 0; one commit touching only `.wingfoil/roles.yaml` | **red-first** | no `directiveAssign` op exists (grep above) |
| AC2 | Sc.2 `--role wizard` → nothing written/committed; exit 1, `unknown role 'wizard' (not defined in dna.yaml)` | **red-first** | the message class exists but no command reaches it |
| AC3 | Sc.3 `--directive ghost` → nothing written/committed; exit 1, `unknown directive: ghost` | **red-first** | string absent from `src/` |
| AC4 | `roles.yaml` comments/formatting preserved: only the added line(s) differ | **red-first** | no writer exists |
| AC5 | Idempotent: re-assigning an already-assigned directive → exit 0, file byte-identical, **no commit** (P3.7 Sc.2 "Binding is idempotent … exits with code 0") | **red-first** | no writer exists |
| AC6 | A built-in directive (file under `built-in/`) is assignable; the asset file is not modified (dl-030/REQ-SEC-07: assignment is not modification) | **red-first** | no writer exists |
| AC7 | A DNA-defined role with no `assignments` entry (dl-029) gets a new key, inserted before the block's trailing comments | **red-first** | no writer exists |
| AC8 | Registration: `directive.directiveAssign`, `mutates: true` → CLI `wingfoil directive assign`, Tool `directive.assign` (dl-041 B); parity/registry/agent-channel enumerations widened | **red-first** | not registered |
| AC9 | Missing `--directive` / `--role` → exit 2 `missing required argument: --<name>` (spec-008 §4 wording, same as `directive create`) | **red-first** | not registered |

No characterization ACs claimed: the `UnknownRoleError` message is task-034's and stays pinned by
`test/dna/roles.test.ts`; this task only reuses it.

#### `agent.read_related` (dl-015, hard gate) — acknowledged

- **task-034-role-based-binding** (`depends_on`) — `src/dna/roles.ts` is canonical for *binding*
  (dl-033 option b) and scoped out of approval. I use **only** `isRoleDefined` + `UnknownRoleError`
  (exact P5.4.2/P3.2 message) to validate `--role` against `dna.yaml` `team.roles` (REQ-SYS-08). No
  approval question is asked here, so `src/core/approval-authority.ts` is not involved. The third-pass
  lesson (prose claims about other modules need evidence) is applied: every cross-module claim in
  these notes carries the grep that settles it.
- **task-050-directive-create** — `directiveAssign` registers on the **singular `directive`**
  CoreModule (its note + dl-041 B), after `directiveCreate`. I copy its mutating-op order: identity
  pre-flight → usage (`UsageError`, exit 2) → domain checks (`coreErr`, exit 1) → write + one scoped
  commit (`wf(directive): …`). Its D4 path-safety point does not arise: the write target is the fixed
  `.wingfoil/roles.yaml`, never built from user input.
- **task-053-directives-list** — role→directive binding is keyed by directive **id**
  (`frontmatter.id`), `assignments` + `global`; a missing `roles.yaml` means "no bindings". I keep
  both readings. `src/core/directives-list.ts` is **not** touched (task-055 is rewriting it).
- **task-054-project-directives** — directives live under `directives/{built-in,custom}/`;
  `loadDirectives` walks both. The directive-exists check is over that whole set, so a built-in id is
  valid (dl-037: binding is by id, independent of subfolder).
- **task-063 / bug-004 / bug-019** — precedent for comment-preserving YAML edits without a new
  dependency (dl-010): a line-oriented in-place edit, rendering scalars with `js-yaml` `dump`, plus a
  re-parse self-check. **bug-019's lesson is applied the other way round**: when the in-place edit is
  impossible, this writer falls back to a whole-file `dump` **only if the file has no `#` at all**
  (nothing to lose); otherwise it **fails closed** (`CONFLICT`, exit 1, file untouched) instead of
  silently discarding comments.

#### Decision-logs / bugs handed to this task — acknowledged

- **dl-041** (ready, `ebfb1e3`): register on `directive`; remove the *(planned)* marker from spec-006
  §3's `directiveAssign` row once registered. spec-006 carries no `version:` field
  (`grep -n "^version" spec-006…` → none), so no bump applies.
- **dl-033**: binding resolver only; see task-034 above.
- **dl-029**: a role defined in DNA but absent from `assignments` is legal (globals-only). Assign to it
  inserts the key (AC7) — never an error.
- **dl-037**: assignment is by id; built-in vs custom precedence is a *resolution* concern
  (task-055/`context.ts`), not an assignment one — nothing here depends on which file wins.
  *(Post-merge note: task-055 has since landed on `main` (`9c83ca2`) with the custom-wins rule and the
  `{entries, warnings}` listing payload; still nothing in this task depends on it — only the CLI
  integration test that reads `directives list` output was adapted to `.entries` in the merge commit.)*
- **dl-030 / REQ-SEC-07**: immutability is about removing/modifying assets; assigning a built-in only
  edits `roles.yaml`, so it is allowed (AC6 asserts the built-in file is byte-identical and absent
  from the commit). `requireCustomAsset` is deliberately not called.
- **bug-027** (planned, fixed inside task-045): `commitPaths` commits the whole index. I call it with
  the single path `.wingfoil/roles.yaml` and **do not rely** on whole-index behaviour: tests assert
  the commit's file list is exactly that path from a clean index; no test stages unrelated files
  (that regression test belongs to bug-027's fix). Not fixed here.

#### `agent.verify_specs`

| Question | Authority (status) |
|---|---|
| op name / module / mutates / CLI / Tool | spec-006 §3 row `directiveAssign` · `directive` · true · `wingfoil directive assign` · Tool `directive.assign` (approved, dl-041) |
| exit codes, `error: <reason>` | spec-008 §4–§6 (approved), `src/core/exit-code.ts` |
| role catalogue = `dna.yaml` `team.roles` | spec-002 (approved) "referenced by name and semantically validated against this list"; REQ-SYS-08 |
| `roles.yaml` location/shape | spec-011 (approved) `roles.yaml` = `assignments:` map + `global:` list; `RolesYaml` schema ([AUTHORING], task-037) |
| identity pre-flight | REQ-SEC-01 via `requireGitIdentity` |

**No new tech-spec scaffolded → design is a pass-through.** One wording drift found and **not**
decided here: spec-011 lines 105/118 say `roles.yaml` binds by directive **name**; `RolesYaml`'s TSDoc,
`resolveRoleDirectives` and task-053 bind by **id**. Today `id == name` on every scaffolded and
`directive create`d file (task-050 D5), so no behaviour differs; I match `--directive` against **id**,
consistent with the code. Reported as a proposed decision-log.

#### Design decisions

- **D1 — reusable writer, split pure/impure** (task-052 remove and task-056 multi-assign will reuse it):
  - `src/directives/roles-edit.ts` (pure leaf, imports `js-yaml` only):
    `withAssignedDirectives(current, ids)` — set-union that keeps existing order and appends new ids in
    argument order, de-duplicated (deterministic, no sort, so existing lines never move); and
    `setRoleAssignmentsInText(text, role, next)` — the comment-preserving editor. Its contract is
    general: it rewrites `assignments.<role>` to **exactly** `next`, as long as `next` is the current
    list with some items deleted followed by appended ids (covers assign, multi-assign and remove),
    keeping every untouched line — incl. comments inside the list — byte-for-byte; returns
    `undefined` for anything it cannot prove (flow lists other than `[]`, multi-line items, tabs,
    mixed line endings, failed re-parse self-check).
  - `src/core/directive-assign.ts`: `checkAssignable(dna, directiveFiles, role, ids)` (role first,
    then each id in argument order — first failure wins, nothing written: satisfies P3.7's "no partial
    assignment" too) and `updateRoleAssignments(root, role, update, message)` — the **one**
    read → edit (or safe fallback / fail-closed) → validate (`RolesYaml`) → write → `commitPaths`
    path. A missing `roles.yaml` is created with a deterministic `dump` (nothing to lose).
  - `src/core/index.ts`: one contiguous `DirectiveAssignParams` + `directiveAssignFn` block right after
    `directiveCreateFn`, one registration entry in the `directive` module, one import line — kept off
    the `memory` block (task-045) and `directives-list` (task-055).
- **D2 — check order**: `requireGitIdentity` → `--directive` / `--role` presence (exit 2) → load
  `dna.yaml` → role defined? (`NOT_FOUND`, exact message) → load directives → id exists? (`NOT_FOUND`,
  `unknown directive: <id>`) → load/parse `roles.yaml` (schema-invalid → `VALIDATION`) → idempotent
  short-circuit → write + commit. Role before directive: the BDD pins no order for a request where both
  are wrong; the role is the binding's target and the REQ-SYS-08 check, so it goes first. `NOT_FOUND`
  because both inputs are well-formed but name nothing that exists (spec-006 §2).
- **D3 — idempotence** (P3.7 Sc.2, which this verb is the CLI for): already assigned → `coreOk`, no
  write, **no commit** (no empty commit — the `dna set` no-op precedent). Result value always carries
  the role's resulting list so the caller sees "developer lists testing".
- **D4 — commit subject** `wf(directive): assign <id> to <role>`, staging only `.wingfoil/roles.yaml`.
- **D5 — determinism** (REQ-SYS-07): output bytes are a pure function of (file text, role, ids); no
  clock, randomness or unordered iteration; scalars rendered with the same `dump` call task-063 uses.
- **D6 — fail-closed on comment loss** (new user-visible outcome, not in any spec — flagged for the
  approver): `CONFLICT`, `roles.yaml cannot be updated without discarding its comments; edit
  assignments.<role> by hand`. Unreachable on the `wingfoil init` scaffold and on this repository's own
  `roles.yaml` (both block style); reachable only for hand-written flow lists.
- **Out of scope**: `directive remove` (task-052), multi-id CLI grammar (task-056), `global` edits,
  MCP `inputSchema` details beyond what the registrar derives.

### red — role: developer (commit `101d387`)

- `test/directives/roles-edit.test.ts` — the pure writer: set-union semantics, append/insert/delete,
  comment + inline-comment + CRLF preservation, indentation adoption, every refusal shape.
- `test/core/directive-assign.test.ts` — the registered op against throwaway repos with the real
  `wingfoil init` Scrum scaffold (Sc.1 precondition: `testing` unbound from `developer`, committed).
- `test/cli/program.integration.test.ts` — a `directive assign` block through the compiled CLI.
- Widened the three verbatim enumerations: `test/core/production-registry.test.ts`,
  `test/core/parity.test.ts`, `test/mcp/read-only-agent-channel.test.ts`.

Observed red (`npx jest test/core/directive-assign.test.ts test/directives/roles-edit.test.ts
test/core/parity.test.ts test/core/production-registry.test.ts test/mcp/read-only-agent-channel.test.ts`):
**5 suites failed; 25 failed / 20 passed**. `roles-edit.test.ts`: `Cannot find module
'../../src/directives/roles-edit'`. `directive-assign.test.ts`: 20 failed / 1 passed — every behaviour
case fails with `fixture bug: "directiveAssign" operation not registered on the directive module`; the
one pass is the `deriveVerb('directive','directiveAssign') === 'assign'` derivation, which is the
generic, pre-existing registrar rule (it pins dl-041's expectation, not new code). The other 19 passes
are the untouched pre-existing cases of the three widened suites. CLI (`-t "BDD Sc.2"`): stderr
`error: unknown command 'assign'` instead of the BDD message.

### green — role: developer (commit `4e0118f`)

- `src/directives/roles-edit.ts` — `withAssignedDirectives`, `setRoleAssignmentsInText` (imports
  `js-yaml` only).
- `src/core/directive-assign.ts` — `checkAssignable`, `updateRoleAssignments`, `ROLES_YAML_PATH`.
- `src/core/index.ts` — one import line each for `./directive-assign` and `../directives/roles-edit`,
  `loadDirectives` re-added to the `./loaders` import, one contiguous `DirectiveAssignParams` /
  `DirectiveAssignResult` / `directiveAssignFn` block after `directiveCreateFn`, one registration
  entry after `directiveCreate` in the `directive` module. No other block touched.
- Full suite: **87 suites / 1197 tests passing**.

### refactor — role: developer (commits `ace9f6e`, `22cd921`)

- Coverage showed dead or untested paths in the writer; removed the unreachable ones rather than
  testing around them (`readsBackAs`'s absent-role branch, which the early `result === text` return
  already made unreachable; the non-`ValidationError` rethrow around `parseYaml`, which throws nothing
  else — `src/validation/yaml.ts`; a second `RolesYaml` pass on output that the self-check / `dump`
  already guarantee, reasoning recorded in `updateRoleAssignments`' TSDoc) and pinned the reachable
  refusals with tests (multi-line id rendering, lone CR, flow-mapping child line, `role: ~`, invalid
  YAML elsewhere in the file, **a YAML alias shared with another role** — the self-check refuses an
  edit that would silently change the aliasing role too — **this last claim was wrong; corrected in the
  second pass below**).
- Refreshed stale docs: `CORE_MODULES` header (listed `directiveAssign` as later scope), the
  `src/directives` barrel doc + re-export of the writer.
- `docs(self)`: spec-006 §3 `directiveAssign` row — *(planned)* marker removed per dl-041.

### sync with main (merge `878b5aa`, dl-035)

`git merge main` (main at `9c83ca2`, task-055 merged): one conflict in `src/core/index.ts` imports
(`DirectiveListEntry` → `DirectiveListing` from task-055, plus my `./directive-assign` import), resolved
keeping both; the CLI test reading `directives list` output adapted to the `{entries, warnings}`
payload. `git diff --stat 8a6a091 main -- docs/` touched only task-055's own file — no spec or dl cited
in these notes changed.

### review-ready summary

**BDD P3.2 scenario → proving tests**

| Scenario | Core test (`test/core/directive-assign.test.ts`) | CLI test (`test/cli/program.integration.test.ts`) |
|---|---|---|
| Assign a directive to a role | `Sc.1: assigns testing to developer — the role lists it, one commit touching only roles.yaml, exit 0` | `assigns, commits only roles.yaml, and directives list --role developer now lists testing (BDD Sc.1)` |
| Error - role not defined in DNA | `Sc.2: an undefined role exits 1 with the exact message and makes no assignment` | `an undefined role exits 1 with the exact BDD message (BDD Sc.2)` — stderr exactly `error: unknown role 'wizard' (not defined in dna.yaml)` |
| Error - non-existent directive | `Sc.3: a non-existent directive exits 1 with the exact message and makes no assignment` | `a non-existent directive exits 1 with the exact BDD message (BDD Sc.3)` — stderr exactly `error: unknown directive: ghost` |

AC4–AC9 tests: `AC4: preserves every comment and line …` (diff `--numstat` = `1 0`), `AC5: re-assigning …
commits nothing`, `AC6: a directive that exists only under built-in/ is assignable; the asset file is
untouched`, `AC7: assigns to a DNA role absent from roles.yaml …`, `AC9: options … is a usage error`,
registration block (3 cases), plus the writer suite (36 cases; `npx jest test/directives/roles-edit.test.ts` → `Tests: 36 passed`).

**End-to-end on the compiled CLI** against a copy of this repository's own comment-rich
`docs/self/.wingfoil/` in a scratch repo: `directive assign --directive security --role developer` →
exit 0, `wf(directive): assign security to developer`, `git show --stat` = `.wingfoil/roles.yaml | 1 +`;
re-run → exit 0, no commit; `--role approver` (defined in DNA, absent from `roles.yaml`) → `+  approver:`
/ `+    - security` inserted after `tech-lead`'s list, before `# Global directives …`; `--role wizard` →
exit 1 exact message; `--directive ghost` → exit 1 exact message; no `--directive` → exit 2
`missing required argument: --directive`. Comment lines before/after: 7 / 7
(`grep -c '#' .wingfoil/roles.yaml`); `git diff --numstat seed HEAD` = `3 0`.

**Gates (after the merge, at `878b5aa`)**

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --coverage --maxWorkers=4` | **87 suites / 1227 tests passing** |
| coverage | same | All files **98.49 stmts / 91.53 branch / 98.58 funcs / 99.04 lines**; baseline at `8a6a091` (detached scratch worktree, same command) 98.29 / 90.18 / 98.44 / 98.93 → non-regressing; `src/core/directive-assign.ts` and `src/directives/roles-edit.ts` **100/100/100/100** |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| test types | `npx tsc --noEmit -p tsconfig.json` | only the pre-existing bug-026 error `test/core/directive-create.test.ts(159,19) TS2339` |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**For the reviewer / approver**

- **D6 is a new user-visible outcome no spec pins**: a hand-written `roles.yaml` the in-place editor
  cannot handle (e.g. non-empty flow lists) *and* that contains a `#` gets `CONFLICT`,
  `roles.yaml cannot be updated without discarding its comments; edit assignments.<role> by hand`
  (exit 1). Without a `#`, a whole-file `dump` is used. Unreachable on the `wingfoil init` scaffold and on
  this repository's own `roles.yaml`. The `#` test is conservative (a `#` inside a quoted scalar also
  triggers it — fail-closed direction).
- **Role checked before directive** when both are wrong (the BDD pins neither order).
- **Missing `roles.yaml` is created** (deterministic `dump`, no comments) rather than being an error.
- **bug-027 dependency**: `updateRoleAssignments` commits via `commitPaths(root, ['.wingfoil/roles.yaml'])`;
  until task-045 lands the fix, anything the user pre-staged is swept into the `wf(directive): assign`
  commit. Tests start from a clean index and do not rely on or test that behaviour.
- **Reuse surface for task-052 / task-056**: `setRoleAssignmentsInText(text, role, next)` already
  supports deletions and emptied lists (`role: []`) and is tested for them; `checkAssignable` takes an
  id list and validates all before writing (P3.7 "no partial assignment"); `updateRoleAssignments`
  takes an `update` function and a commit message. P3.3's "still assigned to role" reference check
  and P3.7's multi-id CLI grammar are **not** implemented here.
- The `Warning: … unknown field(s) ignored: scope` lines on stderr when running against this
  repository's own directives are pre-existing loader behaviour (also printed by `directives list`),
  not introduced here.
- Merge commit `878b5aa` carries one test adaptation (the `.entries` read), not only conflict markers.


---

## Execution Notes — second pass (returned to `red` by the review gate, `b117011`)

The review upheld the implementation — a 60-case fuzz of the writer against `js-yaml`, the check order,
the exit codes, idempotence, registration and the first merge resolution were all verified correct —
and rejected the task for **one false claim in these notes**: that the writer's re-parse self-check was
pinned by a test. It was not. This section is appended; the first-pass sections stay as written, with
the one wrong sentence marked in place above.

### the finding, reproduced

The fixture the notes named (`test/directives/roles-edit.test.ts`, `qa: *d` **inside** the
`assignments:` block) never reaches `readsBackAs`: `mappingEntry('qa: *d')` loads that one line on its
own and `js-yaml` throws `unidentified alias "d" (1:7)`, so `setRoleAssignmentsInText` returns
`undefined` at the key scan, long before the self-check. Verified two ways:

```
$ node -e "require('js-yaml').load('qa: *d')"     → unidentified alias "d" (1:7)
# mutant: readsBackAs's final line reduced to `return roleMatches;`
$ npx jest test/directives/roles-edit.test.ts test/core/directive-assign.test.ts
  Tests: 58 passed, 58 total          ← the self-check could be deleted and nothing failed
```

### the correction

Added a fixture whose alias sits **outside** the assignments child lines, which is what actually
reaches the self-check — `assignments:` / `  developer: &d` / `    - testing` / `global: *d`
(appending to `developer` would silently rewrite `global` too). Mutation-proof, both directions:

```
# real code, with the new fixture
$ npx jest test/directives/roles-edit.test.ts test/core/directive-assign.test.ts
  Tests: 59 passed, 59 total
# mutant `return roleMatches;`, same command
  Tests: 1 failed, 58 passed, 59 total      ← "a list the `global` key aliases"
# and the mutant's own output for that fixture, i.e. the harm the check prevents:
  "assignments:\n  developer: &d\n    - testing\n    - security\nglobal: *d\n"
  (re-parsed: global === ["testing","security"] — silently changed)
```

The misplaced comment (it described the alias case but sat above the lone-CR case) was moved onto the
two alias fixtures, which now state which guard refuses each.

### re-checking the other refusal claims the same way — four of six were overstated

The first pass's refactor paragraph said the reachable refusals were "pinned … with tests". Each
fixture does pin the **refusal** (its `toBeUndefined()` assertion is real), but a mutation run shows
that for four of them the named guard is **not** what refuses the input: a later guard catches it once
the named one is removed, so those guards are layered defence rather than independently necessary.
Each mutant was applied to `src/directives/roles-edit.ts`, then:
`npx jest test/directives/roles-edit.test.ts test/core/directive-assign.test.ts`.

| mutated guard | fixture it was claimed to pin | result | reading |
|---|---|---|---|
| `readsBackAs` final `roleMatches && sameJson(…)` → `roleMatches` | `a list the global key aliases` | **1 failed / 58 passed** | genuinely pinned |
| `readsBackAs` `if (!before \|\| !after) return false` → `return true` | `invalid YAML outside the assignments block` | **1 failed / 58 passed** | genuinely pinned |
| lone-CR guard disabled | `a lone CR line ending` | 59 passed | still refused — by the `^assignments:$` header scan (with no `\n` split, the single line never matches) |
| `mappingEntry` single-key guard disabled | `a flow-mapping child line` | 59 passed | still refused — by `rewriteRole`'s non-empty-flow check |
| `renderScalar` multi-line guard disabled | `refuses an id whose rendering would span several lines` | 59 passed | still refused — by the self-check |
| `renderKeyLine` unmatched-line guard altered | `a tagged/null key line …` | 59 passed | still refused — by the self-check |

Nothing was removed on the strength of this: every mutant still refuses every fixture, so no
behavioural change is observable, and the early guards give a cheaper, more local refusal than letting
a bad edit reach the re-parse. The accurate statement — the one this pass makes — is that the fixtures
pin the **refusals**, and that only the two self-check branches above are attributable to the guard
their comment names. A reviewer who prefers fewer layers can delete the four redundant guards as a
separate cleanup; that is a judgement call, not a defect, so it is recorded here rather than acted on
inside this task.

### second sync with main (merge `311f23e`, dl-035 — merge, never rebase)

`main` at `194ff91` (task-045 memory-submit **including the bug-027 fix**, task-057 built-in directive
templates, task-058, bug-028..041, dl-046..060). Three conflicts, all the same shape — a verbatim
operation list extended by both sides — resolved as the **sorted union**, with no contradictory
`toEqual` left behind:

- `test/core/production-registry.test.ts` — the registry list itself auto-merged to five entries; only
  the test title conflicted (`four operations mutate` on each side) → `five operations mutate today —
  directive.directiveAssign, directive.directiveCreate, dna.dnaSet, memory.memoryAdd +
  memory.memorySubmit`.
- `test/core/parity.test.ts` — `cli`/`tools` → the 5-element union; the Tools list and **both**
  `not.toContain` lines (`wingfoil://directive/assign` and `wingfoil://memory/submit`) kept.
- `test/mcp/read-only-agent-channel.test.ts` — `mutatingOps` and the Tools list → the 5-element union.
- `src/core/index.ts` — no conflict, but its `CORE_MODULES` header still listed `memorySubmit` as later
  scope; corrected (the remaining examples are now `memoryApprove`, `directiveRemove`, `workflowStart`).

**bug-027 is fixed on `main`** (`commitPaths` now runs `git commit --only -- <paths>`), so the first
pass's TSDoc and test-header caveat ("commits the whole index … callers must not rely on it") were
stale. Both corrected, and the property is now pinned at this call path:
`test/core/directive-assign.test.ts` › *a change someone else staged is NOT swept into the
`wf(directive): assign` commit, and stays staged* (mirrors `test/core/memory-submit.test.ts`'s case).

### approver decisions read this pass (dl-053, dl-054) — effect on this task

- **dl-053** (illegal-transition `<to>` = the verb's first legal edge in `sequence`, then the next edge
  of the same verb when the current state *is* that target, else `(none)`): **no effect** — nothing in
  this task touches the Memory state machine or emits that message.
- **dl-054** (`[from → to]` belongs to `approve`/`reject`/`deprecate`; `add` and `submit` stay plain):
  the resubmit commit is therefore `wf(task): submit task-051-directive-assign`, with no bracket. The
  first-pass `submit` (`a74d787`) and the `start` commit keep the older bracketed form as history,
  exactly as dl-054's reason anticipates.

### gates — post-merge run (at the resubmit HEAD)

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --coverage --maxWorkers=4` | **94 suites / 1387 tests passing** |
| coverage | same | All files **98.51 stmts / 91.90 branch / 98.73 funcs / 99.13 lines**; `main` at `194ff91`, same command in a detached scratch worktree: 98.36 / 90.91 / 98.64 / 99.06 → non-regressing. `src/core/directive-assign.ts` and `src/directives/roles-edit.ts` stay **100/100/100/100** |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| test types | `npx tsc --noEmit -p tsconfig.json` | only the pre-existing bug-026 error `test/core/directive-create.test.ts(159,19) TS2339` |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**End-to-end re-run after the merge**, same scratch-repo copy of this repository's `docs/self/.wingfoil/`:
`assign security to developer` → exit 0, subject `wf(directive): assign security to developer`,
`git show --stat` = `.wingfoil/roles.yaml | 1 +`; re-run → exit 0 and still 2 commits (idempotent);
`--role approver` → `+  approver:` / `+    - security`; `--role wizard` → exit 1
`error: unknown role 'wizard' (not defined in dna.yaml)`; `--directive ghost` →
`error: unknown directive: ghost`; no `--directive` → `error: missing required argument: --directive`.
`grep -c '#' .wingfoil/roles.yaml` = **7 before and 7 after**.

### still unfiled, for the approver (dl-060 already covers the id-vs-name point)

1. **D6's fail-closed `CONFLICT`** — a hand-written `roles.yaml` the in-place editor cannot handle
   *and* that contains a `#` gets exit 1 and `roles.yaml cannot be updated without discarding its
   comments; edit assignments.<role> by hand`. No spec pins this outcome; the alternative (silently
   dumping the file) is bug-019's defect, which is why it was chosen — but it is a user-visible
   behaviour invented inside a task.
2. **The whole-file fallback still loses formatting** — for a comment-free `roles.yaml` the fallback
   `dump` normalizes the layout (flow lists become block, quoting is re-decided). Nothing the schema
   carries is lost, but it is the same class of surprise as bug-019, one notch milder.
