---
id: "bug-ingest-rel-v0.2.2-review-findings-plan"
type: plan
title: "Bug ingest — v0.2.2 dev-loop review findings"
status: done
version: "1.8"
workflow: "bug-ingest"
phase: "rel-v0.2.2-review-findings"
element: ""
release: "v0.2.2"
tmpl_version: 260703
---

## Context

The v0.2.2 dev-loop (`dev-loop-rel-v0.2.2-plan`) surfaces findings at each task's review gate that
the task itself does not fix. A finding left only in a task's Execution Notes is never rescheduled
once the task is `done`, so each one the approver rules a bug is captured here through the
`bug-ingest` main (`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0). Per the interim
no-workflow-engine rule and `dl-019`, this `plan` element is that run's plan. It stays `active` for
the whole dev-loop, and each later batch is appended to the table below.

Each bug is raised during a `dev-loop`, so it inherits the active `task` as its origin; the task is
named in the bug's Notes. `release-origin` is `v0.2.2`, the release under development. `release`
stays `""`: scheduling is the approver's, at triage.

**Preconditions (2026-09-29).** At the first batch, the next free bug number was `bug-155`: the highest existing file is
`bug-154-directives-list-succeeds-with-no-configuration.md` (`ls docs/04_memory/bugs |
sort -V | tail -1`), and `git log --all --oneline | grep -c bug-155` → 0.
From `task-112` on, every batch also requires the build in use to be the pinned one (`dl-095`):
`npm run -s wingfoil -- --version` prints the version `npm pkg get devDependencies.wingfoil-released`
pins. Not `npx wingfoil`: once `dist/` is built it runs this repository's own CLI.

## Phases / Steps

### `capture` — role: developer

- `memory.add(type: bug)`: one commit with the skeleton only.
- `memory.submit`: one commit with the body, `draft → open`.
- **Checks (post):** `frontmatter.required: [title, severity]`, and a duplicate search over `bugs/`
  and `dls/` recorded in Execution Notes.

| Bug | Found at | Defect | Severity |
|---|---|---|---|
| `bug-155-multi-hop-bracket-always-reads-as-drift` | `task-109` review (2026-09-29, approver ruling "apri un bug") | a multi-hop bracket `[a → b → c]` is split at the first arrow, so `to` is `b → c`, which no frontmatter can hold, and every such commit reads as a mismatch | low |
| `bug-156-repository-memory-yaml-template-paths-carry-the-config-root` | `task-110` review (2026-09-29, approver: separate bug, to triage) | this repository's 8 `template.file` entries carry a `.wingfoil/` prefix, so `memory add` resolves `.wingfoil/.wingfoil/…` and fails for every type; `task-111` does not fix it | medium |
| `bug-157-dl-107-action-1-names-a-slug-rule-spec-009-does-not-hold` | `task-110` review (2026-09-29, approver: bug) | `dl-107` Action 1 targets a slug rule `spec-009` §1 does not hold; its `spec-009` half is neither done nor void | low |
| `bug-158-date-and-author-id-tokens-are-declared-but-not-implemented` | `task-110` review (2026-09-29, approver: bug) | `{date}`/`{author}` are in `spec-001`'s token table but not implemented; `--set` refuses them claiming the command fills them | low |
| `bug-159-storage-layout-spec-tree-omits-three-configuration-files` | `task-111` review (2026-09-29, approver: bug) | `spec-011`'s "ground truth" tree omits `memory/templates/plan.md`, `workflows/custom/user-docs.yaml`, `workflows/custom/e2e-smoke.yaml` | low |
| `bug-160-vision-index-document-map-and-line-ranges-are-stale` | `task-121` review, after approval (2026-09-29, approver: should have been fixed in-task; file a bug) | `docs/01_vision/00_index.md`'s map gives stale version/date/lines for 5 documents; its `L<n>` ranges no longer match | low |
| `bug-161-core-index-uncovered-paths` | `task-122` review (2026-09-29, approver: bug) | `src/core/index.ts`, now measured, has 8 statements and 14 branch arms no test reaches | low |
| `bug-162-task-counter-restarts-per-release` | `task-123` review (2026-09-29, approver: bug) | the `{n}` counter only counts the type's folder; a task's folder is per release, so each release restarts at `task-001` | medium |
| `bug-163-release-line-folder-and-field-disagree` | `task-123` review (2026-09-29, approver: bug) | releases sit under `planning/rl-v1/` but carry `release-line: "v1"`; no `--set` value matches both | medium |
| `bug-165-illegal-approve-names-a-wrong-target` | `task-114` review (2026-09-29, approver: bug) | the illegal-transition error prints the verb's canonical edge (`planned -> triaged` for `approve` on a `planned` bug), a backward or unreachable move | low |
| `bug-166-release-field-means-two-things-on-a-service` | `task-124` review (2026-09-29, approver: bug) | a `service`'s `release` means "set up in", while `traceability` gives `release` the uniform meaning "assigned to" | low |
| `bug-167-publish-secrets-dry-run-fails-under-coverage` | `task-120` review (2026-09-29, approver: bug) | a real `npm publish --dry-run` case fails under full `jest --coverage`, passes alone | low |
| `bug-168-missing-positional-messages-disagree` | `task-120` review (2026-09-29, approver: bug) | missing-operand errors have two shapes (`memory submit <id>` vs `wingfoil dna update <path> --value <value>`) | low |

### `triage` — role: tech-lead, approver gate

`memory.approve [open → triaged]`, or `memory.reject [open → closed]`. The approver's alone.

## Handoff

- **Agent:** `capture` and its checks, for every finding the approver rules a bug.
- **Approver:** `triage` of each bug.
- **Completion:** when the dev-loop is `done`, every bug here is `triaged` or `closed`, and this plan
  moves `active → done`.

## Execution Notes

- **bug-155.** Duplicate search: `grep -rli "multi-hop\|multi hop" docs/04_memory/bugs
  docs/self/docs/04_memory/design/dls` → no hit. `dl-079` (the `wf()` grammar, `in-discussion`) does
  not mention chained brackets (`grep -n -i "hop\|chain" dl-079-*.md` → nothing). Added in
  `5b280ec2`; submitted in the commit after this plan's submit.
- **bug-155 triage (2026-09-29):** `[open → triaged]`, `release: v0.3` (`2f16dfac`).
- **Batch 2, `task-110` review (2026-09-29).** Next free number `bug-156` (`ls … | sort -V | tail -1`
  → `bug-155`; `git log --all --oneline | grep -cE "bug-15[6-8]"` → 0). Duplicate search:
  `grep -rli '.wingfoil/.wingfoil\|{date}\|{author}'` over `bugs/` and `dls/` → no hit. `bug-156`
  and `bug-158` were each reproduced with `dist/cli.js` built from `1087c166`, in a scratch repository
  (commands and output in each bug). Added in `31d79bdd`, submitted in the commit after this revision.
- The `task-110` approve commit's `Reason:` says "The four review findings are filed as separate
  bugs". There were four findings, but the first was the `spec-008` sign-off, given in that same
  approval; three became bugs (`bug-156`, `bug-157`, `bug-158`). The commit is merged and is left as
  written.
- **Triage (2026-09-29):** `bug-156` → `triaged`, `release: v0.2.2` (`528fe805`), then `planned` under
  its fix task `task-123`; `bug-157` and `bug-158` → `triaged`, `release: v0.3` (`6afb473d`).
- **Batch 3, `task-111` review (2026-09-29).** Since `task-111` (merge `582ec08a`), bugs live under
  `docs/04_memory/bugs/`. Next free number `bug-159` (`ls docs/04_memory/bugs | sort -V | tail -1` →
  `bug-158`; `git log --all --oneline | grep -c bug-159` → 0). Duplicate search: `grep -rli
  "spec-011" docs/04_memory/bugs` → `bug-053` (its `memory.yaml` row describes a retired `states`
  encoding) and `bug-040` (its `built-in/` text stale after `task-057`), both `open`. Both are other
  defects of the same spec, not duplicates; `bug-159` names them as related. Added in `b503236d`, submitted in the
  commit after this revision. At the same review the approver had `bug-154` and `bug-035` updated to
  the new layout (`31623e1c`), with no state change.
- **Batch 4, `task-121` review (2026-09-29).** Next free number `bug-160` (`ls docs/04_memory/bugs |
  sort -V | tail -1` → `bug-159`; `git log --all --oneline | grep -c bug-160` → 0). Duplicate search:
  `grep -rli "00_index" docs/04_memory/bugs` → `bug-052` only, which cites
  `docs/02_requirements/03_sard/00_index.md`, a different index; not a duplicate. Added in `cd8f9d69`, submitted in the
  commit after this revision. The approver noted that the index belonged in `task-121`'s own fix,
  like the canvas table, and was not to be left for after the merge.
- **Batch 5, `task-122` and `task-123` reviews (2026-09-29).** The first batch captured **with the
  verbs themselves**, on `main` at `68f64091` with the build under development: `node dist/cli.js
  memory add --type bug --title …` issued `bug-161`, `bug-162`, `bug-163` (the `bug` sequence has no
  gap: 160 files numbered 1–160), one commit and one file each, author Roberto Pompermaier
  (`d0d42949`, `d1fc7ee0`, `134f4998`). The bodies and titles were then filled, and `memory submit`
  moved each `draft → open` in its own commit (`ff6386a2`, `c204f834`, `e7e27e3f`). Checked after each
  command: `git log`, `git show --stat`, a clean `git status`. The verb-made commits carry no
  `Co-Authored-By` trailer. Duplicate search: `bug-087` (`open`, v0.3) is the gapped-sequence form
  of the counter and got a note that it now reproduces here (`dl-130` reused); `dl-101` keeps the scan
  inside the type's directory, so neither covers `bug-162`. `grep -rlE 'release-line: "v1"|release-line.*rl-v1|planning/v1/'`
  over `bugs/` and `dls/` → `bug-080` (reading states across the `planning/v1/` → `planning/rl-v1/`
  rename, a different defect) and `dl-018` (no relevant hit). `retro-v0.1` T11 is where the folder
  was renamed, and `bug-163` names it as the origin.
- **Triage (2026-09-29):** `bug-159` … `bug-164` → `triaged`, `release: v0.3` (`9a38cd9e`).
  `bug-164` was filed by the viewer session under its own `bug-ingest-rel-v0.2.2-viewer-findings-plan`.
- **Batch 6, `task-114` review (2026-09-29).** Captured with the **pinned build**
  (`npm run -s wingfoil -- memory add --type bug`, then `memory submit`): `bug-165` is the number the CLI
  returned (`42b50a07` add, `e13512b0` submit), one file per commit. It was reproduced first on a
  throwaway clone with `dist/cli.js`. Duplicate search: `dl-032` and `dl-053` ratified the current
  rule and are cited in the bug. No bug covers it.
- **Triage and closures (2026-09-29):** `bug-165` → `triaged`, v0.3 (`07a983ab`). `bug-159` was absorbed into
  `task-124` (`dl-045`) and closed with it, with `release` moved to v0.2.2, because that task's
  `spec-011` revision rewrote the tree.
- **Batch 7, `task-124` review (2026-09-29).** `bug-166`, as returned by the pinned build's
  `memory add` (`0c5395a3`), then `memory submit` (`c3074e88`). Duplicate search: `grep -rln
  "set_up_in\|release.*service"` over `bugs/` and `dls/` → `dl-130` (a release-publishing check over services), `retro-v0.2` (the
  benchmark as a service) and `dl-105` (a service verify sweep). All three mention "release" and
  "service" on the same line, and none is about the field's meaning. `dl-088`, which introduced the
  field, is cited in the bug.
- **Triage (2026-09-29):** `bug-166` → `triaged`, v0.3 (`e796697a`).
- **Batch 8, `task-120` review (2026-09-29).** `bug-167` and `bug-168`, as returned by the pinned
  build's `memory add` (`1b129469`, `3bb7b6e1`) and `submit` (`37b4f09e`, `486c57b3`). `bug-168`'s
  messages were reproduced on a scratch repository with `dist/cli.js` built from `b9458ffe`.
  Duplicate search: `bug-058` and `bug-003` are the same family as `bug-167` (process-spawning tests
  under load), not the same test. `bug-035` covers the `ENOENT` part of `task-120`'s finding and is
  excluded from `bug-168`.
