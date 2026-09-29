---
id: release-submit-rel-v0.2.2-plan
type: plan
title: "Release-submit — v0.2.2 (assemble the patch, enter releasing, stop at the approver gate)"
status: active
version: "1.1"
workflow: "release-submit"
phase: "rel-v0.2.2"
element: "patch-v0.2.2"
release: "v0.2.2"
tmpl_version: 260703
---

## Context

`patch-v0.2.2` (`docs/04_memory/planning/rl-v1/patch-v0.2.2.md`) is `in-development`, with
`kind: "patch"` and `patch-of: "minor-v0.2"` (`dl-092`). The three phases before this one are done:

| Phase | Plan | Status | Merged |
|---|---|---|---|
| implementation | `dev-loop-rel-v0.2.2-plan` (+ `bug-ingest-rel-v0.2.2-review-findings-plan`) | `done` (`cb7e8b1c`) | on `origin/main` |
| user-docs | `user-docs-rel-v0.2.2-plan` (+ `bug-ingest-rel-v0.2.2-user-docs-findings-plan`) | `done` (`c9f30c11`, `3a8518e9`) | `414df933`, on `origin/main` |
| e2e-smoke | `e2e-smoke-rel-v0.2.2-plan` | `done` (`cbc4c3db`) | `227fbad5`, **not pushed** |

Per `release-cycle.yaml` (`include: release-submit`) and `dl-092` Q2 (ii) — dev-loop → user-docs →
e2e-smoke → release-submit → release-publishing, no retrospective for a patch — the next phase is
**`submit`**. This plan is its execution scaffold (`dl-019`); there is no workflow engine, so every
step is performed by hand.

The contract is `.wingfoil/workflows/custom/release-submit.yaml` **v1.0**, `element: release`:

| Phase | Role | Declared | This plan |
|---|---|---|---|
| `pre-release-checks` | `qa` | `checks.pre`: tasks `done`; bugs `[resolved, closed]`; `tests.passing`; `tests.coverage(min: 80)` | §S1 — agent |
| `enter-releasing` | `tech-lead` | `element.set_state(releasing)` | §S2 — only on the approver's explicit instruction |
| `approve-release` | `approver` | `approval: { by_role: approver }`, `fallback: { step: pre-release-checks }` | §S3 — approver only |

The full reasoning behind each step — why `in-development → releasing` has no CLI verb, why it is
not an approval, why the `deprecated` bug outcome is reported rather than accepted — is in
`docs/05_plans/rl-v1/rel-v0.2/release-submit-rel-v0.2-plan.md` §2.1 and §3.1 and is not repeated
here. What changed since then: the configuration sits at the repository root (`task-111`), so every
path below is `docs/04_memory/…`, not `docs/self/…`.

**What this phase is not.** It does not bump `package.json`/`server.json`, date the CHANGELOG, tag,
push a tag, or publish; it does not move `patch-v0.2.2` to `released`. Those are
`release-publishing`'s. It does not change scope, which `release-planning-rel-v0.2.2-plan` fixed.

**Produces.** One durable change: `patch-v0.2.2` `status: in-development → releasing`, in one
commit touching one line. Everything else is verification recorded in this plan's Execution Notes.

**Inputs — the three phase handoffs (2026-09-29), summarised; each claim is re-measured in §S1, not
trusted.**

- *dev-loop:* 16/16 tasks `done` (task-109..124; 123 and 124 added during the loop); the 12 bugs with
  `release: "v0.2.2"` `closed` (bug-092 closed by the approver's reject `ab5a361d`, no fix task);
  the DLs with `release: "v0.2.2"` all `ready`; gates green at `cb7e8b1c` (160 suites / 2624 tests,
  98.63/94.2/93.84/99.47); pre-publish account work done (repository `wingfoil/wingfoil`, npm 2FA,
  trusted publisher stage-only, `NPM_TOKEN` deleted; `svc-001..006, 008, 009` `active`).
- *user-docs:* CHANGELOG `[0.2.2] - Unreleased`, README roadmap row "🔄 Being released", version
  0.2.1 in `package.json`/`server.json` — all intentionally left for publishing. bug-169/170/171
  `triaged`, v0.3.
- *e2e-smoke:* gate PASS in **hard-reject** (approver ruling D1, recorded on `dl-023` `0fe69fd8`):
  smoke 20/20, examples 5/5, `check:mcp` ok, pack 339 files. No findings.

## Phases / Steps

### P — Preconditions (verify first, stop if unmet)

| # | Condition | Command | Expected |
|---|---|---|---|
| P0 | The pinned build is in use (`dl-095`) | `npm run -s wingfoil -- --version` | `0.2.1` |
| P1 | The release is `in-development` | `awk '/^status:/{print $2; exit}' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` | `in-development` |
| P2 | The branch contains current `main`; `main` vs `origin` is known | `git merge-base --is-ancestor main HEAD; git rev-list --left-right --count origin/main...main` | exit 0; the ahead count is reported (not a blocker: the unpushed commits are e2e-smoke's) |
| P3 | Clean tree | `git status --porcelain` | empty |
| P4 | `node_modules` matches the lockfile | `npm ci` | exit 0 |
| P5 | user-docs complete (`dl-013`, hard blocker) | `ls -1 README.md CHANGELOG.md docs/user-guide.md docs/cli-reference.md docs/examples/` and the plan's `status:` | all present; plan `done` |
| P6 | e2e-smoke complete and PASS (`dl-023`, hard-reject per D1) | `awk '/^status:/{print $2; exit}' docs/05_plans/rl-v1/rel-v0.2.2/e2e-smoke-rel-v0.2.2-plan.md` | `done` |
| P7 | This plan is `active` | `awk '/^status:/{print $2; exit}'` on this file | `active` (after its `submit`) |

### S1 — `pre-release-checks` (role `qa`; directives `testing` + the global set)

`{release.version}` is `v0.2.2`. Tasks live in `docs/04_memory/v0.2.2/` (`memory.yaml` `task.path`);
bugs are selected by their `release:` field.

- **C1 — every v0.2.2 task is `done`:**
  `for f in docs/04_memory/v0.2.2/*.md; do s=$(awk '/^status:/{print $2; exit}' "$f"); [ "$s" != done ] && echo "NOT DONE: $(basename "$f") -> $s"; done; ls -1 docs/04_memory/v0.2.2/*.md | wc -l`
  → no `NOT DONE` line.
- **C2 — every bug with `release: "v0.2.2"` is `resolved`/`closed`:** the three-outcome loop of the
  v0.2 plan §2.1 with `v0.2.2`: `closed|resolved` pass silently, `deprecated` prints `RETIRED` (read
  its reason, report), anything else prints `NOT RESOLVED` (stop).
- **C3 + C4 — `tests.passing`, `tests.coverage(min: 80)`:** one `npx jest --coverage`, exit 0; the 80
  floor is `jest.config`'s `coverageThreshold.global`. Record the four percentages. `bug-167`
  (publish-secrets "dry run" flake under `--coverage`) is known: if it fires, re-run once and record
  both runs; a second failure stops the phase.
- **C2′ — the sweep `release-submit.yaml` does not make (report, never waive):** every bug not
  `closed`, with its `release:` — the v0.2 plan §2.2 loop. Name explicitly those that bear on
  publishing: `bug-055` (the secret-scan fixture trips GitHub push protection — do not touch
  `test/validation/secret-scan.test.ts`) and `bug-067`.
- **C5 — DLs scheduled into v0.2.2 are `ready`:** `grep -l 'release: "v0.2.2"' docs/04_memory/design/dls/*.md`
  and each one's `status:`. Not a declared check; reported so the approver sees that no v0.2.2
  decision is left open.

**The six gates** (the standing `refactor` set), on the same tree as C3/C4:

| # | Gate | Command |
|---|---|---|
| G1+G2 | suite + coverage | `npx jest --coverage` (= C3+C4) |
| G3 | build typecheck | `npx tsc -p tsconfig.build.json --noEmit` |
| G4 | full typecheck (`dl-044`) | `npx tsc --noEmit -p tsconfig.json` — exit 0, no output |
| G5 | lint (`dl-034`) | `npm run lint` |
| G6 | API docs | `npm run docs:api` — exit 0, the tree stays clean |

Plus, because they gate the tag in publishing: `npm run check:lockfile` and `npm run check:mcp`,
both exit 0.

**Publishing carry-over, read and reported, not fixed here:**
`node -p "require('./package.json').version"`, the `version` fields of `server.json`, the CHANGELOG
`[0.2.2]` heading line, and the README roadmap row for 0.2.2.

### S2 — `enter-releasing` (role `tech-lead` — **approver's explicit instruction only**)

`in-development` is a `waiting` state of the `release` machine (`memory.yaml`:
`waiting: [ planning, in-development, releasing ]`), so no Memory verb can drive this edge; the
declared action is `element.set_state(releasing)` and, with no engine, it is a hand edit.
`tech-lead` is not in `dna.yaml` `team.agents[0].executes_as`, so an agent performs it only when the
approver says so. It is not an approval: no `Approver:` line.

- Edit **only** `status:` of `docs/04_memory/planning/rl-v1/patch-v0.2.2.md`:
  `in-development → releasing`.
- Subject, following v0.2's approver-confirmed precedent (`4117e741`), because `dl-079` is still
  `in-discussion` (re-check before committing):
  `wf(release): enter-releasing patch-v0.2.2 [in-development → releasing]`
- Body: only the co-author trailer. The commit contains only that file.
- Settled by: `awk '/^status:/{print $2; exit}' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` →
  `releasing`, and `git show --stat HEAD` → that one file, one line.

Re-run P2 and the gates first if `main` moved since S1 (v0.2 plan H7).

### S3 — `approve-release` (approver only)

A gate, not a transition: the release stays `releasing`; `releasing → released` is publishing's
`mark-released`. The approval is recorded as this plan's `finalize [active → done]` commit carrying
the approver's `Approver:` line (the v0.2 precedent, `0b08e0d7`). On rejection:
`fallback: pre-release-checks` — re-run S1 against a release already at `releasing`.

### Hazards

- **H1 — frontmatter grep trap.** Use `awk '/^status:/{print $2; exit}'`, not `grep '^status:'`,
  which also matches status lines quoted in a body.
- **H2 — `main` moves.** Concurrent sessions (v0.3 planning, the viewer) commit to `main`. The
  parallel-release rule (a) holds until the v0.2.2 tag: v0.3 merges only Memory and process docs.
  Re-check before S2 and before merging.
- **H3 — one id per `memory` call** (`bug-171`): extra operands are silently ignored.
- **H4 — the pinned build refuses a transition on a file with other unsaved edits** (the `bug-076`
  guard): commit Execution Notes separately, as `docs(plans): …`, before `finalize`.
- **H5 — plan `add` needs the dev build** (`node dist/cli.js`; 0.2.1 has no `--set`); every other
  Memory operation uses the pinned build.
- **H6 — the branch.** This phase works on `design/release_submit_v0.2.2`
  (worktree `../.wf2-wt/release-submit-v0.2.2`), cut from `main` `227fbad5`, merged `--no-ff`, never
  rebased (`dl-035`). Check `git branch --show-current` before each commit.

## Handoff

**The agent does:** P, S1 (C1–C5, C2′, the six gates, lockfile + mcp, the carry-over read), records
the results in Execution Notes, and **stops**.

**The approver (Roberto) does:**

1. Reads the C2′ list and decides on the open bugs outside v0.2.2 (a waiver, per the v0.1/v0.2
   precedent).
2. Confirms the S2 subject `wf(release): enter-releasing patch-v0.2.2 [in-development → releasing]`.
3. Instructs S2 explicitly (or runs it).
4. Performs S3 — `approve-release`.
5. Decides when to push `main` (the e2e-smoke merge and this phase's merge are unpushed).

**Completion:** C1–C4 green and reported; the six gates green; `patch-v0.2.2` at `releasing` in one
commit; the approver's authorisation recorded by this plan's `finalize`; the branch merged into
`main`. Next: `release-publishing` for v0.2.2 — its plan starts from the carry-over list above
(version bump in `package.json` + `server.json`, CHANGELOG date, README roadmap row, tag, OIDC stage
publish with npm ≥ 11.15, MCP Registry listing + its `service` element, README mark check on
npmjs.com).

## Execution Notes

Phase started 2026-09-29 by the agent (role `qa`), session "DEV v0.2.2 - D.release-submit", on branch
`design/release_submit_v0.2.2` (worktree `../.wf2-wt/release-submit-v0.2.2`), cut from `main`
`227fbad5`. Plan: add `cbdd14a5` (dev build, H5) → submit `7a03edc9` (pinned 0.2.1,
`draft → active`). Every result below was measured on the tree at `7a03edc9`, whose only difference
from `main` `227fbad5` is this plan file.

### P — preconditions: all met

| # | Command | Result |
|---|---|---|
| P0 | `npm run -s wingfoil -- --version` | `0.2.1` |
| P1 | `awk '/^status:/{print $2; exit}' docs/04_memory/planning/rl-v1/patch-v0.2.2.md` | `in-development` |
| P2 | `git merge-base --is-ancestor main HEAD`; `git rev-list --left-right --count origin/main...main` | exit 0; `0 0` — `origin/main` is `227fbad5`: the e2e-smoke merge has been pushed since that phase's handoff |
| P3 | `git status --porcelain` | empty |
| P4 | `npm ci` | exit 0 |
| P5 | `ls -1d README.md CHANGELOG.md docs/user-guide.md docs/cli-reference.md docs/examples/`; plan `status:` | all five present; `user-docs-rel-v0.2.2-plan` `done` |
| P6 | `awk … e2e-smoke-rel-v0.2.2-plan.md` | `done` |
| P7 | `awk …` on this file | `active` |

### S1 — `pre-release-checks`: C1–C5 pass

| Check | Command (§S1) | Result |
|---|---|---|
| C1 | the task loop over `docs/04_memory/v0.2.2/*.md` | no `NOT DONE` line; 16 task files |
| C2 | the three-outcome bug loop, `release == "v0.2.2"` | 12 bugs; no `NOT RESOLVED`, no `RETIRED` line |
| C3+C4 | `npx jest --coverage` | exit 0; 160 suites / 2624 tests passed; statements 98.63, branches 94.2, functions 93.84, lines 99.47. `bug-167` did not fire |
| C5 | `grep -l 'release: "v0.2.2"' docs/04_memory/design/dls/*.md` + `status:` | 11 DLs — dl-026, 087, 088, 091, 092, 093, 094, 095, 096, 107, 123 — all `ready` |

### S1 — the six gates and the tag-gating checks: all green

| # | Command | Result |
|---|---|---|
| G1+G2 | `npx jest --coverage` | as C3+C4 |
| G3 | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| G4 | `npx tsc --noEmit -p tsconfig.json` | exit 0, no output |
| G5 | `npm run -s lint` | exit 0 |
| G6 | `npm run -s docs:api` | exit 0; `git status --porcelain` empty afterwards |
| — | `npm run -s check:lockfile` | exit 0 — "carries every pinned entry (2 overrides pin(s), 1 npm alias(es)) and every required peer edge resolves" |
| — | `npm run -s check:mcp` | exit 0 — the pinned wingfoil 0.2.1, `[prompts, resources]` (prompts: 8, resources: 2) |

### C2′ — the bugs C2 does not see (for the approver; not waived by the agent)

The v0.2 plan §2.2 loop (every bug whose `status:` is not `closed`, with its `release:`) prints
**103 bugs**; none carries `release: "v0.2.2"`. By state and release:

| Count | Status | `release:` |
|---|---|---|
| 66 | `open` | empty |
| 2 | `open` | `v0.3` — bug-087, bug-088 |
| 4 | `triaged` | empty — bug-019, bug-132, bug-133, bug-134 |
| 31 | `triaged` | `v0.3` |

The 66 `open` with an empty `release:` are bug-024, 025, 028, 031–040, 045–048, 051–055, 060, 061,
064–070, 072, 073, 093, 095–097, 099–102, 104–116, 118, 119, 121–127, 130, 131, 154.

Two of them bear on publishing and are named as the plan requires: **`bug-055`** (`open`; the
secret-scan fixture tripped GitHub push protection again at the dev-loop push, cleared by the approver
with a second allowlist exception; not touched by this phase) and **`bug-067`** (`open`; an interrupt
during a blocking npm step is honoured late).

### Publishing carry-over — read, not changed

| Item | Command | Read |
|---|---|---|
| `package.json` version | `node -p "require('./package.json').version"` | `0.2.1` |
| `server.json` versions | `grep -n '"version"' server.json` | `0.2.1` at lines 10 and 15 |
| CHANGELOG heading | `grep -n '^## \[0.2.2\]' CHANGELOG.md` | line 11: `## [0.2.2] - Unreleased` |
| README roadmap row | `grep -n '0\.2\.2' README.md` | line 238: `🔄 Being released` |

### Approver decisions — 2026-09-29

- **Handoff 1, open bugs: accepted outside v0.2.2.** This is a documented waiver, following the v0.1
  and v0.2 precedent: the 103 bugs in the C2′ list ship with v0.2.2 unfixed. None carries
  `release: "v0.2.2"`; release-planning schedules them.
- **Handoff 2, the S2 subject: confirmed** as
  `wf(release): enter-releasing patch-v0.2.2 [in-development → releasing]`.
- **Handoff 3, S2: the approver instructed the agent to perform it.**

### S2 — `enter-releasing`: performed on the approver's instruction

- Re-checked immediately before: `git fetch origin`; `main` and `origin/main` both `227fbad5`, so
  nothing moved since S1 and the gates stand. `dl-079` still `in-discussion`.
- Commit `65923465` `wf(release): enter-releasing patch-v0.2.2 [in-development → releasing]`:
  `git show --stat 65923465` → only `docs/04_memory/planning/rl-v1/patch-v0.2.2.md`, 1 insertion,
  1 deletion; `awk '/^status:/{print $2; exit}'` on that file → `releasing`.
- Read back through the pinned build: `npm run -s wingfoil -- memory history patch-v0.2.2` lists
  `65923465` as `from: in-development`, `to: releasing`, `operation: null`. The null is expected:
  `enter-releasing` is not one of the declared verbs (`dl-079`), and the bracket carries the edge.

### S3 — `approve-release`: pending

The approver's gate. It will be recorded as this plan's `finalize [active → done]` commit with the
approver's `Approver:` line.
