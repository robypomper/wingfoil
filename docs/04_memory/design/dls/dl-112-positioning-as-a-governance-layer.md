---
id: "dl-112-positioning-as-a-governance-layer"
type: decision-log
title: "The product brief positions WingFoil only against flat rule files, scattered docs and large context windows; state it as a governance layer complementary to spec-driven development tools, and stop leading with determinism until it is measured"
status: ready
context: "retrospective"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed by the v0.2 retrospective (`retro-v0.2`, being filed now). At its `additional-points` gate the
approver accepted three related proposals:
- reposition WingFoil as a governance layer complementary to spec-driven development tools, and
  rewrite the brief's "Key Differentiators", through a decision-log settled before v0.3's scope is
  fixed;
- treat ideas seen in other tools as input to this decision, not as elements of their own;
- do not lead with determinism until it has been measured: the claim holds back until the
  Determinism Index has a first value (`dl-089-release-health-analyses-before-retrospective`,
  metric D01).

**What the vision says today** (`docs/01_vision/01_product-brief.md`, version 1.3, *Approved*):

- The **Vision Statement**'s *Unlike* clause names one alternative: "relying on large context
  windows or full codebase scans". `docs/01_vision/02_product-vision.md` (version 1.1) carries the
  same clause.
- **Key Differentiators** compares WingFoil with five alternatives: single flat agent-rule files
  (the row names two), README and scattered docs, large context windows, manual governance, and implicit workflow state.
  Its last column is headed "Why WingFoil Wins".
- The **Solution** section ends: "This architecture ensures **determinism**: two independent
  development runs … produce substantially equivalent software."
- `docs/01_vision/03_is-isnot.md` (version 1.2) already lists, under **IS**, "A governance layer above
  IDEs and agents", and under **IS NOT**, "A code generator" and "A spec or requirements validator".

**What is missing.** Tools that turn a specification into plans, tasks and code (spec-driven
development) are a category any reader of the brief will compare WingFoil with, and the vision
never mentions it. `git grep -n -iE "spec-driven" a20b346c -- docs/01_vision docs/02_requirements
README.md` returns nothing. The same command with `specification by example` added to the pattern
finds `docs/02_requirements/X_specs-downcast-plan.md`, so the search works.

**What the project's own evidence says about the determinism claim.** No release has measured it.
`dl-089` defines the metric (D01) and the approver ruled on 2026-09-28 that its first value comes
from a release-health run after `release-publishing`, on major and minor releases only. Until then
"ensures determinism" is a design goal stated as a result.

**Facts about other tools.** This decision needs none to be taken. Any statement about what a
specific tool does, if the ratified text names one, must be sourced and dated at ratification,
because such facts change from release to release and are not verifiable from this repository.

## Decision

The product brief positions WingFoil as the **governance layer** around AI-assisted development:
it records who decided what, under which rules, in which state, and it is complementary to the tools
that generate specifications, plans and code rather than a replacement for them. The determinism
claim is stated as the goal and the metric that will measure it, not as a property already
achieved. The open choices below remain for the approver.

**Q1 — the Vision Statement's *Unlike* clause** (both `01_product-brief.md` and
`02_product-vision.md`):
- **(A) keep it** and add the positioning only in Key Differentiators;
- **(B) replace it** with: "**Unlike** tools that generate specifications, plans or code, **our
  product** governs the process around them — decisions, rules, roles and workflow state —
  versioned in git and shared by every human and agent";
- **(C) keep the context-window clause and append** the spec-driven clause as a second *Unlike*.

**Q2 — Key Differentiators:**
- **(a) add one row**, "Spec-driven development tools", with *WingFoil*: "Governs the lifecycle
  around the spec: approvals, state machines, role-bound rules, audit trail"; *Them*: "Turn a spec
  into plans, tasks and code"; and rename the last column from "Why WingFoil Wins" to "What
  WingFoil adds", so every row reads as complementary where it is;
- **(b) add the row only**, keeping "Why WingFoil Wins";
- **(c) restructure the section** into "Replaces" (flat rule files, scattered docs, manual
  governance, implicit workflow state) and "Works with" (spec-driven tools, coding agents, IDEs).

**Q3 — the determinism sentence in Solution:**
- **(i)** "This architecture is designed to make the process **deterministic** … The claim is measured
  by the Determinism Index, whose first value is expected from v0.3's release-health run
  (`dl-089`, D01)";
- **(ii)** move the sentence to Success Metrics and leave Solution without it.

**Q4 — ideas seen in other tools** (phase-gated specification steps, change-delta specifications,
property-based tests derived from a specification). The approver folded them into this decision:
- **(x) record them here as not adopted**; any of them re-enters only through its own decision-log;
- **(y) list them in the brief** as "Works with" integration points.

**Recommendation:** Q1 (B), Q2 (c), Q3 (i), Q4 (x).
- **Q1 (B)** puts the positioning in the one sentence most readers see, and the context-window
  argument survives in Key Differentiators, where it has its own row.
- **Q2 (c)** separates what WingFoil replaces from what it sits beside, which "Why WingFoil Wins"
  cannot express.
- **Q3 (i)** keeps the north star visible while stating it at the strength the evidence supports.
- **Q4 (x)** keeps unverified capabilities out of an *Approved* vision document.

## Rationale

- **Complementary is what the scope already says.** `03_is-isnot.md` rules out generating code and
  validating specifications. A positioning that competes with spec-driven tools would contradict the
  vision's own boundaries, and one that ignores them leaves a reader to guess.
- **The strongest claim should be the one with evidence.** The audit trail, role-bound rules and
  state machines are shipped and tested (P1.2, P1.7, P3.2, P1.13). Determinism is not yet measured.
  Leading with the measured part costs nothing and removes a claim a reader cannot check.
- **Cost.** Two vision documents change, both *Approved*, so each edit bumps its `version` and date
  (`doc-versioning`). `docs/01_vision/00_index.md` indexes the brief's sections by line range
  (its *Key Differentiators* entry), which moves with any edit and must be updated in the same commit.

Alternatives considered:
- **Position against spec-driven tools as a competitor.** Rejected: it contradicts `03_is-isnot.md`
  and asks the vision to claim capabilities WingFoil does not have.
- **No change until v1.0.** Rejected: v0.3 release-planning scopes the Workflow pillar against this
  positioning, and v0.3 is the largest release in the sequence: `minor-v0.3`'s `features:` lists 26
  features, against 14 for `minor-v0.2` and 13 for `minor-v0.1`.

## Actions

1. **Ratify, choosing Q1–Q4.** Owner: approver, before v0.3's scope is fixed at `release-planning`.
   The choice goes in the approve commit's `Reason:`.
2. **Edit `docs/01_vision/01_product-brief.md`** (Vision Statement, Solution, Key Differentiators)
   and **`docs/01_vision/02_product-vision.md`** (Vision Statement) per the choices; bump both
   versions; update `docs/01_vision/00_index.md`'s section entries for the brief.
3. **If the ratified text names a specific tool**, cite its source and the date read in the brief's
   References section.
4. **`README.md`'s opening** follows the brief, through the `user-docs` release gate's
   `align-user-docs` phase (`dl-013-documentation-process-gate`), not in this change.
5. **Tasks, if any, are derived by v0.3 `release-planning` (`build-backlog`)**, not created here.

## Relations

- **Origin:** `retro-v0.2`, dispositions on positioning, ideas from other tools, and the determinism
  claim (2026-09-28).
- **Amends, on ratification:** `docs/01_vision/01_product-brief.md`, `docs/01_vision/02_product-vision.md`,
  `docs/01_vision/00_index.md`.
- **Depends on:** `dl-089-release-health-analyses-before-retrospective` (D01, the measurement the
  determinism claim waits for).
- **Related:** `dl-113-personas-revisited`, the other vision edit filed by this retrospective;
  `dl-125-approving-documents-that-are-not-memory-elements`, since this approval is itself a
  hand-written commit on a document outside Memory.
