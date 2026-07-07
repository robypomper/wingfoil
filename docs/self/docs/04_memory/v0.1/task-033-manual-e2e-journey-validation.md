---
id: "task-033-manual-e2e-journey-validation"
type: task
title: "Manual E2E validation of Journey 0a + Journey 1"
status: in-review
release: "v0.1"
priority: "Critical"
tags: ["v0.1", "qa"]
ref: "docs/self/docs/04_memory/planning/v1/minor-v0.1.md"
bug: ""                # optional — source bug id, when this task is a fix derived from a bug (e.g. "bug-003-null-deref");
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
tmpl_version: 260703   # Orignal template version
---

## Description

`docs/self/docs/04_memory/planning/v1/minor-v0.1.md`'s Success Criteria explicitly requires "Journey
0a (new project) and Journey 1 (Alex) manually tested end-to-end" before v0.1 can be considered done —
no BDD scenario or unit test substitutes for actually walking a human through the real CLI. This task
performs that manual walkthrough once every other v0.1 task is implemented, against **Journey 0a —
"Initialize WingFoil on a New Project"** and **Journey 1 — "Alex: Start a New AI Session with Full
Context"** as described in `docs/01_vision/05_journeys.md`:

- **Journey 0a** steps: (1) create a new repo/project files; (2) run `wingfoil init` (interactive
  wizard) and confirm it guides through DNA, directives, Memory docs, workflow config, including
  reference-workflow selection (Scrum/Kanban/Lean Inception/Trunk-Based/Custom) and both wizard mode
  and agent-assisted mode; (3) start the kickoff workflow phase via `wingfoil workflow start --name
  [workflow]`; (4) verify project structure paths via `wingfoil paths` / `wingfoil paths sources
  --list`. Success bar: "Within minutes, WingFoil is initialized with sensible defaults ... No manual
  YAML editing required."
- **Journey 1** steps: (1) review the next task via `wingfoil workflow next`; (2) launch the agent via
  `wingfoil agent execute --next`; (3) confirm the agent auto-loads role-based directives + prompt via
  MCP Prompts; (4) confirm the agent queries project DNA + Memory via MCP Resources; (5) confirm the
  agent executes the task with full context and Alex can review/approve. Success bar: "Task begins
  within 30 seconds of session start ... No context window exhaustion."

v0.1 only ships a subset of each journey's tooling (Memory `add`/`search`, DNA schema + `show`/`set`,
`init`, `paths`, MCP Resources for DNA+Memory — see `minor-v0.1.md` Scope); this task validates exactly
the v0.1-scoped slice of each journey's steps end-to-end, and explicitly notes which later-pillar steps
(`workflow start`, `workflow next`, `agent execute`, MCP Prompts) are out of v0.1's scope and therefore
smoke-tested only as far as v0.1's implemented surface allows, or flagged as a known gap rather than a
release blocker.

## Acceptance Criteria

- Journey 0a, steps 1–2 and 4 above are executed manually against the actual v0.1 CLI on a fresh
  throwaway project: `wingfoil init` runs to completion, produces a valid `dna.yaml` (schema-valid per
  `spec-002-dna-yaml-schema`) plus initial Memory scaffolding, with no manual YAML editing required;
  `wingfoil paths` / `wingfoil paths sources --list` correctly reports the mapped resource paths
  afterward.
- Journey 0a step 3 (`wingfoil workflow start`) and Journey 1 steps 2–4 (`wingfoil agent execute
  --next`, MCP Prompts/Resources auto-load) are attempted; since `workflow`/`agent`/MCP Prompts are not
  in v0.1's Scope (`minor-v0.1.md` Pillar Focus: P1 Memory + P2 DNA only), any failure here is recorded
  as an explicit **known gap** (not a release blocker) rather than silently skipped.
- Journey 1 step 1 (`wingfoil workflow next`) is smoke-tested to the extent the v0.1 MCP Resources
  endpoint (DNA + Memory) supports it; findings recorded either way.
- A written record of the walkthrough (pass/fail per step, screenshots or terminal transcript, gaps
  found) is attached to this task's Execution Notes before the release moves to `release-submit`.
- Any defect found during the walkthrough that blocks the journeys' v0.1-scoped success bar is filed as
  a `bug` (per the `bug-ingest` workflow) and linked back here via `ref`, and this task does not close
  until that bug is resolved or explicitly deferred by the approver.

## Implementation Notes

- This is a **gating/closing task**: it validates the release as a whole and therefore must run last,
  after all other v0.1 tasks (`task-001` through `task-030`, plus `task-031`/`task-032`) are
  implemented — there is nothing meaningful to walk through before then.
- Scope the pass/fail judgment to what v0.1 actually promises (per `minor-v0.1.md` Scope/Success
  Criteria) — do not fail this task over journey steps that belong to pillars (Directives, Workflow,
  Interaction Layer's `agent execute`) not yet built in v0.1; document them as gaps instead.
- Coordinate with `task-032` (README/quick-start): the Journey 0a walkthrough is also the practical
  check that the new README is followable by a real user.

## Execution Notes

### design (architect) — no tech-spec gap

Verified this task's scope against `docs/self/docs/04_memory/planning/v1/minor-v0.1.md` (Scope, Pillar
Focus: P1 Memory + P2 DNA only, Success Criteria) and `docs/01_vision/05_journeys.md` (Journey 0a,
Journey 1). This task's own `ref` already cites `minor-v0.1.md` directly and every command surface it
exercises (`init`, `dna show/set`, `memory add/search`, `paths`, `mcp`) is already covered by an
approved spec (`spec-002-dna-yaml-schema`, `spec-005-cli-command-contract`, `spec-006-core-domain-api`,
`spec-008-cli-grammar`, `spec-014-mcp-server-entry-point`) cited by the tasks that implemented those
commands — no missing/insufficient tech-spec found, no `memory.add(tech-spec)` needed. Confirmed via
`src/cli/program.ts` (read, not modified) that `workflow`/`agent`/`directives` verbs beyond `workflow
list`/`directives list` are genuinely not wired — matches `minor-v0.1.md`'s Pillar Focus, not an
oversight to chase down.

### red/green — kept mostly manual, plus one value-add automated regression

This is a validation task, not a code task: the primary deliverable is the walkthrough record below,
produced by actually running the built `dist/cli.js` against a fresh throwaway temp git repo (never
this repo's own `.wingfoil/`). No failing test was written first (there is no "implementation" to make
pass) — that would be dishonest theater for this kind of task.

As a genuine value-add, `test/cli/journey-0a.integration.test.ts` (new file, committed separately as
`test(cli): task-033-manual-e2e-journey-validation — end-to-end Journey 0a v0.1 walkthrough`) scripts
the same v0.1-scoped Journey 0a cycle end-to-end against the real compiled CLI, out-of-process, via the
existing `cli-harness.cjs` bridge `test/cli/program.integration.test.ts` already uses. It gives the
manual walkthrough below a permanent automated regression guard (bug-005 fix across both templates,
the full init→dna→memory→paths cycle, and the two out-of-scope/non-defect findings below asserted as
`unknown command`/`E_VALIDATION` exit codes) — 6 new tests, all passing (see `review` below).

### review (reviewer) — full walkthrough record

**Build:** `rm -rf dist && npm run build` → exit 0; `dist/cli.js` present and runnable via `node`.

**Journey 0a — v0.1-scoped slice (steps 1-2, 4) — PASS, every step exit-code-clean, no manual YAML editing:**

Fresh throwaway repo (`mktemp -d` + `git init` + local `user.name`/`user.email`, never this repo's own
`.wingfoil/`):

| # | Command | Exit | Result |
|---|---|---|---|
| 1 | `git init` + `git config user.name/email` | 0 | Journey 0a step 1 — repo created |
| 2 | `wingfoil init --template Scrum` | **0** | Scaffolds `.wingfoil/{dna.yaml, memory.yaml, roles.yaml, workflows.yaml, directives/, memory/templates/, workflows/}` — 27 files, one commit (`chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)`) |
| 3 | `wingfoil dna show --format json` | **0** | Full parsed `DnaYaml` printed — **confirms bug-005 is FIXED**: this used to error immediately (exit 1, schema-invalid scaffold) before task-032's fix, now on `main` |
| 4 | `wingfoil dna show project` | 0 | `{"name":"","description":"","methodology":"Scrum"}` |
| 5 | `wingfoil dna show paths` | 0 | `{"sources":[],"tests":[],"docs":[],"config":[".wingfoil"],"governance":[]}` |
| 6 | `wingfoil dna set project.name "E2E Demo Project"` | 0 | One commit (`wf(dna): set project.name`) |
| 7 | `wingfoil dna show project` (read-back) | 0 | `{"name":"E2E Demo Project",...}` — read-back confirms the write |
| 8 | `wingfoil memory add --type task --title "Set up CI pipeline" --tags "infra,ci"` | 0 | Scaffolds `docs/memory/task/task-001-set-up-ci-pipeline.md`, `status: draft`, one commit |
| 9 | `wingfoil memory search CI` | 0 | Matches the new task by keyword |
| 10 | `wingfoil memory search --type task` / `--tag infra` | 0 | Both filters match the same document |
| 11 | `wingfoil paths` | 0 | Whole `paths` node, `config: [".wingfoil"]` populated by `init`, others empty |
| 12 | `wingfoil paths config --list` | 0 | `{"category":"config","paths":[".wingfoil"]}` — correctly reports the one mapped category |
| 13 | `wingfoil paths sources --list` | **1** | `error: no paths mapped for category 'sources'` — **not a defect**: this is the documented BDD behavior (`P2.5-paths.feature` "Error - querying an undefined category", `src/core/index.ts` `pathsFn` doc comment) for a genuinely-unmapped category; `sources`/`tests`/`docs` are never auto-populated by `init` (DNA-infer is Journey 0b / later scope) |
| 14 | Regression: `wingfoil init --template Kanban` in a second fresh repo → `dna show` | 0 / 0 | Confirms bug-005's fix holds for **both** v0.1 templates, not just Scrum |
| 15 | `git status --porcelain` at the end | (clean) | Every mutation (`init`/`dna set`/`memory add`) is its own scoped git commit; nothing left uncommitted; no manual YAML edit was ever performed |

**Verdict: Journey 0a's v0.1-scoped success bar PASSES.** "Within minutes, WingFoil is initialized with
sensible defaults... No manual YAML editing required" holds for the v0.1 CLI surface end to end.

**One scope note (not a bug, not a blocker):** `wingfoil dna set <key> <value>` only ever writes a
**scalar** value (`src/dna/set.ts` `setDnaValue` — always a string leaf); attempting `dna set
paths.sources src` fails schema re-validation (`E_VALIDATION ... expected array, received string`,
exit 1). This is a deliberate, already-approved v0.1 scope line from `task-025-implement-dna-set`'s own
design phase (BDD `P2.1-dna-set.feature` only covers scalar-leaf writes) — not a regression, and
`config` (the one path category `init` does populate) round-trips correctly through `paths`/`paths
--list` per above. Mapping `sources`/`tests`/`docs` today requires manual YAML editing, which is a real
gap **against the full, later-release Journey 0a vision** (interactive wizard + DNA-infer, Journey
0b), but not against v0.1's own promised scope (`minor-v0.1.md` Pillar Focus: P1 Memory + P2 DNA only,
no DNA-infer/wizard feature in v0.1's feature list) — recorded here as a **known limitation**, not filed
as a bug.

**Journey 0a step 3 (`wingfoil workflow start --name [workflow]`) — KNOWN GAP, attempted, not a blocker:**

`wingfoil workflow start --name Scrum` → exit **1**, `error: unknown command 'start'`. `wingfoil
workflow --help` shows only a `list` subcommand exists (`workflow list` itself works, exit 0 — lists
the loaded workflow definitions read-only, e.g. `sw-life-cycle`, `scrum-delivery`) — there is no
workflow *execution engine* in v0.1 (Pillar 4, not in `minor-v0.1.md`'s Pillar Focus). Matches the task
description's explicit framing exactly. Not a release blocker.

**Journey 1 steps 2-4 (`wingfoil agent execute --next`, MCP Prompts auto-load) — KNOWN GAP, attempted:**

`wingfoil agent execute --next` → exit **1**, `error: unknown command 'agent'` (no `agent` noun
registered at all — confirmed in `src/cli/program.ts`, which wires only `init`/`mcp` specially plus the
`CORE_MODULES` noun-verb ops; there is no `agent` module). MCP Prompts: the running `wingfoil mcp`
server (smoke-tested below) exposes only Resources, no `prompts/list` capability — consistent with
`spec-014-mcp-server-entry-point`'s v0.1-scoped "Resources only" surface. Both are out of v0.1's Pillar
Focus (Interaction Layer's `agent execute` + MCP Prompts are P5.1.2/P5.2.2+, not in `minor-v0.1.md`'s
feature list `[P1.1, P1.2, P1.3, P1.5, P1.11, P1.12, P1.13, P2.1, P2.2, P2.4, P2.5, P5.1.1, P5.2.1]`).
Not a release blocker.

**Journey 1 step 1 (`wingfoil workflow next`) + MCP Resources smoke test — findings recorded:**

`wingfoil workflow next` → exit **1**, `error: unknown command 'next'` (same reason as step 3 above:
no workflow engine in v0.1). As the v0.1-scoped substitute, the read-only MCP Resources channel was
smoke-tested programmatically: started the real `wingfoil mcp` server (stdio) against the same
throwaway temp repo, connected a real `@modelcontextprotocol/sdk` `Client`:

- `resources/list` → `wingfoil://dna` (`dna.read`) and `wingfoil://workflows` (`workflows.list`)
  advertised; the templated `wingfoil://dna/{section}` and `wingfoil://memory/{type}[/{id}]` resources
  aren't enumerated by `resources/list` (expected MCP behavior for templated resources — the SDK doesn't
  list a `ResourceTemplate`'s instances) but ARE directly readable.
- `resources/read wingfoil://dna` → full parsed DNA as JSON — **works**.
- `resources/read wingfoil://memory/task` → the one `memory add`-scaffolded task, as a JSON collection —
  **works**.
- `resources/read wingfoil://memory/task/task-001-set-up-ci-pipeline` → the full document (frontmatter +
  body) as `text/markdown`, plus a parsed `metadata` block — **works**.
- `resources/read wingfoil://workflows` → the loaded workflow definitions (names/kinds/descriptions) —
  **works**; this is the closest v0.1 gets to Journey 1 step 1 ("Alex reviews next task in workflow"):
  an agent CAN see what workflows exist over MCP, but there is no "next task" computation (no workflow
  *state*/engine in v0.1 — matches Pillar Focus).
- `tools/list` → `McpError -32601: Method not found` — **confirms the v0.1 read-only-only channel**:
  zero MCP Tools are registered (mutations are CLI-only in v0.1, per `spec-014` §3 and task-016's
  channel-enumeration guarantee), so the SDK's `McpServer` never registers a `tools/list` handler at
  all. Not an error — the expected shape of a Resources-only v0.1 server.

**Verdict:** `minor-v0.1.md`'s Success Criterion "MCP Resources endpoint (DNA + Memory) functional"
**PASSES** — both DNA and Memory (collection + document) resources returned real, correct data over a
real stdio MCP client connection against a real project.

**No new bug filed.** Every failure encountered during the walkthrough traces to an already-scoped-out
v0.1 pillar (Workflow engine, `agent execute`, MCP Prompts — none in `minor-v0.1.md`'s feature list) or
an already-tracked/deferred item (bug-006 `directives list`, reproduced identically — see below; the
Commander unknown-top-level-command exit-1-not-2 deviation, also reproduced identically and already
tracked in `program.integration.test.ts`'s own header comment). No v0.1-scoped success-bar step failed.

**Already-tracked gaps re-confirmed (not re-filed):**
- **bug-006** (`directives list` errors on fresh init, exit 1 `E_VALIDATION`) — reproduced exactly as
  described; `directives` is out of v0.1's Pillar Focus (P3), already deferred.
- **Commander unknown-top-level-command deviation** (`wingfoil bogus-command` → exit 1, not spec-008's
  aspirational exit 2) — reproduced exactly (`bogus-command` → `error: unknown command
  'bogus-command'`, exit 1); already tracked in `test/cli/program.integration.test.ts`'s header comment.
- **bug-005** (init scaffold schema-invalid) — confirmed **FIXED** (task-032, already on `main`); this
  walkthrough is the closing verification.

**Checks:** `npx tsc --noEmit` → exit 0 (no errors). `npx jest` (full suite) → **57 suites, 548 tests,
all passing** (includes the 6 new `journey-0a.integration.test.ts` cases). No BDD runner exists yet as
a separate command in this repo (BDD acceptance is exercised via the Jest integration suites per
`dev-loop.yaml`'s current wiring, same as every prior v0.1 task) — nothing additional to run beyond the
full `npx jest` pass above.
