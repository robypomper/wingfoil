# WingFoil — Product Vision (docs/vision)

**Last indexed:** 2026-06-25

This folder holds the **product-vision specification** for WingFoil, produced through a Lean Inception workshop (see
[`X_lean-inception-plan.md`](X_lean-inception-plan.md)). This README is a **navigation index**: it tells you which
document holds which information and on which lines, so you can open only the relevant range instead of reading whole
files.

> **WingFoil in one sentence:** an open-source harness for AI-assisted software development that makes the process
> *deterministic* by giving humans and AI agents a structured, authoritative interface to a project — centralizing
> Memory, DNA, Directives and Workflow state and keeping them synchronized across all actors.

---

## How to use this index

**For AI agents:** find your topic in the *Quick lookup* table or the *Per-document section maps* below, then read only
the cited `Lx–Ly` range of that file. Don't load entire documents. **Line numbers are valid for the version/date listed
in the document map** — before relying on a range, confirm the target file's header `Version`/`Date` still match this
index; if they differ, the file changed and the ranges may have drifted (re-scan its headings, which are stable
anchors).

**For humans:** read top-to-bottom in this order: `0_product-brief` → `1A`/`1B` → `2_personas` → `3_journeys` →
`4_features` → `5A`/`5B`. `X_cli-cmds` is reference; `X_lean-inception-plan` and `X_coherence-audit` are process/meta.

---

## Document map (versions & last-modified dates)

Versions/dates/status are taken from each file's own header (the source of truth for freshness).

| Document                                               | Ver | Date       | Status   | Lines | What it contains                                                                                                        |
|--------------------------------------------------------|-----|------------|----------|-------|-------------------------------------------------------------------------------------------------------------------------|
| [`01_product-brief.md`](01_product-brief.md)           | 1.2 | 2026-06-23 | Approved | 306   | Executive summary: vision, problem, pillars, differentiators, personas, metrics, GTM, timeline, tech stack, constraints |
| [`02_product-vision.md`](02_product-vision.md)         | 1.1 | 2026-06-24 | Approved | 102   | Vision statement, key decisions, and the reference-workflow/methodology-template model                                  |
| [`03_is-isnot.md`](03_is-isnot.md)                     | 1.2 | 2026-06-24 | Approved | 55    | Scope boundaries: what WingFoil IS / IS NOT / DOES / DOES NOT                                                           |
| [`04_personas.md`](04_personas.md)                     | 1.0 | 2026-06-15 | Approved | 112   | The 6 personas (Alex, Sam, Jordan, Morgan, Casey, Taylor) with pains and goals                                          |
| [`05_journeys.md`](05_journeys.md)                     | 1.2 | 2026-06-24 | Approved | 285   | 8 end-to-end user journeys (0a, 0b, 1–6): steps, obstacles, success                                                     |
| [`06_features.md`](06_features.md)                     | 1.2 | 2026-06-24 | Approved | 508   | 63 features (by pillar + by release) and the data-model / implementation notes                                          |
| [`07_sequencer.md`](07_sequencer.md)                   | 1.3 | 2026-06-24 | Approved | 345   | 5-week delivery timeline, per-release Definition of Done, risks                                                         |
| [`08_mvp-canvas.md`](08_mvp-canvas.md)                 | 1.1 | 2026-06-24 | Approved | 193   | MVP canvas: problem/solution/value, target users, metrics, success criteria                                             |
| [`X_cli-cmds.md`](X_cli-cmds.md)                       | 1.1 | 2026-06-24 | Approved | 325   | CLI command reference: signatures, parameters, release timeline, per-persona usage                                      |
| [`X_lean-inception-plan.md`](X_lean-inception-plan.md) | —   | 2026-06-11 | —        | 42    | Workshop plan: sessions, key decisions, output list                                                                     |

---

## Quick lookup — "where do I find…?"

| You need…                                                           | Go to                                                                        |
|---------------------------------------------------------------------|------------------------------------------------------------------------------|
| The vision statement                                                | `0_product-brief` L9–19 · `1A` L9–19 · `5B` L37–44                           |
| The core problem WingFoil solves                                    | `0_product-brief` L20–36 · `5B` L9–22                                        |
| The 5 pillars (Memory, DNA, Directives, Workflow, Interaction)      | `0_product-brief` L37–72 · `5B` L57–96                                       |
| Scope boundaries (is / is-not / does / does-not)                    | `1B_is-isnot` (whole file, L9–55)                                            |
| Persona details (pains, goals, AI-usage)                            | `2_personas` L9–112 · quick summary `0_product-brief` L85–126                |
| End-to-end user flows                                               | `3_journeys` (per-journey ranges below)                                      |
| The full feature list + feature IDs (P1.x…X1.x)                     | `4_features` L17–159                                                         |
| Which feature ships in which version                                | `4_features` L160–293 · `5A` Timeline L9–20 · `0_product-brief` GTM L148–197 |
| CLI commands, flags & parameters                                    | `X_cli-cmds` (per pillar below)                                              |
| Data model: `memory.yaml`, state machines, workflow kinds, fallback | `4_features` L347–508 · `1A` Main/Sub L62–68                                 |
| Reference workflow templates (Scrum/Kanban/Lean/Trunk-Based)        | `1A` L31–102 · `4_features` P4.18–P4.20 (L102–104)                           |
| Timeline, dates, story points                                       | `5A` L9–20 · `0_product-brief` L198–216                                      |
| Definition of Done per release                                      | `5A` L244–312                                                                |
| Success metrics & criteria                                          | `0_product-brief` L127–147 & L217–262 · `5B` L97–116 & L140–175              |
| Competitive differentiators                                         | `0_product-brief` L73–84 · `5B` L117–128                                     |
| Tech stack & constraints                                            | `0_product-brief` L263–286                                                   |

---

## Per-document section maps

### `01_product-brief.md`

- Vision Statement — L9–19
- Core Problem — L20–36
- Solution / Five Pillars — L37–72
- Key Differentiators — L73–84
- Target Users (Alex L87, Sam L93, Jordan L102, Morgan L111, Casey L119) — L85–126
- Success Metrics (North Star L129, Supporting Indicators L135) — L127–147
- Market Position / Go-to-Market (L154) — L148–197
- Investment & Timeline — L198–216
- Success Criteria (v0.1 L219, v0.2 L228, v0.3 L234, v0.4 L240, v1.0 L248, fallback L255) — L217–262
- Technical Stack — L263–274
- Known Constraints & Assumptions — L275–286
- References — L287–306

### `02_product-vision.md`

- Vision Statement — L9–19
- Key Decisions — L20–30
- Reference Workflows & Methodology Templates — L31–102 (Supported Templates L37, How it works L47, Main vs Sub L62,
  Benefits L70, Example: Scrum L77)

### `03_is-isnot.md`

- IS — L9–17
- IS NOT — L18–29
- DOES — L30–47
- DOES NOT — L48–55

### `04_personas.md`

- Alex (solo dev) — L9–25
- Sam (code reviewer) — L26–43
- Jordan (team developer) — L44–62
- Morgan (tech lead) — L63–79
- Casey (non-technical manager) — L80–96
- Taylor (architect, future) — L97–112

### `05_journeys.md`

- Journey 0a — Initialize on a new project — L9–38
- Journey 0b — Migrate to an existing project — L39–72
- Journey 1 — Alex: new session with full context — L73–103
- Journey 2 — Sam: review workflow + AI review agent — L104–137
- Journey 3 — Jordan: team task with auto-loaded directives — L138–172
- Journey 4 — Morgan: enforce conventions / detect violations — L173–205
- Journey 5 — Casey: decisions & alignment notifications — L206–241
- Journey 6 — Morgan: define & evolve workflow — L242–273
- Key Observations across journeys — L274–285

### `06_features.md`

- Feature List by Pillar — L9–159
    - Pillar 1 Project Memory (P1.1–P1.13) — L17–40
    - Pillar 2 Project DNA (P2.1–P2.5) — L41–54
    - Pillar 3 Project Directives (P3.1–P3.8) — L55–71
    - Pillar 4 Project Workflow (P4.1–P4.20) — L72–107
    - Pillar 5 Interaction Layer (P5.1.1–P5.4.5) — L108–148
    - Extra 1 Notifications (X1.1–X1.2) — L149–159
- Features by Release (v0.1 L162, v0.2 L184, v0.3 L207, v0.4 L250, v1.0 L266, Post-MVP L278) — L160–293
- MVP Feature Set Summary (incl. total = 63 features) — L294–346
- Key Implementation Notes — L347–508 (State Deduction L349, `memory.yaml` schema L361, Workflow Kinds/Composition L391,
  Fallback L412, Team & Approval Routing L422, Git Ops L439, Built-in Directive Templates L459, Agent Roles L473,
  Complexity/Risk/Priority ratings L490)

### `07_sequencer.md`

- Timeline Overview — L9–20
- Week-by-Week Breakdown (Week 1 L23, Week 2 L57, Week 3 L90, Week 4 L140, Week 5 L176) — L21–209
- Critical Path — L210–228
- Risk Mitigation — L229–243
- Definition of Done per release (v0.1 L246, v0.2 L258, v0.3 L271, v0.4 L285, v1.0 L299) — L244–312
- Success Criteria (v1.0 MVP) — L313–336
- Capacity & Assignments — L337–345

### `08_mvp-canvas.md`

- Problem — L9–22
- Solution — L23–36
- Value Proposition — L37–44
- Target Users — L45–56
- Key Features (all 5 pillars) — L57–96
- Metrics of Success (North Star L99, Supporting Indicators L104) — L97–116
- Competitive Advantage — L117–128
- Risks & Mitigations — L129–139
- Success & Next Steps (criteria L142, if succeeds L159, if stalls L167) — L140–175
- Appendix: Documentation Reference — L176–193

### `X_cli-cmds.md`

- Pillar 1 — Memory commands + parameters (params L34) — L14–51
- Pillar 2 — DNA commands + parameters (params L65) — L52–77
- Pillar 3 — Directives commands + parameters (params L100) — L78–114
- Pillar 4 — Workflow commands + parameters (params L153) — L115–164
- Pillar 5 — Initialization commands + parameters (params L180) — L165–192
- Agent Execution commands + parameters (params L199) — L193–208
- Global Options — L209–221
- Command-Line Syntax Conventions — L222–246
- Release Timeline by Command — L247–279
- Command Reference by Persona (Alex L282, Morgan L291, Casey L301, Jordan L310, Sam L319) — L280–325

### `X_lean-inception-plan.md`

- Sessions — L10–21
- Key Decisions (Session 1) — L22–31
- Outputs — L32–42

---

## Conventions used across these docs

- **Pillars:** Project Memory, Project DNA, Project Directives, Project Workflow, Interaction Layer.
- **Versions/releases:** v0.1 (Memory+DNA) → v0.2 (Directives) → v0.3 (Workflow) → v0.4 (Interaction Layer) → v1.0 (MVP
  complete). Target dates: Jul 10 / 17 / 24 / 31 / Aug 7, 2026.
- **Feature IDs:** `P<pillar>.<n>` (e.g. `P4.13`), sub-grouped for Pillar 5 as `P5.<group>.<n>`; extras as `X1.n`.
- **Journeys:** `0a`, `0b`, `1`–`6` (8 total).
- **Storage layout:** `.wingfoil/{memory.yaml, dna.yaml, workflows.yaml}` + dirs
  `.wingfoil/{memory,directives,workflows}/`.
