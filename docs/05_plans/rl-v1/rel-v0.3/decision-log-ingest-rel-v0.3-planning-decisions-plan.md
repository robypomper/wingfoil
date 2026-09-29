---
id: decision-log-ingest-rel-v0.3-planning-decisions-plan
type: plan
title: "Decision-log-ingest — rel-v0.3 planning decisions"
status: done
version: "1.0"
workflow: "decision-log-ingest"
phase: "rel-v0.3-planning-decisions"
element: "minor-v0.3"
release: "v0.3"
tmpl_version: 260703
---

## Context

The v0.3 planning conversation produced six decisions that no existing decision-log covers. The
approver ruled on their substance on 2026-09-29 (`release-planning-rel-v0.3-plan`, rulings R1, R4,
R5, R6, R9, and idea 2 of step 3). This plan runs `decision-log-ingest`
(`.wingfoil/workflows/custom/decision-log-ingest.yaml` v1.0) once per decision, started from
`release-planning` step 3, so each is filed at `in-discussion` with `release: "v0.3"` and
`context: "planning"`, and is ratified at `reconcile-governance` (gate 3), where the approver's
choice among any remaining options goes into the approve commit's `Reason:`.

**Preconditions.** The pinned build is `wingfoil 0.2.2`. Next free decision-log id across every ref
(`dl-101`): `dl-131` (`git ls-tree` over `git for-each-ref refs/heads refs/remotes`, re-run before the
first `add`).

**How the drafts are written.** Each body is drafted from the rulings and verified against the
repository (every claim names the command or file:line that establishes it), then reviewed by the
agent running this plan before `add`. The drafts cite features, requirements, BDD files and related
elements, never a source outside the repository.

## Phases / Steps

1. **capture** (product-owner, no gate), per decision: `memory add --type decision-log --title …` →
   `draft`; write the body; `memory submit` → `in-discussion`. One file per commit, checked afterwards.
   - **Determinism Index scope** (R1): input / process conformance / outcome equivalence, who controls
     each, code similarity out of scope; shared black-box contracts written before the run for O;
     vision consequences listed, not applied; coordinated with `dl-112`.
   - **Vision change and feature ingest** (idea 2): one process with a Memory type, impact analysis
     along the traceability chain, a downcast limited to the delta, and a mandatory release assignment.
   - **Fix-task tail** (R9): amends `dl-089`, `dl-099`, `dl-100`, with the v0.2 measurement and its
     command.
   - **dev-loop separation of duties** (R4): `red` by `qa`, tests not edited in `green`, an
     independence attribute per phase; rules in v0.3, checks in v1.0.
   - **Agent run tracking** (R5): amends `dl-114` with the session id; past / waiting / active from
     three sources; `fresh` / `resume` / `reference` modes; v0.3 and v0.4 split as ruled.
   - **Test-results publication** (R6): what, from which build, where, and which phase owns it; after
     `bug-141`.
2. **approve** (approver, ⛔): at `release-planning`'s gate 3, `memory approve [in-discussion → ready]`
   with the chosen options in the `Reason:`, or `reject [in-discussion → draft]` with what is missing.

## Handoff

- **Approver:** the ratification of each decision-log and its options.
- **Agent:** drafting, verification of every claim, capture, commit hygiene. It never approves.
- **After ratification:** the three amended decision-logs (`dl-089`, `dl-099`, `dl-100`) and
  `dl-114` receive a dated "Amended by" line in their Relations with a documentation commit; their
  status does not change.
- **Completion criteria:** the six decision-logs `ready` (or explicitly left `in-discussion` by the
  approver); the plan then goes `active → done`.
