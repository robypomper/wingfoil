---
id: "release-planning-rel-v0.2.2-plan"
type: plan
title: "Release-planning — rel-v0.2.2"
status: active
version: "1.0"
workflow: "release-planning"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/self/docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is the first patch of a
released minor. The v0.2 retrospective ruled that it ships before v0.3.0 (`retro-v0.2`, rows 9–42;
`retrospective-rel-v0.2-plan` §6.7–§6.8), and `dl-092` ruled how it is tracked: a `release` element
with `kind: patch` and `patch-of: minor-v0.2` (Q1 (A), id variant (a), `{kind}-{version}`), running
every `release-cycle` phase except `retrospective` (Q2 (ii)). This plan executes the first of those
phases, `release-planning` (`.wingfoil/workflows/custom/release-planning.yaml` v1.2), per `dl-019`.

**Preconditions (verified on `design/release_planning_v0.2.2` at `75550694`).**
- `minor-v0.2` `released` (`d2ad1f3f`); `wingfoil@0.2.1` on npm; `main` equal to `origin/main`
  (`git rev-list --left-right --count origin/main...main` → `0 0`).
- `dl-092` implemented in configuration at `92908e8c`: `memory.yaml` v1.2 (`id_pattern:
  "{kind}-{version}"`, `kind` required), release template `tmpl_version: 260929`,
  `release-planning.yaml` v1.2 (define-scope check gains `kind`). `npm test` → 149 suites, 2418 tests
  green. The five `minor-*` ids are immutable and are not backfilled with `kind`.
- `patch-v0.2.2` added at `draft` (`75550694`).
- Identity: `git config --local user.email` → `robypomper@gmail.com` (`dl-094` remedy (i), done by the
  approver on 2026-09-28).
- The Memory verbs still cannot be pointed at this repository (`bug-075`, `open`): every Memory
  operation in this plan is done by hand in the §5.1 commit format.
- Next free ids: `task-109`, `adr-011`, `spec-016`, `bug-154`, `dl-131`
  (`ls` of each type directory, highest number + 1).

**Scope in, as the retrospective approved it** (status and `release` at `75550694`, read with
`grep -m1 '^status:\|^release:'` on each file):

| Element | Status | `release` | §6.8 step |
|---|---|---|---|
| `dl-094` identity, `bug-137` `BRACKET_RE`, `dl-092` patch tracking | ready / triaged / ready | v0.2.2 | 1 |
| `bug-075` configuration at the root; `dl-095` pinned build; `dl-026` MCP registered; `dl-107` version dots in ids | open / ready / ready / ready | "" / v0.2.2 / "" / v0.2.2 | 2 |
| `dl-087` staged publishing, `bug-136` publish actions on Node 20 | ready / triaged | v0.2.2 / **v0.3** | 3 |
| `dl-088` the `service` type and the backfilled services | ready | v0.2.2 | 4 |
| `dl-091` public identity; `dl-093` metadata; `bug-138`, `bug-139`, `bug-140`, `bug-128`, `bug-129`; `bug-021` downgrade; `dl-123` won't-fix exit and `bug-092`; `dl-096` re-baseline | in-discussion / ready / triaged ×3 / open ×2 / open / ready + triaged / ready | v0.2.2 except `bug-128`, `bug-129`, `bug-021`, `bug-092` ("") | 5 |
| Staging → tag `v0.2.2` on the pushed `main` → publish | — | — | 6 (`release-publishing`, not this phase) |

**Scope out, on purpose.** `bug-118`, `bug-126`, `bug-072`, `bug-131` and the dirty-tree `submit`
question stay in v0.3 (§6.8, *Kept in v0.3 on purpose*). The unscheduled population — 70 `open` bugs
and 26 `in-discussion` decision-logs with `release: ""` — is v0.3's clean-up, and the selection
filters below name their elements explicitly rather than sweeping the whole filter.

**Parallel-release rule (`dl-092`, option (a)).** v0.3 starts after step 2. From then until the
`v0.2.2` tag, v0.3 merges only Memory and process documents into `main`; its branches take v0.2.2
through `git merge main`, never a rebase (`dl-035`).

**Produces.** `patch-v0.2.2` → `in-development`; `dl-091` → `ready`; the selected bugs `triaged` then
`planned`, `bug-094` `closed`; any ADR or tech-spec amendment the scope needs; tasks `task-109…` at
`backlog` under `docs/self/docs/04_memory/v0.2.2/`; `release: "v0.2.2"` stamped on every included
element.

## Phases / Steps

Executed on branch `design/release_planning_v0.2.2` (`dl-024` branch-per-phase), merged into `main`
with `--no-ff` at the end. Every Memory operation is one scoped `wf({type}): {verb} {ids}` commit
(§5.1). Approver gates (⛔) run only on the approver's explicit instruction, with `Approver:` and
`Reason:` in the commit body.

0. **Configuration for the patch** (done). `dl-092` Q1 (A)(a) in `92908e8c`; `wf(plan): add` this
   plan (`639aea4a`); `wf(release): add patch-v0.2.2` (`75550694`).
1. **define-scope** (product-owner, no gate). Fill `patch-v0.2.2`: `title`, `kind: patch`,
   `patch-of: minor-v0.2`, `version: v0.2.2`, `release-line: v1`, and
   - `pillar: P1` — the root move, the `service` type and the patch-tracking edge are Memory work;
   - `features` — the features the scope touches, not new ones: P1.3 (`dl-107`), P1.10 (`bug-137`),
     P1.13 (`dl-088`, `dl-092`, `dl-123`), P2.4 (`bug-139`), P5.1.1 (`bug-129`, `bug-140`), P5.1.4
     (`bug-128`), P5.2.1 (`dl-026`);
   - `requirements` — `retro-v0.2`'s path. No `by-release/v0.2.2.json` exists, and the patch's
     approved scope is the retrospective's disposition table (`dl-124`'s `not-applicable` is v0.3).
   Write Scope, Pillar Focus and Success Criteria from §6.8. `memory.submit` `[draft → planning]`.
2. **triage-bugs** (tech-lead, ⛔). Selected, from the filter `{status: open, release: ["", v0.2.2]}`:
   - `memory.approve` `[open → triaged]`: `bug-021`, `bug-075`, `bug-128`, `bug-129`;
   - `memory.reject` `[open → closed]`: `bug-094`, `Reason:` retyped to `dl-123` (`ready`,
     `release: v0.2.2`), which carries its content — nothing is left to fix under the bug itself.
   The other 69 open unscheduled bugs are not selected and stay untouched.
3. **reconcile-governance** (product-owner, ⛔). In scope and not `ready`: only `dl-091`. Before the
   gate, the agent records in `dl-091` the name checks (npm, GitHub, crates.io, PyPI, trademarks), each
   with its source and the date read. The approver chooses the MCP namespace and the new repository
   name; `memory.approve dl-091 [in-discussion → ready]`. The other 25 unscheduled `in-discussion`
   decision-logs are not selected.
4. **record-adrs** (architect, optional, `dl-022` spec-review + ⛔). Candidate: `dl-087` replaces the
   staging design `adr-009` accepted (ephemeral Verdaccio). If the spec-review finds it changes that
   decision rather than its implementation, `adr-011` is recorded and `adr-009` retired with
   `deprecate`, naming `adr-011` in the `Reason:` (no element is moved to `superseded` by hand).
5. **identify-specs** (architect, `dl-022` spec-review + ⛔). Survey the artefacts the scope changes:
   `spec-015-packaging-publishing` §1/§4 (`dl-093`, `dl-087`, `bug-136`) and
   `spec-001-memory-yaml-schema` (`dl-088` `service` type, `dl-092` `kind`/`patch-of`, `dl-123` edge).
   Each is either amended under the approver's gate or scaffolded as `spec-016…` if the change is a new
   artefact.
6. **build-backlog** (product-owner, no gate). Tasks `task-109…`, tagged `v0.2.2`, `add → submit`
   `[draft → pending]`, grouped by §6.8 step so the dev-loop respects its order (`depends_on`,
   `dl-015`): step 1 (`bug-137`; `dl-094`'s `.mailmap` if the ruling needs one), step 2 (`bug-075`,
   `dl-107`, `dl-095`, `dl-026`), step 3 (`dl-087` + `bug-136`), step 4 (`dl-088`), step 5 (`dl-091` +
   `dl-093` metadata and the URL sweep after the approver's rename; `bug-138`, `bug-139`, `bug-140`,
   `bug-128`, `bug-129`; `bug-021`; `dl-123` edge then `bug-092`; `dl-096` vision re-baseline). The
   selected bugs go `bug.set_state(planned)` `[triaged → planned]`. `release: "v0.2.2"` is stamped on
   `bug-021`, `bug-075`, `bug-092`, `bug-128`, `bug-129`, `bug-136` (from `v0.3`, approver ruling
   2026-09-29) and `dl-026`, and on every ADR, spec and task this phase creates.
7. **commit-backlog** (tech-lead, ⛔). `memory.approve` every task `[pending → backlog]`;
   `patch-v0.2.2` `[planning → in-development]`.

## Handoff

- **Approver:** gates 2–5 and 7, and the go-ahead to merge into `main`. Inputs needed before the
  gates they block: the MCP namespace and the new repository name (gate 3); the npm-side state for
  staged publishing — what is configured on npmjs for `dl-087` (gate 5); whether `dl-096`'s re-baseline
  fixes a target for v0.2.2 in active days.
- **Agent:** all authoring (this plan, `patch-v0.2.2`'s content, `dl-091`'s facts, any ADR or spec,
  the tasks), the non-gated define-scope and build-backlog mechanics, spec-review preparation, commit
  hygiene. It never approves.
- **Completion criteria:** `patch-v0.2.2` `in-development`; `dl-091` `ready`; `bug-094` `closed`;
  every selected bug `planned` with `release: v0.2.2`; every task `backlog`. **Stop at
  commit-backlog** — the dev-loop is the next phase, and its first tasks are §6.8 step 1.
- **The phases after this one** (`dl-092` Q2 (ii)): dev-loop → user-docs → e2e-smoke →
  release-submit → release-publishing. No `retrospective`: v0.2.2's findings fold into v0.3's.
