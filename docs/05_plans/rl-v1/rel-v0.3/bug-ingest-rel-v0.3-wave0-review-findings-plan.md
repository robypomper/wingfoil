---
id: bug-ingest-rel-v0.3-wave0-review-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 wave 0 review findings"
status: active
version: "1.1"            # optional — plan version
workflow: "bug-ingest"
phase: "rel-v0.3-wave0-review-findings"
element: "minor-v0.3"            # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.3"            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

The independent reviews of wave 0 (`dev-loop-rel-v0.3-plan` §Execution Notes, 2026-10-01) of
`task-126`, `task-128` and `task-129` left findings outside each task's scope. They are captured
here through `bug-ingest` (`.wingfoil/workflows/custom/bug-ingest.yaml` v1.0), started from the
dev-loop phase, so each bug carries `release-origin: "v0.3"`. Before each capture the agent searched
`docs/04_memory/bugs/` and the v0.3 backlog for an element that already owns it
(`grep -il <term> docs/04_memory/bugs/*.md docs/04_memory/v0.3/*.md`).

**Preconditions.** The Memory verbs run with the code version (`npm run build`, `node dist/cli.js`,
approver 2026-10-01) on `main` at `bd60a7a3`, which carries `task-128`: `memory add` allocates ids
from the highest number on every ref (`bug-087`, `bug-162` closed). This plan was added with it
(`41b88fbd`).

## Phases / Steps

1. **capture** (developer). One `memory add --type bug` and one `memory submit` per finding
   (`draft → open`), each checked against its contract (one commit, one file, the id the highest on
   every ref + 1).
   - `{n:N}` declared by `spec-001` and not implemented (`task-128` review). Same class as `bug-158`
     (`task-163`): proposed for absorption there (`dl-045`).
   - The reserved configuration scope names (`dna`, `directive`, `workflow`) are not enforced by the
     `memory.yaml` schema (`task-126` review).
   - `memory add`'s id allocation spawns one `git ls-tree` per distinct ref commit (`task-128`
     review). Same class as `bug-110`: proposed for `task-142`, the shared git-read helper.
   - `init` and `mcp` refuse a surplus operand with Commander's wording, not the shared refusal
     (`task-129` review).
   - The DNA path verbs keep a surplus-refusal exception (`refusesExtraItself`) because
     `P2.1-dna-set.feature` still uses the two-positional `dna set ..language python`; the registry
     field is not in `spec-006` §2 (`task-129` review).
   - **Not captured, already owned.** `verifyTransitionConsistency` has no product caller, and the
     historical bracket drifts (`6437dbc4`, `50e57a04`, `28e41379`; 7 single-hop mismatches; 11
     unparseable multi-bracket `sync` subjects): `task-167` builds the governance check that calls it
     and reports older history without failing. A handover note is added to `task-167`'s
     Implementation Notes. The user-facing items (`docs/cli-reference.md`'s 0.2.2 label, the
     CHANGELOG entries, quoting in `memory search`, "per-type counter" in `docs/user-guide.md` and
     `docs/cli-reference.md`, the removed `resolveTypeDirectory` export) belong to v0.3's
     `user-docs` phase, and CLAUDE.md §3/§5.1 to its `align-agent-docs` phase; they are listed in
     `dev-loop-rel-v0.3-plan`'s handoff.
2. **triage** (tech-lead, ⛔ approver). `open → triaged` with `release: "v0.3"` and the absorbing task
   where one is proposed, or `reject → closed`.

## Handoff

- **Approver:** the triage of each captured bug.
- **Agent:** search, capture, submit, the handover note on `task-167`.
- **Completion criteria:** every captured bug `triaged` or `closed`; this plan `active → done`.

## Execution Notes

- **capture done (2026-10-01).** `bug-176` … `bug-180` were added and submitted `open` with the
  code version, one commit per operation (`742d72dc`, `cf54deb2`, `7a48ec6e`, `3b36018f`,
  `99e339a8`, then one `submit` each). Ids were the highest on every ref + 1 (`bug-175` before).
  `--set severity=…` on `add` exits 1 with nothing written; that is the declared contract
  (`spec-008` §10), so `severity`, `release-origin` and `feature` are filled at submit. The
  reproductions of `bug-176` and `bug-179` were re-run before submit
  (`idPatternIssues('task-{n:3}-{slug}')` → `['malformed token {n:3}']`; `init extra` → Commander's
  wording, exit 2). The `task-167` handover note is `6315a290`.
- **triage pending** (approver). Proposals:

  | Bug | Severity | Proposal |
  |---|---|---|
  | `bug-176` | low | `triaged`, v0.3, absorbed into `task-163` (same class as `bug-158`) |
  | `bug-177` | low | `triaged`, v0.3 or v0.4, a new small task, or absorbed into `task-153` |
  | `bug-178` | low | `triaged`, v0.3, absorbed into `task-142` (shared git-read helper) |
  | `bug-179` | low | `triaged`, v0.3, absorbed into `task-165` (bootstrap commands on the surface) |
  | `bug-180` | low | `triaged`, v0.3 or v0.4. Needs the approver's ruling on rewriting the P2.1 scenario with `--value`; could join `task-179` (one shape for missing-operand errors) |
- **triage done (2026-10-01)**, on the approver's instruction (proposals accepted; for `bug-177`
  and `bug-180` the absorbing option was taken). For each bug:
  - `memory approve [open → triaged]` with the code version;
  - `wf(bug): assign release v0.3 to <id>` by hand, the canonical `assign` form `task-126`
    declared, its first use;
  - the absorbing task names the bug in `bug:` (`dl-045`);
  - `wf(bug): sync [triaged → planned]`.

  Absorbed as follows: `bug-176` → `task-163`, `bug-177` → `task-153`, `bug-178` → `task-142`,
  `bug-179` → `task-165`, `bug-180` → `task-179`. For `bug-180`, the P2.1 scenario is rewritten
  with `--value`.

  **Correction of record:** the five absorption commits (bbe9dd07 31a76763 347657fe 023e1107 8d64066e) name the bug as
  `bug-NNN-NNN` in their subject because of a scripting slip; read `bug-NNN`. They are not
  rewritten (`dl-035`).
