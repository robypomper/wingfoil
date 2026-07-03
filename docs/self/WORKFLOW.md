# WingFoil — Workflow Reference

This document describes the complete workflow configuration for the WingFoil project as defined in
`docs/self/.wingfoil/`. The single startable lifecycle is `sw-life-cycle`; three independent
**ingest mains** can be started on demand at any time.

---

## Software Life Cycle — `sw-life-cycle`

The end-to-end lifecycle from product discovery to end-of-life. Inception, specification, init,
and sunset run once; `release-line-cycle` iterates once per major version (v1, v2, ...) and
contains its own `initial-design` + `delivery` sub-phases — reusable as-is when a new major
version starts, without re-running `wingfoil-init`.

```mermaid
flowchart TD
    I["**inception**\n`lean-inception`\nProduct discovery — Vision Package"]
    S["**specification**\n`specification-downcast`\nUSM → BDD → SARD → Backlog"]
    INIT["**init**\n`wingfoil-init`\nConfig pillars only"]
    SFR["**seed-first-release-line**\nmemory.add(release-line, v1)\ninline phase, no include"]
    RLC["**release-line-cycle**\niterate_over: release-line\napprove → initial-design → delivery → plan-next-release-line"]
    SU["**sunset**\n`end-of-life`\nDeprecate + archive"]

    I --> S --> INIT --> SFR --> RLC --> SU
```

---

## Phase 1 — Inception: `lean-inception`

Five sessions transform the Product Brief into the Vision Package.
Input: `docs/01_vision/01_product-brief.md`.

```mermaid
flowchart TD
    PB["Product Brief"]

    S1["**Session 1** *(facilitator)*\nProduct Vision · Is/Is Not"]
    S2["**Session 2** *(facilitator)*\nPersonas"]
    S3["**Session 3** *(facilitator)*\nUser Journeys"]
    S4["**Session 4** *(architect)*\nFeature Brainstorm + Review"]
    S5["**Session 5** *(product-owner)*\nSequencer + MVP Canvas"]

    VP["Vision Package\n`docs/01_vision/`"]

    PB --> S1 --> S2 --> S3 --> S4 --> S5 --> VP
```

**Outputs:** `product-vision.md`, `is-isnot.md`, `personas.md`, `journeys.md`, `features.md`,
`sequencer.md`, `mvp-canvas.md`.

---

## Phase 2 — Specification: `specification-downcast`

Four modules in strict sequence. Each module ends with a Stop-Check gate before the next begins.
Input: the full Vision Package from Phase 1.

```mermaid
flowchart TD
    VP["Vision Package\n`docs/01_vision/`"]

    M1["**Module 1** *(product-owner)*\n`user-story-mapping`\nbackbone → vertical explosion → MVP cut"]
    SC1{{"Stop-Check\n100% MVP Canvas features covered\nedge-case stories present"}}

    M2["**Module 2** *(qa)*\n`specification-by-examples`\nisolate-mvp → write Gherkin scenarios"]
    SC2{{"Stop-Check\nscenarios atomic + testable\nzero ambiguous adjectives/adverbs"}}

    M3["**Module 3** *(architect)*\n`volere-requirements`\nextract → apply Volere shell → group by area"]
    SC3{{"Stop-Check\nevery REQ has numeric/boolean Fit Criterion"}}

    M4["**Module 4** *(product-owner)*\n`backlog-export`\ngenerate records → map deps → validate JSON"]
    SC4{{"Stop-Check\nvalid JSON · no duplicate IDs · no circular deps"}}

    VP --> M1 --> SC1 --> M2 --> SC2 --> M3 --> SC3 --> M4 --> SC4
```

**Outputs:** `docs/02_requirements/01_user_story_map/`, `02_bdd/`, `03_sard/`,
`docs/03_backlog/04_backlog/`.

---

## Phase 3 — Init: `wingfoil-init`

Runs once, ever, between specification and the first release-line. Pure config/tooling bootstrap:
creates the four WingFoil configuration pillars. No Memory content at all — no release roadmap, no
ADRs/Decision Logs/tech-specs; those all moved to `release-line-cycle` (Phase 5) so they can run
again for v2, v3, ... without repeating this phase.

```mermaid
flowchart TD
    IN["Specification outputs\n`docs/01_vision/` · `docs/02_requirements/` · `docs/03_backlog/`"]

    P1["**init-config** *(tech-lead)*\ndna.yaml · memory.yaml\ndirectives/ · roles.yaml · workflows.yaml"]
    SC1{{"Stop-Check\nschema valid per pillar · no status: fields\n[SPEC] refs present · roles declared in DNA"}}

    IN --> P1 --> SC1
```

---

## Phase 4 — Seed First Release Line

Runs once, ever, right after init — an inline `sw-life-cycle` phase (no `include:`), since it just
seeds the single input `release-line-cycle` (Phase 5) needs to start.

```mermaid
flowchart TD
    P2["**seed-first-release-line** *(product-owner)*\nmemory.add(type: release-line, version: v1) → memory.submit\nrelease-line: draft → planning\n✔ P4.12: [title, version]\n`docs/04_memory/planning/{id}.md`"]
```

Every *subsequent* release-line (v2, v3, ...) is **self-seeded** instead — by `plan-next-release-line`
at the end of the previous release-line-cycle iteration (Phase 5 below). This is the only place in
the whole config where a workflow creates an element of the same type its own outer loop iterates
over; it fits the existing `iterate_over` + `where` semantics (always a live query against current
Memory state, REQ-SYS-03 — never a fixed snapshot), just not previously exercised this way.

---

## Phase 5 — Release Line: `release-line-cycle`

Iterated once per release-line (`iterate_over: release-line`, `where: status ∈ [planning, active]`).
Composes the release-line-scoped setup (`initial-design`) with the per-release delivery loop
(`delivery`), then closes the release-line and self-seeds the next one.

```mermaid
flowchart TD
    AP["**approve** *(tech-lead)*\nelement.set_state(active)\nrelease-line: planning → active\n🔑 Approval gate — *approver*\n↩ REJECT → approve"]
    ID["**initial-design**\nseed-releases + optional ADRs/DLs/tech-specs\n(see Phase 5a below)"]
    DL["**delivery** *(iterate_over: release)*\nwhere: release-line={release-line.version}, status∈[draft,planning,in-development]\n— release-cycle per minor release (see Phase 6 below) —"]
    PN["**plan-next-release-line** *(product-owner)*\nelement.set_state(done); IF another major planned:\nmemory.add(release-line) → memory.submit (self-seed)\n✔ pre-check: all its releases are `released`"]

    AP --> ID --> DL --> PN
```

### Phase 5a — Initial Design: `initial-design`

Runs once per release-line-cycle iteration — reusable as-is for v2, v3, ... Generates this
release-line's minor-release roadmap, then records the architecture/product decisions and
artefact specs already implied by it. `seed-releases` is required; the other three are optional.

```mermaid
flowchart TD
    IN2["`approve` output\nrelease-line: active"]

    P2b["**seed-releases** *(product-owner)*\nmemory.add(type: release, release-line: {release-line.version}) × N\nstatus: draft (no pending state)\n✔ P4.12: [title, version, pillar, features, requirements, release-line]\n`docs/04_memory/planning/{release-line}/{id}.md`"]
    SC2b{{"Stop-Check\nN files · all draft\nfeatures list complete per release"}}

    P3["**seed-adrs** *(architect)* · **OPTIONAL**\nmemory.add(type: adr)\ndraft → pending → accepted\n✔ P4.12: [title, sard_ref]\n`docs/04_memory/design/adrs/{id}.md`"]
    SC3{{"Stop-Check\nSARD ref present · Context/Decision/Consequences\nall ADRs status: accepted"}}

    P4["**seed-dls** *(architect)* · **OPTIONAL**\nmemory.add(type: decision-log)\ndraft → pending → approved\n✔ P4.12: [title]\n`docs/04_memory/design/dls/{id}.md`"]
    SC4{{"Stop-Check\nContext/Decision/Consequences\nall DLs status: approved"}}

    P5["**seed-specs** *(architect)* · **OPTIONAL**\nagent.survey_specs (this release-line) → memory.add(type: tech-spec)\ndraft → pending → approved\n✔ P4.12: [title, scope]\n`docs/04_memory/design/specs/{id}.md`"]
    SC5{{"Stop-Check\nnot already covered by an approved spec\nall specs status: approved"}}

    IN2 --> P2b --> SC2b --> P3 --> SC3 --> P4 --> SC4 --> P5 --> SC5

    style P3 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
    style SC3 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
    style P4 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
    style SC4 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
    style P5 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
    style SC5 fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
```

`seed-specs` is the release-line-wide sibling of `release-planning`'s `identify-specs` (Phase 6
below): same survey logic, but for artefacts spanning this whole release-line rather than one
release's task scope (e.g. `memory.yaml`'s own schema). `identify-specs` already dedupes against
"not yet covered by an approved spec", so nothing seeded here is re-created once a release's own
delivery starts.

---

## Phase 6 — Delivery: `release-cycle`

Iterated once per release (`iterate_over: release`, `where: release-line = {release-line.version},
status ∈ [draft, planning, in-development]` — scoped to the current release-line-cycle iteration).
Five sub-phases in sequence.

```mermaid
flowchart TD
    RP["**release-planning**\ndefine-scope → record-adrs (opt.) → identify-specs → build-backlog → commit-backlog\n✔ P4.12 per step (see sub-diagram below)\n🔑 Approval gate — *approver*\nrelease: draft → planning → in-development"]

    DL["**dev-loop** *(iterate_over: task)*\nwhere: status=backlog, tags=[release.version]\n— design gate + TDD cycle per task, incl. bug-fix tasks —\nkeeps source bug in sync via bug.sync_state"]

    RS["**release-submit**\npre-release-checks → enter-releasing → approve-release\n🔑 Approval gate — *approver*\nrelease: in-development → releasing\n↩ REJECT → pre-release-checks"]

    RP2["**release-publishing**\ntag → publish → mark-released\ngit tag · npm publish\nrelease: releasing → released"]

    RT["**retrospective**\ncapture decision-log → approve\n✔ P4.12: [title]\n🔑 Approval gate — *approver*\nOUTPUT: `docs/04_memory/design/dls/{id}.md`"]

    RP --> DL --> RS --> RP2 --> RT
```

### Dev Loop — `dev-loop`

Iterated once per task (`iterate_over: task`) — including fix tasks derived from bugs. A `design`
gate precedes the TDD red-green-refactor cycle; rejection at review sends the task back to `red`.
Every phase that changes the task's state also calls `bug.sync_state`: a no-op unless the task
carries a `bug:` field, in which case it recomputes the source bug's own state from the aggregate
progress of *all* its derived fix tasks (task and bug share the `in-progress`/`in-review` state
names by design, so no separate bug-fix workflow is needed).

```mermaid
flowchart TD
    ST["**start** *(developer)*\ngit branch {task.id}\ntask: backlog → in-progress\n↳ bug.sync_state: source bug planned → in-progress"]
    DES["📐 **design** *(architect)* · safety net\nverify a tech-spec exists + is approved for every\nfile format/schema/constant/API the task implements\n✔ P4.12: [title, scope] (if scaffolded) + tech-spec: approved"]
    RED["🔴 **red** *(developer)*\nwrite failing test\n✔ tests.exist + tests.failing"]
    GREEN["🟢 **green** *(developer)*\nmin code to pass\n✔ tests.passing"]
    REF["🔵 **refactor** *(developer)*\nclean code, keep tests green\n✔ tests.passing + coverage ≥ 80%"]
    REV["📋 **review** *(reviewer)*\ntask: in-progress → in-review\n↳ bug.sync_state: source bug → in-review (once ALL its fix tasks are)\n🔑 Approval gate — *approver*"]
    DONE["✅ **done** *(developer)*\ngit merge to main\ntask: in-review → approved → done\n↳ bug.sync_state: source bug → resolved → closed (once ALL its fix tasks are done)"]

    ST --> DES --> RED --> GREEN --> REF --> REV
    REV -->|APPROVE| DONE
    REV -->|REJECT| RED
```

`design` is a fallback: most artefacts should already have an approved tech-spec from
`release-planning`'s `identify-specs` step; this gate only catches artefacts discovered while
implementing the task (detail not predictable at planning time).

### Release Planning — `release-planning`

Five steps in sequence; `record-adrs` is optional. Each `memory.add` step carries a P4.12 check
gate enforcing the required frontmatter fields before the next step begins.

```mermaid
flowchart TD
    DS["**define-scope** *(product-owner)*\nelement.set_state(planning)\nrelease: draft → planning\n✔ P4.12: [title, version, pillar, features, requirements]"]
    RA["**record-adrs** *(architect)* · **OPTIONAL**\nmemory.add(type: adr) → memory.submit\n✔ P4.12: [title, sard_ref]\n`docs/04_memory/design/adrs/{id}.md`"]
    IS["**identify-specs** *(architect)*\nagent.survey_specs → memory.add(type: tech-spec) → memory.submit\n✔ P4.12: [title, scope]\n🔑 Approval gate — *approver*\n`docs/04_memory/design/specs/{id}.md`"]
    BB["**build-backlog** *(product-owner)*\nmemory.add(type: task) → memory.submit\nper selected triaged bug: memory.add(type: task, bug: {bug.id}) → memory.submit\n→ bug.set_state(planned)\n✔ P4.12: [title, release]\n`docs/04_memory/{release}/{id}.md`"]
    CB["**commit-backlog** *(tech-lead)*\ntask.set_state(backlog) · release.set_state(in-development)\n🔑 Approval gate — *approver*"]

    DS --> RA --> IS --> BB --> CB
    DS --> IS

    style RA fill:#f9f9f9,stroke:#bbb,stroke-dasharray:5 5
```

`identify-specs` surveys the release scope for file formats, schemas, constant sets, and module
APIs implied by its tasks, and scaffolds a tech-spec draft for each one not yet covered by an
approved spec — proactively, before `build-backlog` creates the tasks that will implement them.
`dev-loop/design` (above) remains as a reactive fallback for artefacts discovered only during
implementation.

---

## Phase 7 — Sunset: `end-of-life`

Retires the product or a major line. Documents remain in the repository (agents ignore deprecated
content, REQ-STATE-06).

```mermaid
flowchart TD
    AN["**announce** *(product-owner)*\nmemory.add(type: decision-log) 'End-of-life plan'\n✔ P4.12: [title]\n🔑 Approval gate — *approver*"]
    DE["**deprecate** *(tech-lead)*\nmemory.deprecate on active releases + ADRs\n✔ deprecated content excluded from agent context"]
    AR["**archive** *(tech-lead)*\ngit.commit('end-of-life: archive')\nfreeze the repository line"]

    AN --> DE --> AR
```

---

## Ingest Mains

Three lightweight `kind: main` workflows startable on demand at any point during the project
(REQ-STATE-03 allows multiple open mains concurrently).

```mermaid
flowchart LR
    subgraph BI["bug-ingest"]
        direction TB
        B1["**capture** *(developer)*\nmemory.add(type: bug)\nmemory.submit\n✔ P4.12: [title, severity]\ndraft → open"]
    end

    subgraph DLI["decision-log-ingest"]
        direction TB
        D1["**capture** *(product-owner)*\nmemory.add(type: decision-log)\nmemory.submit\n✔ P4.12: [title]\ndraft → pending"]
    end

    subgraph AI["adr-ingest"]
        direction TB
        A1["**capture** *(architect)*\nmemory.add(type: adr)\nmemory.submit\n✔ P4.12: [title, sard_ref]\ndraft → pending"]
    end
```

| Workflow | Produces | Typical trigger |
|---|---|---|
| `bug-ingest` | `docs/04_memory/bugs/{id}.md` | Defect found during dev-loop or testing |
| `decision-log-ingest` | `docs/04_memory/design/dls/{id}.md` | Ad-hoc product/process decision |
| `adr-ingest` | `docs/04_memory/design/adrs/{id}.md` | Architectural decision during any phase |

---

## Memory Element State Machines

State is derived from Memory file frontmatter at runtime — no separate state index (REQ-SYS-03).
`memory.deprecate` can be called from any state on any type.

### Release Line

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> planning : memory.submit
    planning --> active : memory.approve
    planning --> draft : memory.reject
    active --> done : trigger (all its releases are `released`)
    draft --> deprecated : memory.deprecate
    planning --> deprecated : memory.deprecate
    active --> deprecated : memory.deprecate
    done --> deprecated : memory.deprecate
```

### Release

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> planning : workflow.set_state
    planning --> in_development : workflow.set_state
    in_development --> releasing : workflow.set_state
    releasing --> released : workflow.set_state
    draft --> deprecated : memory.deprecate
    planning --> deprecated : memory.deprecate
    in_development --> deprecated : memory.deprecate
    releasing --> deprecated : memory.deprecate
    released --> deprecated : memory.deprecate

    in_development : in-development
```

### Task

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> pending : memory.submit
    pending --> backlog : task.set_state (approved)
    pending --> draft : memory.reject (reopen)
    backlog --> in_progress : workflow.set_state
    in_progress --> in_review : memory.submit
    in_review --> approved : memory.approve
    in_review --> in_progress : memory.reject (back to red)
    approved --> done : workflow.set_state

    in_progress : in-progress
    in_review : in-review
```

### ADR

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> pending : memory.submit
    pending --> accepted : memory.approve
    pending --> rejected : memory.reject
    rejected --> draft : memory.reject (reopen)
    accepted --> superseded : memory.deprecate (superseded by later ADR)
    accepted --> deprecated : memory.deprecate
    superseded --> deprecated : memory.deprecate
```

### Tech Spec

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> pending : memory.submit
    pending --> approved : memory.approve
    pending --> rejected : memory.reject
    rejected --> draft : memory.reject (reopen)
    approved --> superseded : memory.deprecate (superseded by a later spec)
    approved --> deprecated : memory.deprecate
    superseded --> deprecated : memory.deprecate
```

### Decision Log  *(uses default machine)*

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> pending : memory.submit
    pending --> approved : memory.approve
    pending --> rejected : memory.reject
    rejected --> draft : memory.reject (reopen)
    approved --> deprecated : memory.deprecate
```

### Bug

```mermaid
stateDiagram-v2
    direction LR
    [*] --> draft
    draft --> open : memory.submit
    open --> triaged : memory.approve
    open --> closed : memory.reject (wontfix / duplicate)
    triaged --> planned : bug.set_state (release-planning/build-backlog, fix task(s) created)
    planned --> in_progress : bug.sync_state (dev-loop, first fix task starts)
    in_progress --> in_review : bug.sync_state (dev-loop, ALL fix tasks in review)
    in_review --> resolved : bug.sync_state (dev-loop, ALL fix tasks done)
    in_review --> in_progress : memory.reject (reopen)
    resolved --> closed : bug.sync_state (dev-loop, ALL fix tasks done)
    resolved --> in_progress : memory.reject (reopen)
    closed --> deprecated : memory.deprecate

    in_progress : in-progress
    in_review : in-review
```

---

## Roles Summary

| Role | Responsibilities in workflows |
|---|---|
| `product-owner` | Release-line seeding/closing (`seed-first-release-line`, `plan-next-release-line`), release-line roadmap (`seed-releases`), release planning, scope definition, backlog creation, retrospective seed |
| `tech-lead` | Config init, release-line approval, backlog approval, release submission and publishing, deprecation |
| `architect` | Features session, Volere requirements, ADR authoring, tech-spec identification/authoring (`identify-specs`, `dev-loop/design`) |
| `developer` | TDD dev-loop (red/green/refactor), branch management, bug capture |
| `reviewer` | Code review in dev-loop |
| `qa` | BDD specification, pre-release checks |
| `facilitator` | Lean inception sessions, retrospective capture |
| `approver` | All approval gates (backlog commit, task review, release, retrospective, end-of-life) |
