---
id: "retro-v0.1"
type: decision-log
title: "Retrospective v0.1"
status: in-discussion
context: "retrospective"
release: "v0.1"
tmpl_version: 260703
---

## Context

`minor-v0.1` reached `released` on `main` — all 33 tasks (`task-001..033`) `done`, suite green,
`tsc` 0 — but shipped as a **paper release**: `release-publishing` was skipped per `dl-018` (no npm
publish, no `v0.1` git tag). This retrospective closes `minor-v0.1`'s `release-cycle`.

Unlike a vanilla `retrospective`, this one ran an explicit **explore** phase first (A1): five parallel
read-only agents mined the `## Execution Notes` of every v0.1 Memory document — all 33 tasks, the six
bugs, the six governance DLs (`dl-013..018`), the `minor-v0.1` release doc, and the `rel-v0.1` plan
outcomes — and a synthesis pass grouped ~50 raw items into a **12-theme friction inventory**
(`scratchpad/friction-inventory-v0.1.md`, T1–T12 below). An **additional-points gate** (A2) then let
the approver widen scope and decide each finding's disposition.

## Decision

Close v0.1 with this retrospective and, in the same window, **exceptionally approve + implement**
(out-of-flow, ahead of normal delivery) the governance changes surfaced here, so that v0.2's
`release-planning` resumes on an already-corrected config. See
`docs/05_plans/rl-v1/rel-v0.1/retrospective-and-config-bootstrap-plan.md` for the execution plan.

### What went well
- **Autonomous delivery under standing authorization** — Waves 3/4 ran agent-driven with a human
  approval gate only at review/merge (`release-implementation-rel-v0.1-plan.md`).
- **Opus-review-as-gate** caught real defects before merge (e.g. `task-010` reject for doc miscounts +
  an accidentally-tracked `node_modules` symlink).
- **Specs-win discipline held** — where prose and spec disagreed, the spec won and the divergence was
  recorded (`task-003` module path; `task-006` Tool naming).

### What didn't go well (friction inventory — each cites its source)
- **T1 — most of v0.1 was verification-only, not real TDD red→green.** Infra pre-existed, so ~11 tasks
  wrote characterization suites and had to apologize for it (`task-010`, `task-013`, `task-019`,
  `task-023`, `task-024`, `task-026`, `task-027`, `task-030`).
- **T2 — specs reached `approved` with internal / cross-spec / BDD contradictions**, caught at code
  time (`task-002` spec-009 self-contradiction; `task-006` spec-006↔spec-004; `task-025`/`task-028`
  spec-008↔BDD; `task-017`/`task-022` stale SARD boundary).
- **T3 — inter-task dependencies were prose-only → non-deterministic** (`task-005→010`, `task-008→021`,
  `task-009→030`; already `dl-015`).
- **T4 — parallel execution collided** (dup identity rules `task-014`/`task-015`; diverging CLI seams
  `task-026`/`task-028`; forced-sequential Wave 2; already `dl-014`).
- **T5 — `init` scaffolds schema-invalid config** — the tool can't bootstrap a valid project;
  `bug-005` (critical) was caught only by luck at the last task (`task-032`); `bug-006` still `open`.
- **T6 — `dna set` destroys provenance** (strips `[SPEC]`/`[AUTHORING]` comments; `bug-004`, `open`).
- **T7 — CLI under-tested & shipped polish bugs** (`bug-001`/`bug-002`/`bug-003`); commander v15 is
  ESM-only, so CLI wiring is untestable under Jest (`task-006`, `task-007` → new `bug-007`).
- **T8 — recurring env/toolchain fragility** (`task-004`/`task-005` `@types/js-yaml`; `task-014` Jest
  env isolation; `task-010` tracked symlink; `task-029` no `HEAD`).
- **T9 — governance debt accumulated, never reconciled** (`dl-013`/`dl-016`/`dl-017`/`dl-018`).
- **T10 — paper release** (`dl-018`); the planning branch's 33 tasks were also never merged to `main`
  (`release-planning-rel-v0.1-plan.md`).
- **T11 — path/naming inconsistencies** (`planning/v1/` vs the `rl-v1` id + the `docs/05_plans/rl-v1/`
  tree; scaffold `id`/`tmpl_version` `task-020`; module mislabel `task-003`).
- **T12 — `submit` only flips status, adds no content** — *deferred; not acted on this retrospective.*

### Dispositions (decided at the A2 gate)
| Finding | Disposition | Vehicle |
|---|---|---|
| T3, T4, T9, T10 | already owned → approve in the A5 bootstrap gate | `dl-013/014/015/016/017/018` |
| T1 | classify each AC red-first vs characterization | fold into `dl-014` + `testing` directive |
| T2 | spec-review gate before `approved`/`accepted` | **`dl-022`** |
| T5 + T7 | standing fresh-init + CLI e2e smoke gate | **`dl-023`** |
| T7b | commander-ESM-under-Jest white-box fix | **`bug-007`** (→ v0.2) |
| T5/T6 defects | leave `open`, v0.2 `triage-bugs` | `bug-004`, `bug-006` |
| N1/N2 (git rules) | one branch per phase; tag on `main` | **`dl-024`** |
| T11 | normalize `planning/v1/` → `planning/rl-v1/` | bootstrap close-out |
| — (plans as Memory) | phase plans become a Memory type | **`dl-019`** |
| — (contribution) | contribute via Memory artifacts; credit the contributor | **`dl-020`** + `COLLABORATION.md` |
| T12 | deferred — not this retrospective | — |

## Rationale

- **Clear the debt now, not in v0.2.** `dl-013..017` accumulated `in-discussion` precisely because
  `release-planning` had no `reconcile-governance` step (T9/`dl-016`) — letting them slip would repeat
  the miss. Bootstrapping the config first makes v0.2's very first `release-planning` the machinery's
  own first exercise.
- **Turn friction into governed change.** Every new finding routes to a DL, bug, or directive that
  traces to its evidence — no fix lands as untraceable tribal knowledge (traceability directive).
- **Bounded scope.** T12 and the two white-box defects (`bug-004`, `bug-006`, `bug-007`) are
  explicitly deferred so the bootstrap stays a config change, not an open-ended rewrite.

## Actions

- [ ] Approve the bootstrap DL batch at A5: `dl-013, dl-014, dl-015, dl-016, dl-017, dl-019, dl-020,
  dl-022, dl-023, dl-024` (owner: approver). *(Each explained individually first — one-off measure.)*
- [ ] Implement the batch in Phase B on `design/config_bootstrap_v0.2` (see plan B1–B12).
- [ ] Codify the `explore` phase + `additional-points` gate into `retrospective.yaml` (B11) so future
  retrospectives carry them (owned by this DL, no separate DL).
- [ ] Record the B-DECISION (docs-gate / smoke-gate staging: warn→hard-reject) choice here or on
  `dl-013`/`dl-023` (owner: approver).
- [ ] Defer to v0.2: `dl-018` publishing, `bug-004`, `bug-006`, `bug-007`, and the T12 "submit adds
  content" idea.
