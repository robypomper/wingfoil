# Executive Plan: Technical Specification Downcast Process

This document defines the standardized methodological and operational process for the "downcast" and drafting
of technical product specifications within the repository.

The process inherits strategic vision from the outputs of **Lean Inception** (documented in
`docs/01_vision/X_lean-inception-plan.md`)
and transforms it into actionable engineering requirements through the combination of three frameworks: **User Story
Mapping**, **Specification by Example (BDD)**, and the **Volere Requirements Framework**.

---

## 📂 Document Tree Structure in the Repository

The team must operate rigorously within the `docs/` folder, maintaining coherence with pre-existing vision documentation
and clearly separating product requirements from code implementation:

```text
docs/
├── 01_vision/                  <-- Input: Lean Inception Documents
│   ├── 00_index.md
│   ├── 01_product-brief.md
│   ├── 02_product-vision.md
│   ├── 03_is-isnot.md
│   ├── 04_personas.md
│   ├── 05_journeys.md
│   ├── 06_features.md
│   ├── 07_sequencer.md
│   ├── 08_mvp-canvas.md
│   └── [X_*.md]                (audit, plan, cli-cmds)
│
├── 02_requirements/            <-- Output: Methodological Specifications
│   ├── 01_user_story_map/      (Module 1 — Directory with files per journey)
│   │   ├── 00_index.md
│   │   ├── 01_init-migrate.md
│   │   ├── 02_session-context.md
│   │   ├── 03_review-workflow.md
│   │   ├── 04_team-task.md
│   │   ├── 05_conventions.md
│   │   ├── 06_decisions.md
│   │   └── 07_workflow-config.md
│   │
│   ├── 02_bdd/                 (Module 2 — Directory with Gherkin features/)
│   │   ├── 00_index.md
│   │   └── features/           (Gherkin feature files organized by pillar)
│   │       ├── p1-memory/      (memory/storage features)
│   │       ├── p2-dna/         (DNA/inference features)
│   │       ├── p3-directives/  (directives/governance features)
│   │       ├── p4-workflow/    (workflow orchestration features)
│   │       ├── p5-interaction/ (interaction/CLI/agent features)
│   │       └── x1-notification/(notifications features)
│   │
│   ├── 03_sard/                (Module 3 — Directory with files per macro-area)
│   │   ├── 00_index.md
│   │   ├── 01_architecture.md          (architectural constraints and patterns)
│   │   ├── 02_performance-nfr.md       (performance and latency requirements)
│   │   ├── 03_state-context.md         (state and context management)
│   │   ├── 04_integrations.md          (integrations and interfaces)
│   │   └── 05_security-compliance.md   (security and compliance)
│   │
│   └── X_specs-downcast-plan.md        (This file)
│
└── 03_backlog/                 <-- Output: Operational Backlog
    └── 04_backlog/
        ├── 00_index.md
        ├── backlog.json        (consolidated tasks)
        ├── schema.json         (JSON Schema validation)
        └── by-release/         (Partitioned by release wave)
            ├── v0.1.json
            ├── v0.2.json
            ├── v0.3.json
            ├── v0.4.json
            └── v1.0.json
```

---

## 🛠️ Initial Configuration and Team Roles

> **Instructions for the Team:** Read the input documents in `docs/01_vision/`. Generate analytical outputs
> within `docs/02_requirements/` and `docs/03_backlog/`. Execute the macro-phases and modules in strict sequence.
> Do not move to the next module without passing validation criteria (*Stop-Check*). Maintain complete traceability
> by inserting constant cross-references (e.g., linking each SARD technical requirement to its related User Story
> and original Journey).

---

## 🗺️ Process Map: The 3 Macro-Phases of Downcast

The team must structure the analysis following this logical progression:

1. **Phase 1: Flow Structuring (User Story Mapping):** Horizontal and vertical explosion of user flows and
   MVP extraction.
2. **Phase 2: Behavioral Specification (BDD):** Translation into deterministic scenarios (Given-When-Then) and
   elimination of every interpretative ambiguity.
3. **Phase 3: Technical and Architectural Specification (SARD):** Isolation of non-functional constraints and
   context management (Volere Framework).

---

## 🧱 Operational Execution Modules

### Module 1: User Story Mapping (Functional Ingestion Phase)

* **Objective:** Explode the macro-flows of Lean Inception into atomic, value-oriented stories,
  identifying edge cases in the user journey.
* **Reference Methodology:** *User Story Mapping* (Jeff Patton).
* **Required Input:** `docs/01_vision/04_personas.md`, `docs/01_vision/05_journeys.md`, `docs/01_vision/06_features.md`,
  `docs/01_vision/07_sequencer.md`, `docs/01_vision/08_mvp-canvas.md`
* **Generated Output:** `docs/02_requirements/01_user_story_map/` (directory with files per journey)

#### Responsibility: Product Owner / Software Architect

1. Analyze `docs/01_vision/05_journeys.md` and extract sequential activities (User Tasks) to build the horizontal axis
   of the flow (**Backbone** or Spine).
2. Under each macro-step of the Backbone, execute a vertical explosion by inserting the individual necessary
   functionalities, translating them into the standard format: `As [Persona], I want [Action] so that [Benefit]`.
3. Integrate the functionalities listed in `docs/01_vision/08_mvp-canvas.md`.
4. Apply a horizontal cut line using data from `docs/01_vision/07_sequencer.md`: categorize stories with tags
   `[MVP]`, `[Release-2]`, or `[Future]`.

#### Required Output Format:

Directory structured per journey, with a central index:

- `00_index.md` — Traceability matrix: feature → story → journey
- Per journey: files with atomic stories in standard format
  ```markdown
  ### Step 1: [E.g. Session Initialization / Authentication]

  * **[MVP]** US-01: As [Persona], I want [Action] so that [Benefit].
  * **[MVP]** US-02: As [Persona], I want [Exception handling/no connection] so that [No data loss].
  * **[Release-2]** US-03: ...
  ```

* **Validation Criterion (Stop-Check):** Verify that 100% of MVP Canvas features are included and that
  specific stories have been generated for flow interruptions or initial "edge cases".

---

### Module 2: BDD Specification Suite (Behavioral Phase)

* **Objective:** Eliminate every interpretative ambiguity between product specifications and code, defining exactly
  how the system reacts to inputs, commands, and state changes.
* **Reference Methodology:** *Specification by Example / BDD* (Gojko Adzic).
* **Required Input:** `docs/02_requirements/01_user_story_map/` (Module 1)
* **Generated Output:** `docs/02_requirements/02_bdd/` (directory with Gherkin feature files)

#### Responsibility: QA Engineer / Software Architect

1. Isolate exclusively User Stories tagged with `[MVP]`.
2. For each story, define system behavior through concrete examples using formal Gherkin syntax (`Given-When-Then`).
3. For each story, the following must be generated mandatorily:
    * At least one **Happy Path** (nominal success scenario).
    * At least one **Edge Case / Error Path** (behavior in case of input error, timeout, or module failure).
4. **Restriction Rule:** Ambiguous adjectives or adverbs are forbidden (e.g., *quickly*, *qualified user*).
   Replace with specific context states or quantitative metrics.

#### Required Output Format:

`.feature` files in Gherkin syntax, organized by pillar:

```gherkin
Feature: [ID_Feature] - [Title of Functional Story]

  Scenario: Main Success Flow (Happy Path)
    Given [Initial system state, user role, and persistent context data]
    When [A command is sent, user action, or system event occurs]
    Then [The system modifies its internal state, propagates context, and returns output X]

  Scenario: Constraint Error or Timeout (Edge Case)
    Given [Active system context with partial data or in critical condition]
    When [The action is attempted or the orchestrator fails to contact a module]
    Then [The system intercepts the anomaly, applies fallback policy, and notifies state safely]
```

* **Validation Criterion (Stop-Check):** Each scenario must be atomic and testable. Zero ambiguity in
  step descriptions.

---

### Module 3: System & Architecture Requirements Document (SARD)

* **Objective:** Extract and formalize latent technological infrastructure, business rules, and fundamental
  non-functional requirements for the architecture.
* **Reference Methodology:** *Volere Requirements Framework* (S. & J. Robertson - adapted in agile mode).
* **Required Input:** `docs/02_requirements/01_user_story_map/`, `docs/02_requirements/02_bdd/`
* **Generated Output:** `docs/02_requirements/03_sard/` (directory with files per macro-area)

#### Responsibility: Software Architect / Tech Lead

1. Analyze the scenarios from Module 2 and extract the infrastructural requirements needed to support them.
2. Apply the "Requirement Shell" of Volere to structure each technical requirement, explicitly defining:
   Description, Rationale (Why?), Traceability (From where?), and **Fit Criterion** (The quantifiable metric for
   validating the requirement).
3. Organize requirements into the following system macro-areas:
    * **Architectural Constraints and Patterns:** Orchestration patterns, decoupling, composition.
    * **Performance and Latency:** Time limits in computational execution or message exchange.
    * **Context and State Management:** Persistence rules, lifecycle, and context application storage.
    * **Integrations and Interfaces:** Communication standards between components (APIs, contracts, protocols).
    * **Security, Roles, and Governance:** Data access rules and system integrity.

#### Required Output Format:

File per macro-area with requirements structured in Volere Shell Style:

```markdown
## [Title of Macro-Area]

* **REQ-[PREFIX]-NN:** [Description of logical architecture or chosen pattern]
    * **Rationale:** [Ensure component decoupling and modularity]
    * **Fit Criterion:** [Quantifiable metric: e.g. "Orchestration calls must complete within X ms in 99% of cases"]
    * **Traceability:** [Derived from: Feature X, US-Y, BDD Scenario Z]
```

* **Validation Criterion (Stop-Check):** Block execution if a technical requirement does not present a *Fit Criterion*
  that is clearly numerical, percentage-based, or boolean.

---

### Module 4: Operational Product Backlog Export and Compilation

* **Objective:** Consolidate the entire documentary chain into a single backlog structured in standard format, ready
  to be injected or synchronized via API into development tools (Jira, GitHub Issues, etc.).
* **Required Input:** All files previously generated in the `docs/02_requirements/` folder.
* **Generated Output:** `docs/03_backlog/04_backlog/` (directory with structured JSON files)

#### Responsibility: Product Owner / Project Manager / Tech Lead

1. Generate a JSON record for each MVP User Story identified in Module 1.
2. Copy the Gherkin scenarios from Module 2 into the `acceptance_criteria` field.
3. Generate a `Technical Task` record for each requirement (REQ) in the SARD (Module 3).
4. Map relationships and dependencies by inserting technical task IDs in the `dependencies` array of the User Stories
   affected, so that preparatory infrastructure becomes blocking for functional development.

#### Required Output Format:

```json
[
  {
    "id": "TASK-001",
    "ref": "P1.1",
    "type": "User Story",
    "title": "Implement [Title of Functional Story]",
    "description": "As [Persona]... I want [Action]... So that [Value]...",
    "acceptance_criteria": "Feature: ... Scenario: Given... When... Then...",
    "acceptance_criteria_full": "docs/02_requirements/02_bdd/features/.../[feature].feature",
    "priority": "High",
    "release": "v0.1",
    "tags": [
      "MVP",
      "Functional"
    ],
    "dependencies": [
      "TASK-067"
    ]
  },
  {
    "id": "TASK-067",
    "type": "Technical Task",
    "title": "REQ-SYS-01: Architectural Setup",
    "description": "Develop and configure the infrastructure to support the system requirement for...",
    "acceptance_criteria": "Fit Criterion: [Technical validation test]",
    "priority": "Blocker",
    "tags": [
      "Architecture",
      "Backend"
    ],
    "dependencies": []
  }
]
```

Additionally, generate:

- A `schema.json` file (JSON Schema draft-07) to validate the structure
- Files `by-release/*.json` that partition tasks by release wave (v0.1, v0.2, etc.)

* **Validation Criterion (Stop-Check):** Perform syntactic JSON parsing. Verify the absence of duplicate IDs or
  circular dependencies (e.g., A depends on B, and B depends on A).

---

## 🚀 Process Launch Checklist

Use this checklist to launch the process within your team:

- [ ] **Assign responsibility for Module 1:** Product Owner or Software Architect tasked with generating the User Story
  Map
- [ ] **Assign responsibility for Module 2:** QA Engineer or Software Architect tasked with generating the BDD Suite
- [ ] **Assign responsibility for Module 3:** Software Architect or Tech Lead tasked with generating the SARD
- [ ] **Assign responsibility for Module 4:** Product Owner, Project Manager, or Tech Lead tasked with compiling the
  operational backlog
- [ ] **Read the input documents:** Verify that all files in `docs/01_vision/` are available and up-to-date
- [ ] **Execute Module 1:** Generate User Story Map in `docs/02_requirements/01_user_story_map/`
- [ ] **Verify Module 1 Stop-Check:** Confirm 100% coverage of MVP features
- [ ] **Execute Module 2:** Generate BDD Suite in `docs/02_requirements/02_bdd/`
- [ ] **Verify Module 2 Stop-Check:** Confirm atomicity and absence of ambiguity
- [ ] **Execute Module 3:** Generate SARD in `docs/02_requirements/03_sard/`
- [ ] **Verify Module 3 Stop-Check:** Confirm 100% Fit Criterion on all requirements
- [ ] **Execute Module 4:** Compile operational backlog in `docs/03_backlog/04_backlog/`
- [ ] **Verify Module 4 Stop-Check:** Confirm JSON validity, 0 duplicate IDs, 0 circular dependencies
