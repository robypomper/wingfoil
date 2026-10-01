---
id: "task-170-give-service-set-up-release-field-name-own"
type: task
title: "Give a `service`'s set-up release a field name of its own"
status: in-progress
release: "v0.3"
kind: "fix"
priority: "low"
tags: ["v0.3", "core", "memory", "traceability"]
ref: "dl-088"
bug: ["bug-166"]
depends_on: ["task-127-add-memory-amend-id-reason-approver-gated-verb"]
tmpl_version: 260703
---

## Description

A `service`'s `release` means "set up in", while `traceability` gives `release` one meaning (the release the element's implementation is assigned to) and `build-backlog` stamps it (`bug-166`).

## Acceptance Criteria

- (characterization) the `service` template names the field `set_up_in` (or the design's choice); `svc-*` elements are corrected through `memory amend` (task-127); `traceability.md` states services are not stamped; version bumps.
- (red-first) the `service` type's schema/test refuses a `release` field on a service, or the template test pins the new name.

## Implementation Notes

- **Size:** S · **wave:** 1 · **kind:** fix (`dl-133` Q1 (b)).
- **Implements:** dl-088 (service type); traceability directive (`release` meaning).
- **Features:** P1.13.
- **Notes:** Proposal key: C45.
- Planned by `release-planning-rel-v0.3-plan` step 6 (build-backlog), 2026-09-30.

## Execution Notes

Branch `task/task-170-give-service-set-up-release-field-name-own`, worktree `../.wf2-wt/task-170`,
cut from `main` at `c43221c4`. Start `ff8b8347`; `bug-166` synced `planned → in-progress` (`d2b155c7`).

### design (architect)

**`depends_on`** (dl-015): `task-127` Execution Notes read. What this task takes from them: `service`
is `amendable: true`, so the `svc-*` corrections go through `memory amend`; but the approver's ruling
(b) at its review put `release` in `AMEND_RESERVED_FIELDS` (`src/core/memory-amend.ts`), owned by
`assign`. A rename of `release` changes that field, so `amend` refuses it (see Pending amendments).

**Specs and decisions cited:** `dl-088` `ready` (`awk '/^status:/{print $2;exit}'`); the
`traceability` directive (custom, no status). No tech-spec declares the `service` fields, so none is
edited.

**Design decisions** (to confirm at review):
1. **Field name `set_up_in`**, the name the AC and `bug-166` propose. Of `bug-166`'s two options
   (rename, or declare `service` outside the uniform meaning) both are taken: the field is renamed
   *and* the directive states a service is never stamped and carries no `release`.
2. **No schema-level refusal.** `memory.yaml` declares only `template.frontmatter.required` per type;
   there is no per-type forbidden-field key. Adding one is new schema (`spec-001`) for one field, so
   the AC's second branch is taken: the template test pins the new name and the absence of `release`.
3. **`release-planning.yaml` is not edited.** Its `element.set_release` comment already lists
   "DL, bug, tech-spec, adr, task" and no `service`; the directive is where the meaning lives.
4. **Versions:** `.wingfoil/memory.yaml` 1.7 → 1.8 (a comment on the `service` entry; first edit
   since its last commit). The scaffold's `tmpl_version` 260929 → 261001, as `92908e8c` did for the
   `release` template when its field set changed. `traceability.md` has no `version` field.

**AC classification (T1).**

| AC | Class | Why |
|---|---|---|
| 1 — template names `set_up_in`; `svc-*` corrected; `traceability.md`; version bumps | characterization (configuration and documentation) | no behaviour; pinned by AC2's test |
| 2 — the template test pins the new name | **red-first** | `service-memory-type.test.ts` read the committed scaffold, which named `release` |

### red (developer)

`13d6f1f0`: `test/core/service-memory-type.test.ts` — `OPTIONAL` names `set_up_in` instead of
`release`, and a new case asserts the scaffold has no `release` key and that the `set_up_in` comment
says "the release in which it was set up" and "never stamped". The test reads the scaffold committed
at `HEAD` (`resolveAddType`). `npx jest test/core/service-memory-type.test.ts` → **2 failed, 10
passed** (`Expected value: "set_up_in"`; `Expected value: not "release"`).

### green (developer)

`5cc86d1f`: `.wingfoil/memory/templates/service.md` (`set_up_in`, `tmpl_version: 261001`),
`.wingfoil/directives/custom/traceability.md` (a bullet: a `service` is not a base document, is
never stamped, carries no `release`; its set-up release is `set_up_in`), `.wingfoil/memory.yaml`
(1.8, comment on `service`). Same command → **12 passed**. Both builds read 1.8:
`npm run -s wingfoil -- memory search --type service` and `node dist/cli.js memory search --type
service` → exit 0.

### refactor (developer)

No source change. Gates on `5cc86d1f` with the pending amendments in the working tree,
`npm run build` first:

| Command | Result |
|---|---|
| `npm test` | 166 suites / 2760 tests passed |
| `npm run test:coverage` | exit 0; 98.73 / 94.58 / 94.01 / 99.49 (stmts / branches / funcs / lines) — equal to `task-127`'s final figures; no `src/` file changed (`git diff --stat c43221c4 -- src` → empty) |
| `npm run -s lint` | exit 0 |
| `npm run -s docs:api` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |

BDD: no feature file names `service` (`grep -rln service docs/02_requirements/02_bdd/features/` →
nothing); no AC asks for a scenario.

### review (reviewer)

- AC1: `5cc86d1f` (template, directive, `memory.yaml` 1.8); the `svc-*` and `dl-088` edits are
  pending amendments, below.
- AC2: `13d6f1f0` red → `5cc86d1f` green, commands above.
- Same class: `grep -rn "renews\|repo_refs"` outside services, plans and the scaffold lists the
  places that enumerate the service fields. `dl-088`'s table is the one live definition (pending
  amendment). `task-124`'s notes (lines 44, 134) record what that task built and stay as written.

### Pending amendments (approver)

The working tree holds 13 uncommitted edits. `memory amend` **refuses the 12 `svc-*` ones as they
stand**: the rename removes `release`, and `release` is in `AMEND_RESERVED_FIELDS` (`task-127`
ruling (b)). Checked on a scratch clone with `node dist/cli.js memory amend
svc-005-npm-package-wingfoil --reason "…"` → exit 1, "the working-tree edit changes frontmatter field
'release', which an amendment does not own". Adding `set_up_in` while keeping `release` is accepted
(exit 0, also on the `deprecated` svc-007), and blanking `release` is refused. No `assign` CLI verb
exists to clear the field. The migration needs an approver ruling; the options are in the final
report to the coordinator.

- `dl-088-a-memory-type-for-state-that-lives-outside-the-repository` (body only, amendable as it
  stands) — `--reason "The frontmatter table names the set-up release set_up_in instead of release, which a service no longer carries (task-170, bug-166)."`
- `svc-001` … `svc-012` (12 elements, one line each: `release: "<v>"` → `set_up_in: "<v>"`, value
  unchanged) — `--reason "Rename the set-up release field from release to set_up_in, the name the service scaffold now uses; the value is unchanged (task-170, bug-166)."`
