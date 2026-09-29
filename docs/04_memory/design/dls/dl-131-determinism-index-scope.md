---
id: dl-131-determinism-index-scope
type: decision-log
title: "The vision uses \"determinism\" both for the context WingFoil assembles and for the code an agent writes, and only the first is under WingFoil's control; the Determinism Index becomes composite (Input, Process conformance, Outcome equivalence), each component names who controls it, and outcome equivalence is reported, never promised"
status: ready
context: "planning"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed from v0.3 `release-planning` (approver ruling, 2026-09-29, v0.3 release-planning
(`release-planning-rel-v0.3-plan` R1)). The ruling fixes the shape below; this decision-log formalizes
it and lists its consequences.

**Two meanings of one word.** `grep -rn -i determinis docs/01_vision docs/02_requirements/03_sard`
returns 31 lines. They use "determinism" for two different things.

1. **Input: the context and the process.** `REQ-SYS-07` "Deterministic context assembly (North Star)"
   (`docs/02_requirements/03_sard/01_architecture.md:75-82`): "Identical inputs (specs + config +
   project state) produce an equivalent agent execution context", with a byte-for-byte fit criterion.
   `REQ-STATE-09` (`docs/02_requirements/03_sard/03_state-context.md:102-110`) scopes the same guarantee
   to the context-assembly path. Both trace to P5.4.4 and
   `docs/02_requirements/02_bdd/features/p5-interaction/P5.4.4-execution-context.feature`. This meaning
   is guaranteeable and testable: it depends only on WingFoil's code.
2. **Output: the code.** The North Star, as the vision states it:
   - `docs/01_vision/01_product-brief.md:68-71` (Solution): "This architecture ensures **determinism**:
     two independent development runs from the same specs + WingFoil config using different AI agents
     produce substantially equivalent software. Even though code may diverge in form and style, its
     substance remains identical."
   - `docs/01_vision/01_product-brief.md:133-135` (Success Metrics, North Star) and
     `docs/01_vision/08_mvp-canvas.md:101-102`: the Determinism Index is that two runs "should produce
     substantially equivalent software".
   - `docs/01_vision/08_mvp-canvas.md:17` lists as a problem WingFoil addresses: "**Reduced
     Determinism:** Even identical specs with different agents produce divergent codebases".
   - `docs/01_vision/03_is-isnot.md:45`, under **DOES**: "Makes independent development runs produce
     substantially equivalent output (Determinism)".
   - As a release objective: `docs/01_vision/01_product-brief.md:252` ("Determinism Index validated"),
     `docs/01_vision/06_features.md:280` (the v1.0 table's row "Determinism Index validated"),
     `docs/01_vision/07_sequencer.md:423` (v1.0 Definition of Done, "Determinism validation"),
     `docs/01_vision/08_mvp-canvas.md:161`, and `docs/04_memory/planning/rl-v1/minor-v1.0.md:16,33`
     (Success Criteria).

**Why the second meaning cannot be guaranteed.** The code is written by the agent and the model the
customer chooses. WingFoil launches agents and does not write code: `03_is-isnot.md` lists under
**DOES NOT** "Generate, write, or review code" and "Replace AI agents or models" (lines 51-52). Model
output is not deterministic, and the choice of model is outside anything WingFoil configures. A
promise on the code is therefore a promise on a component WingFoil does not control.

**What the vision already concedes.** The brief itself separates form from substance: "code may
diverge in form and style, its substance remains identical" (`01_product-brief.md:69-70`), and adds
that two projects "will generate similar git tree (same checkpoint or flow commits)" (line 70-71), which
is a statement about the process, not the code. Neither sentence gives an operational criterion.

**What the project has already decided around it.**
- `dl-089-release-health-analyses-before-retrospective` (`ready`, v0.3) defines metric **D01**, the
  Determinism Index, measured on major and minor releases after `release-publishing`, with the
  equivalence criterion "share of scenarios whose verdict is the same on both runs", threshold 90%
  plus every critical scenario passing (`dl-089`, lines 226-266). Its first value is expected from
  v0.3's release-health run.
- `dl-112-positioning-as-a-governance-layer` (`ready`, v0.3) rewrites the brief's "ensures
  determinism" sentence (its Q3) and rules that the product does not lead with determinism until it is
  measured.

Neither says which part of the Index WingFoil answers for.

## Decision

**1. The North Star text stays.** Every occurrence of "two independent development runs … produce
substantially equivalent software" keeps its wording. Under it, the brief and the canvas gain one
clause that defines the term operationally:

> *Substantially equivalent* means **behaviourally equivalent**: both codebases pass the same
> acceptance contracts, derived from the specifications and written before either run. Form, style,
> structure and textual similarity are not part of it.

**2. The vision states who controls what.** Code determinism is not under WingFoil's control: it
depends on the agents and models the customer picks. WingFoil controls the context it assembles and
the process it governs, and it measures the rest.

**3. The Determinism Index is composite.** Each component declares who controls it and what is
promised:

| Component | What it measures | Controlled by | Status |
|---|---|---|---|
| **I — Input** | The assembled context is identical for identical inputs (`REQ-SYS-07`, `REQ-STATE-09`) | WingFoil | Guaranteed. Target 100%, verified by tests |
| **P — Process conformance** | The run followed the workflow: every `wf(...)` commit is well-formed; only legal state-machine transitions (`REQ-STATE-01`); every phase's `produces:` present; the traceability chain feature → US → BDD → REQ → task complete. Each phase run by an agent of its declared role, distinct where the workflow requires it (`dl-134-dev-loop-separation-of-duties`). Between two runs: similar git trees (the same checkpoint and flow commits) | WingFoil + the agent | Measured on **every** run: cheap and continuous |
| **O — Outcome equivalence** | Behavioural equivalence of two independent runs' software | The customer's agent and model | Measured periodically, **never promised** |
| Code similarity | Textual or structural similarity of the code | Nobody | Out of scope. Informative at most |

**P is process, not output.** It is never called "output", in the vision or anywhere else: that name
would bring back the ambiguity this decision removes.

**4. The constraint on O.** The acceptance contracts O is measured against:
- are **shared** by both runs and **written before** them;
- are **derived from the specifications** (the BDD scenarios and SARD fit criteria), not generated
  by the agent under measurement;
- are **black-box**, at the product's public interface, for example at CLI level as `e2e-smoke`
  drives a fresh project (`dl-099-release-gates-run-on-every-candidate-on-a-fresh-project`).

Otherwise each agent passes its own tests and equivalence becomes circular. The ideal criterion is
that the spec-derived suite passes on both codebases; where the runs also produce their own suites,
each suite is run **crossed**, run A's on run B's code and the reverse, as supporting evidence. D01's
scenarios in `dl-089` are the contracts this clause constrains.

**Q1 — What O is in the release plan:**
- **(a) a release objective**, as it is today: "Determinism Index validated" is a v1.0 success
  criterion (`06_features.md:280`, `07_sequencer.md:423`, `minor-v1.0.md:33`), and v1.0 is not done
  until O reaches the threshold;
- **(b) a reported metric**: v1.0's criterion becomes "Determinism Index reported (I, P, O)", with I
  at its target and P and O published with their trend; O's value informs the retrospective but does
  not gate a release.

**Recommendation: (b).** An objective on something nobody controls cannot be managed: when O falls
short, there is no task that fixes it, because the divergence is in a model WingFoil does not choose.
I stays an objective because WingFoil controls it, and P becomes one as soon as its measurement
exists. The approver has ruled (b) (R1); the option is recorded so the approve commit's `Reason:`
carries the choice.

## Rationale

- **Promises follow control.** I depends only on WingFoil's code and is already a requirement with a
  byte-level fit criterion. P depends on WingFoil's configuration and on the agent following it, and
  WingFoil can detect every deviation from git alone (`REQ-SEC-02`, `REQ-STATE-01`, P1.10). O depends
  on the model. Stating each at the strength its controller allows is what makes the Index honest.
- **The North Star keeps its meaning.** The goal "substantially equivalent software" is what the
  customer wants; removing it would lose the product's direction. Defining it operationally, and
  saying who can move it, is enough.
- **P is where WingFoil earns its claim.** Process conformance is the measurable effect of the five
  pillars, it is cheap enough to run on every run, and a failure has an owner: a workflow, a directive
  or a verb.
- **Shared, spec-derived, black-box contracts** are the only way two runs can be compared without
  one of them grading itself.

Alternatives considered:
- **Drop the code-level North Star.** Rejected: it is the customer's goal, and the vision's direction.
- **Keep one undivided index.** Rejected: a single number mixes a guarantee with an observation, and a
  bad value would not say whose it is.
- **Include code similarity.** Rejected: it measures form, which the brief already allows to diverge
  (`01_product-brief.md:69`); `dl-089` already lists structural similarity only as an optional
  alternative, noting that it "measures form rather than behaviour".
- **Call P "output determinism".** Rejected, per Decision 3.

## Actions

Consequences are listed here and applied only after ratification, each with a `doc-versioning` bump.

1. **Ratify, choosing Q1.** Owner: approver, at `release-planning`'s `reconcile-governance` gate.
2. **`docs/01_vision/01_product-brief.md`**: the definition clause (Decision 1) under the North Star
   (Success Metrics) and the control statement (Decision 2) next to the Solution sentence; the v1.0
   success line (line 252) reworded per Q1. This edit is made **in the same commit** as `dl-112`'s
   Q3 rewrite of the Solution sentence, so the paragraph changes once.
3. **`docs/01_vision/08_mvp-canvas.md`**: the same clause under its North Star (line 101); the
   problem statement at line 17 reworded so WingFoil addresses the process and measures the outcome;
   line 161 per Q1.
4. **`docs/01_vision/03_is-isnot.md`**: under **IS NOT**, "A guarantee of identical code across
   agents or models"; the **DOES** line 45 narrowed to the process and the measurement.
5. **`docs/01_vision/06_features.md`** (line 280, "Determinism Index validated"),
   **`docs/01_vision/07_sequencer.md`** (line 423, v1.0 Definition of Done) and
   **`docs/04_memory/planning/rl-v1/minor-v1.0.md`** (Success Criteria, line 33, and the summary at
   line 16): reworded on the three components as a reported index, per Q1. `minor-v1.0` is
   `planning`, so it is edited in place. `docs/04_memory/planning/rl-v1.md:35-36` (`active`) keeps the
   North Star text and needs no change under Decision 1.
6. **`REQ-SYS-07` and `REQ-STATE-09` stay unchanged**: they already cover I.
7. **A new SARD requirement for P** is probably owed (proposed, not written here): each run's process
   conformance is computed from git and the configuration, with a fit criterion on the checks in
   Decision 3. Its owner is v0.3's `identify-specs` / `build-backlog`, or a later release if the
   approver prefers.
8. **`dl-089`'s catalogue**: D01 is O; P's per-run measures are added to the catalogue, which per
   `dl-089` bumps the catalogue version. Recorded as an "Amended by" line in `dl-089`'s Relations
   after ratification.
9. **Aligned later, not in this change**: the directive `.wingfoil/directives/custom/determinism.md`
   (its first rule asks for "substantially equivalent software" as if it were an input guarantee), and
   the "substantially equivalent software" sentence in the repository's agent entry point (owned by
   `user-docs`' `align-agent-docs`, `dl-025-agent-facing-docs-ownership`).
10. **Tasks, if any, are derived by v0.3 `build-backlog`**, not created here.

## Relations

- **Origin:** approver ruling, 2026-09-29, v0.3 release-planning (`release-planning-rel-v0.3-plan` R1).
- **Refines:** `dl-112-positioning-as-a-governance-layer`. `dl-112` Q3 states the determinism claim as
  a goal measured by the Index; this decision says what the Index is made of and which part is
  promised. The two vision edits are applied together (Action 2).
- **Constrains:** `dl-089-release-health-analyses-before-retrospective`, whose D01 is O and whose
  catalogue gains P.
- **Builds on:** `dl-099-release-gates-run-on-every-candidate-on-a-fresh-project` (black-box contracts
  on a fresh project, the model for O's acceptance contracts).
- **Measured with:** `dl-134-dev-loop-separation-of-duties` (distinct executors per phase) and
  `dl-135-agent-run-tracking` (who ran each phase) feed P.
- **Not related, despite the word:** `dl-061-dev-loop-reject-bug-sync` calls a workflow
  inconsistency a "determinism gap" (line 122); it is a P-kind defect in dev-loop, not about the
  Index.
- **Traces to:** P5.4.4, `REQ-SYS-07`, `REQ-STATE-09`, `REQ-STATE-01`, `REQ-SEC-02`;
  `docs/02_requirements/02_bdd/features/p5-interaction/P5.4.4-execution-context.feature`.
- **First user of:** the vision-change process of `dl-132-vision-change-and-feature-ingest`, since every action
  above edits an *Approved* vision document.
