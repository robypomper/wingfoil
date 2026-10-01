---
id: bug-ingest-rel-v0.3-wave0-review-findings-plan
type: plan
title: "Bug-ingest — rel-v0.3 wave 0 review findings"
status: active
version: "1.0"            # optional — plan version
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
