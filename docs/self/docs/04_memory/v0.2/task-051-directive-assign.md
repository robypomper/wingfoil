---
id: "task-051-directive-assign"
type: task
title: "Implement `wingfoil directive assign`"
status: in-progress
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
