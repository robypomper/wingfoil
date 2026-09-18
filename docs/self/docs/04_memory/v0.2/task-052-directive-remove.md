---
id: "task-052-directive-remove"
type: task
title: "Implement `wingfoil directive remove`"
status: in-review
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "p3"]
ref: "P3.3"
bug: ""
depends_on: ["task-042-immutable-builtin-assets"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.3** (US-6-07): remove an unreferenced custom directive; file deleted, removal committed.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature`.

Key scenario: `wingfoil directive remove legacy-rule` (unassigned) → file deleted; committed; exit 0.

**REQ-SEC-07 clause (b) — assigned to this task by `dl-030-req-sec-07-referenced-asset-ownership`.**
REQ-SEC-07's Fit Criterion has two halves. `task-042-immutable-builtin-assets` ships only the first
(a built-in cannot be removed). The second — *"removal of a still-referenced custom asset is rejected
naming the referrer"* — is this task's for the directive surface: removing a directive still assigned
to a role must be rejected with `cannot remove 'legacy-rule': still assigned to role 'developer'`
(P3.3, exact string). The workflow surface (P4.9, `cannot remove 'arch-review': included by
'release-cycle'`) has no owner in v0.2 and is carried to the next `release-planning` run.

Also per `task-042`'s review: `task-042`'s `requireCustomAsset` primitive is a pre-flight over a path
string. Its classification is now a fail-closed **allow-list** on the `custom` segment (the earlier
`'built-in'` substring deny-list was the defect that returned `task-042` to `red`), verified against
both POSIX and Windows separator forms.

**Resolve name → path before calling it.** P3.3's CLI takes a *name* (`wingfoil directive remove
testing`) while the primitive takes a `.wingfoil`-relative *path*. `task-042`'s reviewer ran this:
`requireCustomAsset('directive', 'testing')` returns the generic
`cannot remove 'testing': not a directive under 'directives/custom/'`, **not** P3.3's pinned
`built-in directives cannot be removed`. So this task must locate the asset first and pass its path,
or the pinned scenario will not pass.

## Implementation Notes

Depends on REQ-SEC-07 immutable built-ins (`task-042`) — must refuse to remove built-in assets.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Directives loaded: architecture, determinism, traceability (+ global doc-versioning, documentation,
security-secrets).

#### Ground truth checked before classifying (commands, not claims)

- `grep -rn "directiveRemove\|directive remove\|directive\.remove" src/ test/ | grep -v "\.feature"`
  → **only doc comments** (`src/core/builtin-asset.ts`, `src/core/directive-assign.ts`,
  `src/directives/roles-edit.ts`, `src/core/index.ts:979`, two test doc-headers). No declaration, no
  registration, no CLI command.
- `grep -rn "still assigned to role" src/ test/` → **no hit**. REQ-SEC-07 clause (b)'s message does
  not exist anywhere in the implementation.
- `grep -rn "unlinkSync\|rmSync\|removeDocument" src/` → **no hit**. `src/storage` has
  `readDocument`/`writeDocument`/`documentExists` only: there is **no file-deletion primitive** in the
  whole codebase. One is added here (`removeDocument`), the storage pillar keeping ownership of bytes
  on disk exactly as `writeDocument` does.
- `grep -n "directive" src/workflow/schema.ts` → **no hit**. P3.3's Background says "not assigned to
  any role *or workflow step*"; the workflow schema has no field that can reference a directive, so
  the workflow-step half of that precondition is **vacuous today**. Only the `roles.yaml` referrer is
  checkable, and only that half is what `dl-030` assigns to this task.
- Baseline on the branch point (`9147d84` + the `start` commit): `npx jest --maxWorkers=2` →
  **97 suites / 1452 tests, 0 failed**.

#### T1 — acceptance-criteria classification (`agent.classify_acs`)

AC source: `docs/02_requirements/02_bdd/features/p3-directives/P3.3-directive-remove.feature`
(3 scenarios) + this task's Acceptance Criteria (REQ-SEC-07 clause (b), the name→path gap) + the
governance handed to it at design (dl-041 B, dl-037/dl-042/dl-051).

| AC | Criterion | Class | Evidence | Test |
|----|-----------|-------|----------|------|
| AC1 | Sc.1 `directive remove legacy-rule` (unreferenced custom) → file deleted, removal committed, exit 0 | **red-first** | no `directiveRemove` op exists (grep above) | `Sc.1: removes an unreferenced custom directive — file deleted, one scoped commit, exit 0` |
| AC2 | Sc.2 `legacy-rule` assigned to role `developer` → not removed, exit 1, `cannot remove 'legacy-rule': still assigned to role 'developer'` | **red-first** | string absent from `src/` (grep above) | `Sc.2: refuses a directive still assigned to a role — exact P3.3 message, nothing removed, exit 1` |
| AC3 | Sc.3 `directive remove testing` (a real built-in) → not removed, exit 1, `built-in directives cannot be removed` | **red-first** | the *string* is pinned by task-042's `test/core/builtin-asset.test.ts`, but no op reaches it and the name→path resolution it needs does not exist | `Sc.3: refuses a built-in directive by NAME — REQ-SEC-07's exact message, exit 1` |
| AC4 | Registration `directive.directiveRemove`, `mutates: true` → CLI `wingfoil directive remove`, Tool `directive.remove` (dl-041 B); parity / production-registry / agent-channel enumerations widened | **red-first** | not registered | `is registered on the SINGULAR directive module as a mutates: true operation` + `derives the CLI command directive remove and the MCP Tool directive.remove` |
| AC5 | Missing `<name>` → exit **2**, `missing required argument: directive remove <name>` (spec-008 §5, `memory submit <id>` precedent) | **red-first** | not registered | `a missing <name> is a usage error — exit 2` |
| AC6 | Unknown name → exit 1, `unknown directive: <name>` (P3.2's exact wording, reused) | **red-first** | not registered | `an unknown directive name is NOT_FOUND — exit 1` |
| AC7 | REQ-SEC-01 identity pre-flight refuses before any read/delete | **red-first** | not registered | `refuses before any deletion when the git identity is unset (REQ-SEC-01)` |
| AC8 | dl-037: removing a custom directive that **shadows** a built-in deletes the custom file only, and the built-in then wins resolution (spec-012 §5.1 kind-3 shadow warning disappears) | **red-first** | no remove op; the precedence rule itself is task-055's and is reused, not re-derived | `removing a custom directive that shadows a built-in leaves the built-in, which then wins (dl-037/spec-012 §5.1)` |
| AC9 | Exactly ONE commit, staging only the directive file (`wf(directive): remove <name>`) | **red-first** | not registered | covered inside the Sc.1 test (`git show --name-only`) |

No characterization ACs claimed. AC3 is the closest call and is **not** characterization: what
task-042 pinned is `requireCustomAsset(kind, PATH)`; P3.3 Sc.3 invokes a NAME, and task-042's own
reviewer recorded that `requireCustomAsset('directive', 'testing')` returns the *generic* refusal, not
REQ-SEC-07's. The behaviour under test here — name → path → refusal with the pinned string — does not
exist and fails first.

#### `agent.read_related` (dl-015, HARD gate) — acknowledged

- **task-042-immutable-builtin-assets** (`depends_on`, `done`). Read both passes in full, including the
  "Corrections to the first pass". Consumed exactly as its second pass specifies:
  `requireCustomAsset('directive', relativePath)` is a **fail-closed allow-list** over a
  `.wingfoil`-relative path (`directives/custom/…`), returning `VALIDATION` (exit 1) — *not* `CONFLICT`.
  It is documented there as "the FIRST of two checks a remove op runs, never the only one"; this task
  supplies the second (clause (b)). Its stated name→path gap is the hand-off this task closes: I
  resolve the name against `loadDirectives(root)` and pass the located `DirectiveFile.path`, which is
  built as `join('directives', relativePath)` — exactly the shape the allow-list accepts, on either
  separator. `src/core/builtin-asset.ts` is **read-only** here; not one line is changed.
- **task-051-directive-assign** (`done`). Reused, not re-derived: `checkAssignable` is *not* called
  (there is no role argument to validate on a remove), but its two readings are kept —
  role→directive binding is keyed by directive **`frontmatter.id`** (not `name`), and a missing
  `roles.yaml` means "no bindings yet", not a failure. `updateRoleAssignments` /
  `setRoleAssignmentsInText` are deliberately **not called**: P3.3 refuses a still-assigned directive
  rather than unbinding it (see the reading below), so `roles.yaml` is never written by this command.
  That also keeps this task entirely off the `roles.yaml` CONFLICT code path whose behaviour is still
  being settled (see "Decision-logs handed to this task").
- **task-050-directive-create** (`done`). The mutating-op order is copied verbatim: identity pre-flight
  → usage errors (`UsageError`, exit 2) → domain checks (`coreErr`, exit 1) → filesystem change + ONE
  scoped `commitPaths` with a `wf(directive): …` subject. Its `directive`-module registration (D1) is
  what this op joins.
- **task-053-directives-list** (`done`) / **task-055** (merged). `DirectiveListEntry`/`DirectiveListing`
  and the `{entries, warnings}` payload are read only to assert AC8's before/after effect on the
  listing; `src/core/directives-list.ts` is **not modified**.
- **task-057-builtin-directive-templates** (`done`, merged). Verified on this branch that
  `wingfoil init` now installs six real built-ins under `.wingfoil/directives/built-in/`
  (`code-quality, testing, code-review, architecture, security, documentation` —
  `src/storage/builtin-directives.ts` + `templateScaffold`, `src/storage/templates.ts:419`). P3.3 Sc.3
  is therefore exercised against a **real scaffolded built-in**, not a hand-made fixture: the test
  calls `initWingfoilProject(repo, 'Scrum')` and removes `testing` by name.

#### Decision-logs / bugs handed to this task — acknowledged

- **dl-041** (`ready`) B: `directiveRemove` registers on the **singular `directive`** CoreModule →
  `deriveVerb('directive','directiveRemove') === 'remove'`, CLI `wingfoil directive remove`, Tool
  `directive.remove`. spec-006 §3's `directiveRemove` row carries `` `directive` *(planned)* ``; the
  marker is dropped in this task's `refactor` commit now that the operation is registered. spec-006
  has no `version:` frontmatter field (`grep -n "^version" …` → none), so no doc-version bump applies;
  a dated Revision note is appended, matching how dl-041's own §3 revision was recorded.
- **dl-030** (`ready`, option (b)) + **REQ-SEC-07**. Two distinct constraints, implemented as two
  distinct checks in a fixed order: (a) `requireCustomAsset` over the located path — built-in ⇒
  refuse; (b) the referrer check over `roles.yaml` — still bound ⇒ refuse naming the role. (a) runs
  first, so a built-in that is also assigned (every scaffolded built-in is) yields REQ-SEC-07's
  message, which is what Sc.3 asserts against the real scaffold. The **workflow** half (P4.9) stays
  unowned per dl-030 and is untouched here.
- **dl-037 / dl-042 / dl-051** (`ready`) + spec-012 §5.1. Custom wins over built-in. Name resolution
  therefore goes through `selectDirectivesById(files, new Set([name]))` (`src/core/context.ts`,
  task-055) rather than a hand-rolled `find`: the removal targets the file that *wins* resolution, so
  the rule is implemented once. AC8 pins the consequence — after removing a shadowing custom file the
  built-in becomes the winner and spec-012 §5.1's kind-3 warning
  (`directive '<id>' defined in <paths>; using <winner>`) disappears from `directives list`.
- **The in-flight decision-log on `roles.yaml` in-place editing** (fail-closed `CONFLICT` when the
  file has comments; whole-file rewrite when it does not) was still unfiled when this design was
  written. *(Post-merge correction — it landed on `main` as
  `dl-062-roles-yaml-unwritable-fallback`, `status: in-discussion`, i.e. **not ratified**.)* Its
  Context says `updateRoleAssignments`'s module doc expects `task-052` to reuse that writer. **This
  task deliberately does not**, and the reason is P3.3's own text, not a preference: Scenario 2
  refuses a still-assigned directive rather than unbinding it, so a removal has no `roles.yaml` write
  to make. `directive remove` therefore never reaches the `setRoleAssignmentsInText` → fallback path
  dl-062 is about, and changes nothing in it. Flagged in the final report so dl-062's author knows
  P3.3 is not, after all, a second consumer of that decision.
- **Contention with task-048** (memory deprecate) on `src/core/index.ts` and the four shared test list
  literals: additions are one contiguous block per file, appended in the existing sorted position, with
  no reordering or reformatting of neighbouring entries.

#### Reading of P3.3's "still assigned to a role" check — the feature is NOT silent

P3.3 Scenario 2 is explicit and pins all three observable outcomes:

> Given "legacy-rule" is assigned to role "developer" / When I run "wingfoil directive remove
> legacy-rule" / Then the directive is not removed / And the command exits with code 1 and message
> "cannot remove 'legacy-rule': still assigned to role 'developer'"

So: **refuse** — do not remove, do not unbind, do not warn-and-proceed. REQ-SEC-07's clause (b)
("removal of a still-referenced custom asset is rejected naming the referrer") says the same thing
from the requirement side, and dl-030 assigns exactly this half to this task. No approver decision is
needed for the main case; implemented verbatim.

Two sub-cases the feature does **not** pin, decided here fail-closed and reported as a proposed
decision-log rather than silently invented:

1. **Several roles bind the same directive.** The message names **one** referrer. I name the
   alphabetically **first** role (`Object.entries(assignments)` sorted ascending — REQ-SYS-07: never
   YAML mapping order), so the message is a pure function of the file's content. Same convention
   `directives-list.ts` already uses for its `roles` array.
2. **The directive is in `roles.yaml`'s `global:` list.** A global binding is a reference — and the
   strongest one, since it applies to every role — so removal is refused. The message cannot be
   P3.3's role form without naming a role that is not in the file, so it is
   `cannot remove '<name>': still assigned to every role via roles.yaml 'global'`. `[AUTHORING]`: no
   spec or feature pins this wording. Reported for ratification.

#### `agent.verify_specs`

| Question | Authority (status) |
|---|---|
| op name / module / mutates / CLI / Tool | spec-006 §3 row `directiveRemove` · `directive` *(planned → registered here)* · true · `wingfoil directive remove` · Tool `directive.remove` (approved; dl-041 B) |
| built-in immutability + its exact message | REQ-SEC-07 clause (a) via `requireCustomAsset` (task-042, shipped) |
| still-referenced refusal + its exact message | REQ-SEC-07 clause (b) + `dl-030` (`ready`) + P3.3 Sc.2 |
| exit codes / `error: <reason>` rendering | spec-008 §4–§6 (approved), `src/core/exit-code.ts` (`VALIDATION`/`NOT_FOUND` → 1, `UsageError` → 2) |
| `roles.yaml` location and shape (`assignments` + `global`, values are ids) | spec-011 (approved) + `RolesYaml` ([AUTHORING], task-037) |
| custom-wins precedence + the shadow warning text | spec-012 §5.1 (approved, revised 2026-09-17 per dl-051) + dl-037 |
| storage layout `directives/{built-in,custom}/` | spec-011 (approved) |
| identity pre-flight | REQ-SEC-01 via `requireGitIdentity` |

**No new tech-spec is needed → `design` is a pass-through** (no approver gate). Every authority above
already exists and is `approved`/`ready`.

#### Design decisions

- **D1 — name → path is a *resolution*, not a string concatenation.** The op never builds
  `.wingfoil/directives/custom/<name>.md` from the argument. It loads every directive file
  (`loadDirectives`) and asks `selectDirectivesById` for the winner for that id, then hands
  **that file's own `path`** to `requireCustomAsset`. Three consequences: the built-in refusal fires
  with REQ-SEC-07's pinned message (task-042's gap closed), a directive nested deeper under `custom/`
  is removable, and a traversal-shaped argument can never reach the filesystem because it resolves to
  no file at all (`unknown directive: …` before any path is built).
- **D2 — check order is fixed and pre-write:** identity → usage → resolve → `requireCustomAsset`
  (clause a) → referrer check (clause b) → delete → commit. Nothing touches the filesystem until both
  refusals have passed, so every error path leaves the working tree byte-identical.
- **D3 — the referrer check lives beside `checkAssignable`** in `src/core/directive-assign.ts`
  (renamed in TSDoc to "role↔directive assignment support", file name unchanged to keep the diff off
  a path other branches may also touch): it operates on `RolesYaml` and returns a `CoreError`, exactly
  like its neighbour, and `src/directives` must stay a leaf (a `core → directives → core` cycle
  otherwise).
- **D4 — `removeDocument` in `src/storage/document.ts`.** The storage pillar owns bytes on disk;
  `writeDocument`'s exact counterpart, one path, nothing else touched. `commitPaths` already stages
  with `git add -- <path>`, which records a deletion, and commits with `git commit --only -- <path>`.
- **D5 — matching on `frontmatter.id`.** `roles.yaml` binds by id (task-051/task-053), and clause (b)
  must compare like with like, so the CLI's `<name>` is matched against `id`. Today `id == name` on
  every scaffolded, built-in and `directive create`d file, so no observable behaviour depends on the
  choice; task-051 reported the same spec-011 wording drift (`name` vs `id`) and it is not re-decided
  here.

### red — role: developer

Commit `0b44056`. Added `test/core/directive-remove.test.ts` (17 cases) and widened the four shared
registration enumerations (`test/core/production-registry.test.ts` ×2, `test/core/parity.test.ts` ×3,
`test/mcp/read-only-agent-channel.test.ts` ×2) plus a `directive remove <name>` describe in
`test/cli/program.integration.test.ts` (4 end-to-end cases through the compiled `dist/` + real
`commander`).

Observed failure, `npx jest test/core/directive-remove.test.ts test/core/production-registry.test.ts
test/core/parity.test.ts test/mcp/read-only-agent-channel.test.ts --maxWorkers=2`:

```
Test Suites: 4 failed, 4 total
Tests:       19 failed, 22 passed, 41 total
```

Every new-behaviour case failed at the fixture guard
`fixture bug: "directiveRemove" operation not registered on the directive module`, and the four shared
enumerations failed on the missing `directive.directiveRemove` / `directive.remove` entry — i.e. the
operation genuinely does not exist. No characterization AC was claimed and no dead code was added to
force a red.

Fixtures are real, not synthetic: every case runs `initWingfoilProject(repo, 'Scrum')` in a throwaway
temp git repo, so Sc.3 removes the **actually shipped** built-in `testing.md`
(`.wingfoil/directives/built-in/testing.md`, task-057) and the referrer cases read the **actually
scaffolded** `roles.yaml` (`traceability` bound to three roles; `doc-versioning` in `global`).

### green — role: developer

Commit `7e05a34`. Minimum implementation, three files:

- `src/storage/document.ts` — `removeDocument(absolutePath)`, `writeDocument`'s counterpart and the
  first file-deleting primitive in the codebase; unlinks exactly one path and never prunes a parent
  directory. Exported from `src/storage/index.ts`.
- `src/core/directive-assign.ts` — `checkUnreferenced(rolesYaml, id)`: REQ-SEC-07 clause (b), returning
  `CONFLICT` with P3.3's verbatim role message (alphabetically first binder) or the `[AUTHORING]`
  `global` message. Pure; `undefined` `roles.yaml` = no bindings.
- `src/core/index.ts` — `directiveRemoveFn` + the `directiveRemove` registration on the singular
  `directive` module. Order: `requireGitIdentity` → `<name>` presence (`UsageError`, exit 2) →
  `loadDirectives` + `selectDirectivesById` (dl-037 custom-wins) → `unknown directive: <name>`
  (`NOT_FOUND`) → `requireCustomAsset('directive', target.path)` (clause a) → `checkUnreferenced`
  (clause b) → `removeDocument` + one scoped `commitPaths`. Nothing on disk changes until both
  refusals have passed.

`DirectiveFile.path` carries the **platform** separator (`join('directives', …)` in `loaders.ts`), so
the staged/returned path is re-spelled with `/` (`target.path.split(/[\\/]/)`) — git speaks POSIX
separators and the payload must not differ by platform (REQ-SYS-07).

`npx jest --maxWorkers=2` after green: **98 suites / 1474 tests, 0 failed**.

### refactor — role: developer

Commit `d9f0659`.

- Pinned the `CoreError.code` on every refusal in `test/core/directive-remove.test.ts` (`CONFLICT` for
  a still-referenced asset, `VALIDATION` for task-042's built-in pre-flight) instead of asserting the
  message alone — the two refusals are deliberately different codes and nothing was guarding that.
- Added a `removeDocument` describe to `test/storage/document.test.ts` (3 cases): one path only, an
  emptied `custom/` directory is left in place, `ENOENT` on a missing target.
- `spec-006-core-domain-api` §3: dropped the `*(planned)*` marker on the `directiveRemove` row (dl-041
  B's bookkeeping obligation, now that the operation is registered) and appended a dated Revision note.
  spec-006 has no `version:` frontmatter field, so no doc-version bump applies.

### review-ready summary — role: reviewer

**Sync with `main` (dl-035 — merge, never rebase).** `git merge main` at `05d09de` — one conflict, in
`test/core/parity.test.ts`, where `main` had added `memory approve` (task-046) to the same two literal
lists this task adds `directive remove` to. Resolved as a sorted union of both, collapsed into one
`expected` constant so the CLI and Tool lists cannot drift apart again. Every other shared enumeration
auto-merged. Post-merge, I re-opened the specs/DLs these notes cite: `spec-006` §3 now carries both
this task's and task-046's marker removals (no contradiction); `dl-062-roles-yaml-unwritable-fallback`
had meanwhile been filed on `main` and the design note above was corrected in place to name it and to
state why P3.3 is **not** a consumer of it.

**Gates — the figures below are from the SECOND-PASS run, after the merge of `main` at `b7e39f9`
(see the second-pass section at the end of these notes). They supersede the first-pass numbers
(99 suites / 1506 tests, at `main` `05d09de`); the coverage percentages are unchanged.**

| Command | Result |
|---|---|
| `npx jest --maxWorkers=2` (inside the coverage run) | **100 suites / 1527 tests, 0 failed** |
| `npx jest --coverage --maxWorkers=2` | All files **98.54 / 92.27 / 98.75 / 99.15** (stmts/branch/funcs/lines) — global ≥ 80 ✓, non-regressing vs the 98.05/88.13/98.09/98.66 task-042 recorded. `src/core/directive-assign.ts` **100/100/100/100**, `src/storage/document.ts` **100/100/100/100**, `src/core/builtin-asset.ts` **100/100/100/100** |
| `npx tsc -p tsconfig.build.json --noEmit` | **exit 0** |
| `npx tsc --noEmit -p tsconfig.json` | exit 2 — **only** the pre-existing `bug-026` error `test/core/directive-create.test.ts(159,19) TS2339`, untouched |
| `npm run lint` | **exit 0** (`lint.clean`, hard-reject — dl-034) |
| `npm run docs:api` | **exit 0** (`docs.api.*`, hard-reject; TSDoc on every new export: `removeDocument`, `checkUnreferenced`, `DirectiveRemoveParams`, `DirectiveRemoveResult`) |

**BDD acceptance scenarios — every P3.3 scenario has a named passing test, at BOTH surfaces:**

| `P3.3-directive-remove.feature` scenario | core-op test (`test/core/directive-remove.test.ts`) | CLI test (`test/cli/program.integration.test.ts`) |
|---|---|---|
| Remove an unreferenced custom directive | `Sc.1: removes an unreferenced custom directive — file deleted, one scoped commit, exit 0` | `removes an unreferenced custom directive, committing only that deletion (BDD Sc.1)` |
| Error - removing a directive still referenced | `Sc.2: refuses a directive still assigned to a role — exact P3.3 message, nothing removed, exit 1` | `a directive still assigned to a role exits 1 with the exact BDD message (BDD Sc.2)` |
| Error - removing a built-in directive | `Sc.3: refuses a built-in directive by NAME — REQ-SEC-07's exact message, exit 1` (+ `refuses every one of the six shipped built-ins by name (task-057)`) | `a built-in directive exits 1 with REQ-SEC-07's exact message (BDD Sc.3)` |

The CLI cases spawn the compiled `dist/` through the real ESM `commander` harness, so the exit codes
(0 / 1 / 1 / 2) and the `error: <reason>` stderr lines are observed end-to-end, not inferred.

**Traceability:** REQ-SEC-07 (both clauses) + P3.3 (US-6-07) → BDD `P3.3-directive-remove.feature` →
`spec-006` §3 (`directiveRemove`, module `directive`) + `spec-011` (the `built-in/`↔`custom/` layout) +
`spec-012` §5.1 / `dl-037` (custom-wins precedence, shadow warning) + `dl-041` B (registration) +
`dl-030` (clause-(b) ownership) → this task → consumes `task-042`'s `requireCustomAsset` and
`task-055`'s `selectDirectivesById`. REQ-SEC-07's **directive** surface is now complete; its
**workflow** surface (P4.9) remains unowned, per `dl-030`, and is untouched here.

**Deliberately untouched:** `src/core/builtin-asset.ts` (task-042 — read only), `src/core/context.ts`
and `src/core/directives-list.ts` (task-055 — consumed, not modified),
`src/directives/roles-edit.ts` and `updateRoleAssignments` (task-051 / dl-062 — not on this command's
path, since P3.3 refuses instead of unbinding), `test/core/directive-create.test.ts` (`bug-026`).

**Known weak spots for the reviewer.**

1. The `global`-binding refusal message is `[AUTHORING]` — no feature or spec pins it. Raised as a
   proposed decision-log rather than decided here.
2. `checkUnreferenced` checks `roles.yaml` only. Nothing else in the repository can reference a
   directive today (`grep -n "directive" src/workflow/schema.ts` → no hit), but if a future pillar
   gains directive references, clause (b) must grow a second referrer source.
3. Removing a custom file that shadows a built-in changes which file defines that id — but it changes
   **no role's in-force directive set, ever**, and that is provable rather than merely untested.
   `checkUnreferenced` refuses whenever `assignments[*] ∋ id` **or** `global ∋ id`, and
   `resolveRoleDirectives` (`src/core/context.ts`) composes a role's in-force set from exactly
   `assignments[role] ∪ global` — so any id whose removal could move a role's set is refused before
   the deletion, and the set of roles affected by a *permitted* shadow removal is empty by
   construction. A fresh `wingfoil init` shows this directly: AC8's test had to **create** its own
   custom shadow of `security`, because `security` is the one shipped built-in the scaffold binds to
   nobody. What a permitted shadow removal does change is the **inventory** — `directives list` loses
   the custom entry and spec-012 §5.1's kind-3 shadow warning, and a *later* binding of that id would
   resolve to the built-in. That is dl-037's precedence working as specified, and the AC8 test pins
   both halves.

No secrets committed; every commit stages explicit paths; `node_modules` is not tracked.

`status: in-progress → in-review`.

---

## Execution Notes — second pass (after review reject `b2faf9f`, `in-review → in-progress`)

The first pass above is left as the historical record, except the gate table, which was updated in
place because a gate record must state what was actually last observed. The reject confirmed the
**implementation** and returned the task for **three textual corrections it introduced** — sentences
that had become false, not behaviour that was wrong. The independent review's own findings
(structural path safety over fourteen hostile names; clause (a) keyed on the directory and not on
frontmatter, proven by forging `kind:` in both directions; clause (b) deterministic and lethal to all
five mutations tried; the deletion commit scoped to one path with a pre-staged file surviving; every
gate figure reproduced verbatim) are recorded here without restating them as claims of my own. **No
`src/` behaviour changed in this pass** — `git diff` over the pass touches only doc comments, test
titles/comments, and these notes.

### Corrections made

1. **`test/core/production-registry.test.ts` — "eight operations mutate today", naming eight, over an
   assertion listing nine.** The count decayed the moment `directive.directiveRemove` joined the
   registry. Corrected to **nine**, with `directive.directiveRemove` (P3.3) named in the title beside
   the other eight.
2. **`src/core/directive-assign.ts` module doc (the range `dl-062-roles-yaml-unwritable-fallback`
   cites as its evidence).** It still said `directive remove` would "reuse the same two pieces". Both
   halves were wrong after this task: the module now holds **three** pieces, and `directive remove`
   reuses **neither** original — not `checkAssignable` (a removal has no role argument to validate)
   and, materially, not `updateRoleAssignments`, because P3.3 Sc.2 *refuses* a still-assigned
   directive instead of unbinding it, so a removal has no `roles.yaml` write to make and never reaches
   the `setRoleAssignmentsInText` → fallback path at all. The doc now says so, marks `checkUnreferenced`
   as task-052's **contribution** rather than an inheritance, names dl-062 explicitly, and keeps P3.7
   labelled as an unbuilt prediction rather than an observed fact.
3. **Weak spot 3 asserted an unreachable gap.** It claimed a shadow removal "silently changes which
   directive is in force for every role bound to that id". `checkUnreferenced` refuses whenever
   `assignments[*] ∋ id` **or** `global ∋ id`, and `resolveRoleDirectives` composes a role's in-force
   set from exactly `assignments[role] ∪ global` — so the set of roles a *permitted* shadow removal can
   affect is empty by construction, not merely untested. (The reviewer's confirmation on a fresh init
   matches what AC8's own fixture already showed: the test had to create its own shadow of `security`,
   the one shipped built-in the scaffold binds to nobody.) Replaced with the correct statement — a
   permitted shadow removal changes the **inventory** (`directives list` loses the entry and
   spec-012 §5.1's kind-3 warning) and where a *future* binding of that id would resolve, and nothing
   else. A future task reading the old sentence would have chased a gap that does not exist.

### Sibling titles brought current (same decay, already present on `main`)

- `test/core/parity.test.ts` — both `it` titles now enumerate all **nine** mutating ops (they had
  omitted `memory approve` and `memory reject` before this task touched the file), and the comment
  above the Tools assertion was corrected the same way. Also added the missing
  `not.toContain('wingfoil://directive/remove')` guard, so this task's own mutating op is asserted to
  be a Tool and never a Resource, like its eight siblings.
- `test/mcp/read-only-agent-channel.test.ts` — `describe`/`it` titles and the two enumerating comments
  brought current for the same reason.

These are the same class of defect the orchestrator is filing repo-wide; only the occurrences inside
the enumerations this task edits are corrected here, and nothing out of scope was touched.

### Merge with `main` (dl-035 — merge, never rebase)

`git merge main` at **`b7e39f9`** (`main` had gained `task-046-memory-approve` and
`task-048-memory-deprecate` since the first pass). One conflict, again in `test/core/parity.test.ts`
and again in the mutating-op literal: `main`'s list had `memory deprecate`, this branch's had
`directive remove`. Resolved as the sorted union of all nine, kept in the single `expected` constant
the first pass introduced so the CLI and Tool assertions cannot drift apart. Every other shared
enumeration (`production-registry`, `read-only-agent-channel`, and parity's own Tools list)
auto-merged into the correct union; each was re-read and verified by hand afterwards rather than
trusted.

Post-merge re-run of every gate: the table in the first-pass summary above, now reading **100 suites /
1527 tests, 0 failed**, coverage unchanged at **98.54 / 92.27 / 98.75 / 99.15**, `tsc -p
tsconfig.build.json` exit 0, `tsc -p tsconfig.json` exit 2 with only `bug-026`, `lint` exit 0,
`docs:api` exit 0.

`status: in-progress → in-review`; `rejection_reason` removed from the frontmatter (spec-010).
