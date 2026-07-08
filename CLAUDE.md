# CLAUDE.md — Agent entry point for the WingFoil project

This file orients any AI agent working in this repository: what the project is, where every piece of
information lives, and which workflows and directives to respect. Read it first; follow the links
rather than guessing.

---

## 1. What this project is

**WingFoil** is an open-source **harness for AI-assisted software development** that makes the process
**deterministic**: it gives humans and AI agents a structured, authoritative interface to a project
through five pillars — **Project Memory, Project DNA, Project Directives, Project Workflow, Interaction
Layer (CLI + MCP)**.

- **North Star:** the *Determinism Index* — two independent runs from the same specs + WingFoil config,
  using different AI agents, produce substantially equivalent software.
- **License:** MIT · **Distribution:** npm (public) · **Tech:** TypeScript / Node.js 18+.

> **Project status: specification & design phase.** There is **no source code yet** — the repository
> currently contains the *specifications* and the *self-configuration*. The `wingfoil` CLI/MCP tool is
> **not implemented**, so its config is hand-authored (see §3). Do not assume runtime behaviour exists;
> when in doubt, the specs in `docs/01_vision/` and `docs/02_requirements/` are the source of truth.

---

## 2. Documentation map — where to find what

| Path                                      | Contains                                                                                                                                                                                                                                                                                                         |
|-------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `docs/01_vision/`                         | Product vision package. `01_product-brief.md` (identity, north star, tech stack), `04_personas.md`, `05_journeys.md`, **`06_features.md`** (the feature list **P1–P5**, the canonical feature IDs), `07_sequencer.md` (release waves v0.1→v1.0), `08_mvp-canvas.md`, `X_cli-cmds.md`, `X_lean-inception-plan.md` |
| `docs/02_requirements/`                   | Engineering requirements (downcast of the vision)                                                                                                                                                                                                                                                                |
| `docs/02_requirements/01_user_story_map/` | User Story Map (US-* stories, per journey)                                                                                                                                                                                                                                                                       |
| `docs/02_requirements/02_bdd/features/`   | BDD `.feature` files by pillar (`p1-memory/`…`p5-interaction/`) — the **acceptance contracts**                                                                                                                                                                                                                   |
| `docs/02_requirements/03_sard/`           | SARD requirements: `01_architecture.md` (**REQ-SYS-***), `02_performance-nfr.md` (**REQ-PERF-***), `03_state-context.md` (**REQ-STATE-***), `04_integrations.md` (**REQ-INT-***), `05_security-compliance.md` (**REQ-SEC-***)                                                                                    |
| `docs/03_backlog/04_backlog/`             | Operational backlog: `backlog.json`, `schema.json`, `by-release/{v0.1..v1.0}.json` (tasks + REQ infra tasks per release)                                                                                                                                                                                         |
| `docs/self/`                              | **WingFoil's own configuration** (dogfooding — see §3) + `X_wingfoil-init-plan.md`, `X_initial-design-plan.md`, `WORKFLOW.md`                                                                                                                                                                                    |

**Feature IDs** are `P<pillar>.<n>` (e.g. `P1.13`). **Requirement IDs** are `REQ-<AREA>-<nn>`.
Traceability chain: **feature (P*) → user story (US-*) → BDD scenario → SARD requirement (REQ-*) → task**.

---

## 3. WingFoil self-configuration (dogfooding)

WingFoil manages its own development. The config is hand-authored under `docs/self/.wingfoil/` (it will
move to the repository-root `.wingfoil/` once the tool can manage it). Memory **content** lives under
`docs/self/docs/04_memory/` (the `docs/04_memory/` paths in `memory.yaml` resolved against the
`docs/self/` root). Start from `docs/self/.wingfoil/README.md`.

| File                                                       | Pillar                 | What it holds                                                                                                                                                                                        |
|------------------------------------------------------------|------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `docs/self/.wingfoil/dna.yaml`                             | DNA (P2.4)             | Modules, **stacks** (technologies + methodologies), **team & roles**, resource paths (`conventions` removed in v1.1 — rules moved to `directives/custom/`; see spec-002)                              |
| `docs/self/.wingfoil/memory.yaml`                          | Memory (P1.13)         | Element **types** (`release-line, release, task, adr, decision-log, tech-spec, bug`), per-type **state machines**, and per-type `template:` scaffolds                                                |
| `docs/self/.wingfoil/memory/templates/`                    | Memory (P1.13)         | One Markdown scaffold per element type (`frontmatter.required` enforced on submit)                                                                                                                   |
| `docs/self/docs/04_memory/planning/{id}.md`                | Memory (P1.11)         | The **release-line** roadmap (one file per major version, e.g. `rl-v1.md`)                                                                                                                           |
| `docs/self/docs/04_memory/planning/{release-line}/{id}.md` | Memory (P1.11)         | That release-line's **minor releases** (v0.1→v1.0 for `rl-v1`), derived from `docs/03_backlog/`                                                                                                      |
| `docs/self/.wingfoil/directives/custom/`                   | Directives (P3.5/P3.8) | Rules: P3.8 template **stand-ins** (`code-quality, testing, code-review, architecture, security, documentation`) + WingFoil-specific (`determinism, doc-versioning, security-secrets, traceability`) |
| `docs/self/.wingfoil/roles.yaml`                           | Directives (P3.2/P3.7) | Role → directive bindings                                                                                                                                                                            |
| `docs/self/.wingfoil/workflows.yaml` + `workflows/custom/` | Workflow (P4.1)        | `sw-life-cycle` (main) + sub-workflows + three ingest mains                                                                                                                                          |

> The official P3.8 **built-in** directive templates are not implemented yet, so they live in `custom/`
> as stand-ins (`kind: custom`, `ref: [P3.8]`) until the tool ships them. `directives/built-in/` is empty.

---

## 4. Project DNA — quick reference (`dna.yaml` is authoritative)

- **Modules:** `core, storage, memory, dna, directives, workflow, cli, mcp-server` (under `src/`, planned).
- **Stacks** (`stacks.technologies`): TypeScript · Node.js 18+ · npm · Commander.js + chalk (CLI) · MCP over stdio
  + Anthropic SDK · Zod (validation) · Jest (testing, coverage **>80%**) · git storage · semver. **Methodologies**
  (`stacks.methodologies`): Lean Inception · User Story Mapping · Specification by Example (BDD) · SARD · TDD.
- **Roles:** `developer, reviewer, qa, architect, product-owner, tech-lead, facilitator, approver`.
  AI agents execute as `developer/reviewer/qa/architect` and **never hold approval authority** — all
  approvals route to the `approver` role (the human, Roberto).
- **Paths:** query categories `sources, tests, docs, config, governance` (`dna.yaml` `paths:`).

---

## 5. Memory model (`memory.yaml`)

State is **derived from each document's frontmatter** — there is **no `.wingfoil/state/` index**
(REQ-SYS-03). Every transition is validated against the type's state machine (REQ-STATE-01).

Each type's machine is encoded in `memory.yaml` as `sequence` (the ordered forward chain) + `gates`
(per-state `{state: {reject: target}}`, meaning that state's forward edge needs `approve` rather than
plain `submit`) + `waiting` (states advanced only by a workflow/engine action, no CLI verb) — see
`spec-001-memory-yaml-schema` (initial-design, rl-v1) for the full schema. This replaced an earlier
`transitions` dict-of-arrays encoding; the practical effect on the **default** machine and on `adr`/
`tech-spec` is that `reject` now lands directly back on `draft` — there is **no separate `rejected`
status** anymore anywhere (the rejection reason still lives in the git commit body, per P1.7, just not
as a status value). `task` already worked this way; `decision-log` now has its own custom machine
(previously it used the plain default) per `dl-012-decision-log-state-machine`.

| Type           | Path (under `docs/self/`)                        | State machine (forward chain; `reject` targets in parentheses)                         |
|----------------|---------------------------------------------------|-------------------------------------------------------------------------------------------|
| `release-line` | `docs/04_memory/planning/{id}.md`                | draft→planning(→draft)→active→done (·→deprecated)                                       |
| `release`      | `docs/04_memory/planning/{release-line}/{id}.md` | draft→planning→in-development→releasing→released (·→deprecated)                          |
| `task`         | `docs/04_memory/{release}/{id}.md`               | draft→pending(→draft)→backlog→in-progress→in-review(→in-progress)→approved→done          |
| `adr`          | `docs/04_memory/design/adrs/{id}.md`             | draft→pending(→draft)→accepted→superseded                                                |
| `decision-log` | `docs/04_memory/design/dls/{id}.md`              | draft→in-discussion(→draft)→ready (·→deprecated)  [in-develop/done removed per dl-017]   |
| `tech-spec`    | `docs/04_memory/design/specs/{id}.md`            | draft→pending(→draft)→approved→superseded (mirrors `adr`)                                |
| `bug`          | `docs/04_memory/bugs/{id}.md`                    | draft→open(→closed)→triaged→planned→in-progress→in-review(→in-progress)→resolved(→in-progress)→closed |
| `plan`         | `docs/05_plans/{scope}/{id}.md`                  | draft→active→done (·→deprecated)  [dl-019 — phase-plan execution scaffold; `X_*` grandfathered]        |

---

## 5.1. Memory operations — commit format

Each operation produces **exactly one git commit**, scoped to **one element type**, with a fixed,
non-overlapping scope. Never conflate operations or batch content across multiple operations into a
single commit. Subject line convention — **present-tense verb**, matching the operation name exactly:

```
wf({type}): {add|submit|approve|reject|deprecate} {id1}, {id2}, ...
```

Worked example (two separate commits): `wf(release-line): add rl-v1` then `wf(release-line): submit rl-v1`.

### `memory.add` — register a new element (draft)

1. Create the file at the path given by the type's `path` pattern (resolved under `docs/self/`).
2. Copy the type's `template.file` scaffold verbatim.
3. Fill in **only** the frontmatter skeleton:
  - `id` — generated from the type's `id_pattern` (e.g. `task-109-validation-id-engine`).
  - Any field the `add` action itself pins (e.g. `version` when the workflow action is
    `memory.add(type: release-line, version: "v1")`) — everything else stays at template defaults.
  - `status: draft` — fixed at this step.
4. Leave `title` empty and the **body as template placeholder comments** — no content written yet
   (unless the add action itself sets `title`).
5. Commit message (subject only, no body):
   ```
   wf({type}): add {id1}, {id2}
   ```
6. The commit contains **only** the new file(s) — no other changes.

### `memory.submit` — fill content and move to the next state

1. Fill in **all** required frontmatter fields (`template.frontmatter.required` for the type in `memory.yaml`).
2. Write the **full body content** — replace every template placeholder comment with real text.
3. Move `status` to the type's post-submit state — `draft → pending` for the default machine and most
   types; `draft → planning` for `release`/`release-line`, whose own machines have no `pending` state
   (§5 table).
4. Commit message (subject only, no body):
   ```
   wf({type}): submit {id1}, {id2}
   ```
5. The commit contains **only** the updated memory file(s).

### `memory.approve` — advance state (approval gate)

Per **P1.7** the commit must record three things: **approver identity**, **ISO-8601 timestamp**, and **reason**.
The git commit timestamp supplies the ISO-8601 timestamp automatically (see **P1.2**, **P1.10**); the other
two must appear explicitly in the commit message.

1. Change **only** the `status` field to the next legal state in the type's state machine (§5 table).
2. Do **not** modify any other frontmatter field or the body.
3. Commit message format — subject + mandatory body:
   ```
   wf({type}): approve {id1}, {id2} [{old-state} → {new-state}]

   Approver: {full name} <{email}> ({role})
   Reason: <why the transition is approved>
   ```
  - `Approver:` body line — full identity as `Name <email> (role)` so `wingfoil memory history`
    can surface it per **P1.10** even when git author and approver differ.
  - `Reason:` body line — **mandatory** (`--reason` is a required argument per P1.7 Scenario 2;
    omitting it is an error).
4. If the approval also registers the element in an external artifact (e.g. a task reaching `backlog`
   adds its entry to the release backlog JSON under `docs/03_backlog/04_backlog/by-release/`), include
   that artifact change in the **same commit**.
5. Agents may execute `memory.approve` **only when explicitly instructed** by the `approver` role (Roberto);
   agents never approve autonomously (§4, §8).

### `memory.reject` — send back for revision

Same evidentiary requirement as `memory.approve` (P1.7): approver identity + reason, both explicit in
the commit message (the timestamp comes from the git commit itself).

1. Change the `status` field to the type's reject target, per `memory.yaml`'s `gates` block for
   that state — e.g. `pending → draft` for the default machine, `task`, `adr`, and `tech-spec` alike
   (none of them has a separate `rejected` status); `in-discussion → draft` for `decision-log`;
   `open → closed` or `in-review/resolved → in-progress` for `bug` (§5 table). At the same time, set
   the document's `rejection_reason` frontmatter field to the `--reason` text given to the reject
   command — this is in addition to the reason already recorded in the commit body below; the
   frontmatter copy is a convenience so the reason is visible without walking git history. A later
   `memory.submit` on this document clears `rejection_reason` again (it reflects only the most recent
   reject, not a history).
2. Commit message format — subject + mandatory body:
   ```
   wf({type}): reject {id1}, {id2} [{old-state} → {new-state}]

   Approver: {full name} <{email}> ({role})
   Reason: <what needs to change before resubmitting>
   ```
3. Agents may execute `memory.reject` **only when explicitly instructed** by the `approver` role — same
   restriction as `memory.approve` (§4, §8).

### `memory.deprecate` — retire an element

Callable from any state, on any type (§5). Not an approval gate — no `Approver:` line required — but a
`Reason:` keeps the audit trail meaningful.

1. Change **only** the `status` field to `deprecated` (or a type-specific deprecate-adjacent state
   first, e.g. `accepted → superseded` for `adr`/`tech-spec` when a later element replaces this one).
2. Commit message format — subject + optional body:
   ```
   wf({type}): deprecate {id1}, {id2} [{old-state} → deprecated]

   Reason: <why deprecated, e.g. "superseded by adr-004">
   ```

---

## 6. Workflows to follow (`workflows/custom/`)

**Main (startable; multiple open mains allowed — REQ-STATE-03):**

- **`sw-life-cycle`** — the end-to-end lifecycle:
  `inception → specification → init → seed-first-release-line → release-line-cycle → sunset`.
    - `init` → `wingfoil-init` (config pillars **only** — no Memory content).
    - `seed-first-release-line` — inline phase (no `include:`): creates the first `release-line`
      (v1), `draft → planning`. Every *later* release-line (v2, v3, ...) is instead self-seeded by
      `plan-next-release-line` below — not part of this phase.
    - `release-line-cycle` *(iterate_over: release-line)* — one iteration per major version:
      `approve` (planning → active) → `initial-design` (`seed-releases` + optional
      `seed-adrs`/`seed-dls`/`seed-specs`, scoped to this release-line) → `delivery` →
      `plan-next-release-line` (closes this release-line to `done`, self-seeds the next one once
      every one of its releases is `released`).
        - `delivery` → `release-cycle` *(iterate_over: release, scoped to this release-line)* →
          `release-planning` *(incl. `identify-specs`)* → `dev-loop` *(design gate + TDD,
          iterate_over: task; review gate runs unit + **BDD** tests; keeps a fix task's source `bug`
          in sync via `bug.sync_state`)* → `release-submit` → `release-publishing` → `retrospective`.
    - `sunset` → `end-of-life`.
- **`bug-ingest`, `decision-log-ingest`, `adr-ingest`** — capture a single element on demand. If started
  while another workflow with an active `element` is running, the new file **inherits that element**
  (e.g. a bug raised during `dev-loop` inherits the active `task`).

Phase completion is **deduced** (no stored `status:`): Memory-backed phases from element status,
spec/doc phases from the existence of their `produces:` artifacts.

> **Interim — no workflow engine yet:** Until `wingfoil` exists to run workflows, whenever you are
> asked to **start a workflow** (main *or* sub), first **write a plan file** under `docs/05_plans/`
> that is coherent with that workflow definition — its phases, roles, `actions`, `produces:`, and `checks` —
> then execute against that plan. Use `docs/self/X_wingfoil-init-plan.md` (for `wingfoil-init`) or
> `docs/self/X_initial-design-plan.md` (for `initial-design`) as the model.
>
> Since `dl-019`, a phase plan is itself a **`plan` Memory element** (`memory.yaml` `plan` type; path
> `docs/05_plans/{scope}/{id}.md`; `draft → active → done`) — register it with `memory.add(type: plan)`
> when a phase starts. Existing `X_*` ad-hoc plans are grandfathered (no frontmatter required).

---

## 7. Directives to respect (`roles.yaml`)

Bindings are by **role**, never by person (REQ-SYS-08).

| Role                   | Directives                                      |
|------------------------|-------------------------------------------------|
| developer              | code-quality, testing, determinism              |
| reviewer               | code-review, traceability                       |
| qa                     | testing                                         |
| architect              | architecture, determinism, traceability         |
| product-owner          | traceability                                    |
| tech-lead              | architecture, code-review                       |
| **global (all roles)** | doc-versioning, documentation, security-secrets |

When executing under a role, **auto-load and obey that role's directives** (P3.6/P5.4.2).

---

## 8. Conventions (non-negotiable)

- **TDD / test-first**: write a failing test before implementation; keep coverage **>80%** (Jest); the
  `dev-loop` review gate runs unit **and BDD** acceptance tests.
- **Determinism**: no wall-clock, randomness, or unordered iteration in context-building paths; prefer
  explicit declared config over inferred behaviour (REQ-SYS-07 / REQ-STATE-09).
- **Traceability**: maintain feature → US → BDD → REQ → task; every ADR cites its SARD requirement(s).
- **Documentation versioning**: bump a doc's `version` only on the **first edit after it is committed**
  to git; update the date when bumping.
- **Security**: never commit credentials/secrets (everything in the config is git-versioned); MCP
  Resources are read-only — mutations only via validated MCP Tools.
- **Commits**: every state change is a git commit with author + timestamp.
- **Approvals**: agents have no approval authority; route to the `approver` role.

---

## 9. Field-provenance convention (`[SPEC]` / `[AUTHORING]`)

`dna.yaml` and `memory.yaml` annotate every field inline:

- **`[SPEC]`** — required/defined by a spec; an inline ref (feature ID, REQ code, or BDD scenario) is cited.
  Removing or renaming a `[SPEC]` field requires changing the referenced specification first.
- **`[AUTHORING]`** — a coherent addition not mandated by a spec; free to change.

---

## 10. Golden rules for agents

1. **Specs win.** `docs/01_vision/` + `docs/02_requirements/` are authoritative; the config in
   `docs/self/.wingfoil/` must trace back to them.
2. **Find before you write.** Use this map and `docs/self/.wingfoil/README.md`; don't invent paths.
3. **Respect the state machines.** Only legal transitions (per `memory.yaml`); state lives in frontmatter.
4. **Obey your role's directives.** Load them on execution; never self-approve.
5. **Keep traceability and determinism intact** in every change.
6. **The tool isn't built yet** — describe/author configuration and specs; don't assume runtime features.
7. **Starting a workflow ⇒ write its plan first.** Until `wingfoil` can run workflows, every workflow
   start (main or sub) produces a coherent plan file in `docs/05_plans/` before execution (see §6).
8. **Overview ≠ memory scan.** For general project-status questions, rely on §1–§5 of this file and
   the Claude Code auto-memory index; do **not** scan `docs/self/docs/04_memory/` unless the user
   asks about a specific element (task, ADR, decision-log, bug, release) by ID or type, **or** when
   determining the overall project state — in that case prefer a targeted search on frontmatter fields
   (e.g. `grep -r "^status:" docs/self/docs/04_memory/`) rather than reading each file in full.
9. **State changes ⇒ update auto-memory.** Whenever a state change is detected or performed on any
   memory element (task, ADR, decision-log, bug, release), update the Claude Code auto-memory index
   (`~/.claude/projects/…/memory/MEMORY.md`) to reflect the new state, so future conversations start
   with an accurate snapshot without needing to re-scan the directory.
