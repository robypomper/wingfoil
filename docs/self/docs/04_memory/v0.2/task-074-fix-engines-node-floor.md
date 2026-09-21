---
id: "task-074-fix-engines-node-floor"
type: task
title: "Fix bug-023: reconcile the published `engines.node` floor with what the dependency tree actually accepts"
status: backlog
release: "v0.2"
priority: "Medium"
tags: ["v0.2", "distribution", "packaging"]
ref: "REQ-SYS-09"
bug: ["bug-023-engines-node-floor-contradicts-commander"]
depends_on: ["task-059-publish-metadata"]
tmpl_version: 260703
---

## Description

Fix **bug-023**: `package.json` declares `"engines": {"node": ">=18.0.0"}` while the installed
`commander` requires `>=22.12.0` — the package advertises support for a Node floor its own dependency
tree does not accept. On Node 18 npm emits `EBADENGINE`, and with `engine-strict=true` the install hard
fails. This is a **published-contract defect**: it must land before `task-060`/`task-061` publish for
real.

Verified on `main` at `91258a7` (2026-09-21), reading the installed tree rather than the report:
`package.json` line 16 `"node": ">=18.0.0"`; `node_modules/commander/package.json` → version
`15.0.0`, `engines` `{"node":">=22.12.0"}`.

**The task's own work is deciding the real floor and then making every claim agree** — bug-023's fix
shape is "decide the real floor (raise ours, or pin an older commander), correct `package.json` and
`spec-015` §1 together, and pin it with an assertion". The declared floor also appears in product-level
documents, and those are not a task's to change unilaterally (see AC2).

## Acceptance Criteria

1. **The floor is decided and stated.** Either raise `engines.node` to what the tree accepts, or pin a
   commander that accepts the current floor. Whichever is chosen, say why — including whether runtime
   actually survives on Node 18, which bug-023 says it may ("commander's only notable builtin use is
   `stripVTControlCharacters` from `node:util`, Node ≥16.11, plus optional chaining") while insisting
   that "guessing that it works is not a contract".
2. **Every claim of the floor is checked individually, and the task says which actually disagree.** The
   survey below was run for this task on `main` at `91258a7`; **re-run each check at execution time**
   and correct the table rather than copying it.

   | Claim | Where | Observed | Disagrees? |
   |---|---|---|---|
   | `engines.node` | `package.json:16` | `">=18.0.0"` | **yes** — the defect itself |
   | CI Node version | `.github/workflows/publish.yml:78` `NODE_VERSION: '22.12.0'`, used at `:91`, `:123`, `:141` | pinned 22.12.0, and the comment at `:45` already reads "the lowest version every dependency accepts" | **no** — CI is already correct, and it is a single pinned version, not a matrix |
   | `spec-015-packaging-publishing` | `:60`, under "Unchanged" | `engines: node >=18` | **yes** — an `approved` spec ratifies the wrong floor and must move with the fix |
   | `adr-009-npm-publishing-pipeline` | whole document | `grep -n -i "node\b"` → no output; it states no Node floor (`sard_ref: REQ-SYS-09`) | **no** — nothing to change |
   | `README.md` | `:115` "This installs the `wingfoil` binary (Node.js 18+ required)" | 18+ | **yes** — but `README.md` is owned by the `user-docs` release gate (`dl-013`); decide whether to correct it here or hand it to that gate, and say which |
   | `dna.yaml` | `docs/self/.wingfoil/dna.yaml:73-75`, `stacks.technologies` → `Node.js`, `version: "18+"` | 18+ | **yes** — not named in bug-023's list; surfaced by this survey |
   | Product brief | `docs/01_vision/01_product-brief.md:267` "Node.js 18+ (npm)" | 18+ | **yes** — and it is a **vision** document. Per CLAUDE.md §10.1 the specs win over config, and changing the product's declared runtime floor is an approver/spec-level decision, not a task edit. **Stop and report** rather than editing the vision package unilaterally |
   | `CLAUDE.md` | `:18`, `:92` "Node.js 18+" | 18+ | **yes** — no workflow gate owns `CLAUDE.md` (`dl-025`, `in-discussion`); note it, do not silently absorb it |

3. **The regression guard exists.** An assertion in `test/cli/publish-metadata.test.ts` that **every**
   dependency's `engines.node` range is satisfied by ours, so the next dependency bump cannot
   reintroduce the contradiction silently. bug-023 records that today that file makes no `engines`
   assertion at all — re-verify that before writing, and classify the new test honestly (`dl-014`/T1:
   it goes red on the current `>=18.0.0`, so it is genuinely red-first).
4. **`spec-015` §1 moves with `package.json`, in the same change.** The spec is `approved`, so amend it
   as a dated Revision note (`dl-047`: tech-specs carry no `version:` field), citing this task and
   `bug-023`. A `package.json` corrected while the spec still ratifies `>=18` is the same defect one
   document further out.
5. **No new instance of the `bug-022` race.** `test/cli/npm-distribution.test.ts` packs *without*
   `--ignore-scripts` (`bug-022`); anything this task adds that packs must use `--ignore-scripts`, like
   its sibling in `publish-metadata.test.ts`. Fixing `bug-022` is not in scope.
6. **Gates green:** full Jest suite, coverage >80% and non-regressing, `tsc -p tsconfig.build.json`,
   `npm run docs:api`, `npm run lint`.

## Implementation Notes

Source: `bug-023` (`triaged`, severity `medium`, no `feature:`). **Its `release:` was `v0.3` and moves to
`v0.2` in the scheduling commit that accompanies this task** — the approver's decision on 2026-09-21,
reversing the "Scheduled v0.3 by the approver" note in the bug's own Notes section. That note and the
Triage line `release: v0.3 per the approver's scheduling decision` are now historical; the frontmatter
is authoritative. The reason for the move is the one bug-023 itself gives for the deadline: "it must
land before `task-060` / `task-061` publish for real", and those are v0.2 tasks.

- **Traceability:** REQ-SYS-09 — "`npm install -g wingfoil` makes the `wingfoil` command available on
  PATH" — which is exactly what `EBADENGINE` / `engine-strict` breaks. `adr-009` cites the same
  requirement.
- **Nobody owns it today** (bug-023): `task-059-publish-metadata` is `done` and its acceptance criteria
  never validated `engines` against the dependency tree; `task-060`'s Verdaccio staging smoke runs
  `npm install -g wingfoil` on CI's Node (≥22), so it cannot catch this. That is why AC3 is a guard and
  not just a value change.
- **`depends_on: ["task-059-publish-metadata"]` (`dl-015`)** — it shipped the publish metadata surface
  and owns `test/cli/publish-metadata.test.ts`, the file AC3 edits; its Execution Notes cover that
  suite's exhaustive-allowlist design and the `--ignore-scripts` convention AC5 relies on. Read them at
  design, per `dl-015`.
- **Interaction with `task-073-fix-stale-package-lock`:** that task refreshes `package-lock.json` in the
  same release. If this task pins a different commander, the two touch related artefacts — sequence them
  rather than running them blind against each other, and say in the notes which landed first.
- `dl-045` back-reference recorded before the task starts, so `bug.sync_state` can drive `bug-023`.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->
