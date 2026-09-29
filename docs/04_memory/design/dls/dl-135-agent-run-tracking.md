---
id: dl-135-agent-run-tracking
type: decision-log
title: "`agent execute` can launch an agent run but nothing can list active, waiting or past runs, or hand an earlier session to a new agent — three sources for three states, the session id in `dl-114`'s run record, and a declared execution mode per phase"
status: in-discussion
context: "planning"
release: "v0.3"
contributor: ""
credit: ""
tmpl_version: 260703
---

## Context

Filed during v0.3 `release-planning`, from the approver ruling of 2026-09-29, v0.3 release-planning
(`release-planning-rel-v0.3-plan` R5). R2 of the same plan fixes how an agent is run: `wingfoil agent
execute` launches **the agent's own CLI** through a declared per-agent adapter, not an SDK.

**What is planned today covers launching an agent, not following it.**

- The vision plans exactly one `agent` command. `grep -rnoE "wingfoil agent [a-z-]+" docs/01_vision
  docs/02_requirements | awk -F: '{print $NF}' | sort | uniq -c` → `23 wingfoil agent execute`, and
  nothing else. `grep -rnE "agent (list|status|history|resume)|session id|session_id|--resume"
  docs/01_vision docs/02_requirements` finds no command of that kind; its only hits are two BDD lines
  ("the agent runs under role …", `P5.3.2-agent-role-selection.feature:11,17`).
- P5.3 covers launch and routing: P5.3.1 `agent execute [--next]`, P5.3.2 role selection per step,
  P5.3.3 relevance filtering (`docs/01_vision/06_features.md:133-135`). P5.4 covers what the agent
  receives: roles, directive binding, context pre-loading, execution context, the init wizard
  (`06_features.md:141-145`). None of them lists a run, or says which runs are in progress.
- `P5.3.1-agent-execute.feature` has three scenarios, all about starting a run (`--next`,
  `--element`, no next step). `REQ-INT-07` (`03_sard/04_integrations.md:64-72`) likewise ends when
  the agent starts.
- Nothing ships yet: `grep -cE "name: '(agent|memoryAmend)" src/core/index.ts` → `0`. `dev-loop.yaml`
  names `agent.execute` as the action of `red`, `green` and `refactor`
  (`.wingfoil/workflows/custom/dev-loop.yaml:64,72,80`).

**What `dl-114` already decides.** `dl-114-recording-agent-token-consumption` (`ready`, v0.3) was
ratified with Q1 (A), Q2 (b), Q3 (i) (`820fd000 wf(decision-log): approve
dl-114-recording-agent-token-consumption [in-discussion → ready]`, `Reason:` "taking the recommended
options: Q1 (A), Q2 (b), Q3 (i)"). So `agent execute` writes one record per run, in a run log under a
declared `dna.yaml` `paths:` entry, committed with the Memory operation that closes the step. The
record holds element id, workflow phase, role, agent and model, input/output/cache tokens, the
WingFoil build (`dl-111`), wall-clock duration and exit status, parsed by a per-agent adapter with
`not-reported` where the agent gives none. That record is the history of past runs. It does not
carry the agent's **session id**, so a past run cannot be pointed back to the session that produced
it.

**Three things a user of `agent execute` needs and cannot get:**

1. **Which agents are running now**, on this machine: a long `green` launched in another terminal
   is invisible.
2. **Which steps are waiting for an agent**: a step whose role is an agent role and that no run has
   picked up.
3. **Which earlier runs a new agent may build on**: a developer sent back to `green` after a reject
   restarts from nothing, or the user pastes the old conversation in by hand.

**Constraints.**

- `REQ-SYS-03` (`03_sard/01_architecture.md:34-41`) and `REQ-STATE-02`
  (`03_sard/03_state-context.md:36-42`): state is deduced from Memory files, and "No
  `.wingfoil/state/` artifact exists". A committed index of running agents would be exactly that.
- A running process exists only on the machine that started it. Git cannot carry it before a push.
- An agent's session transcript is kept by the agent on the machine that ran it, not in the
  repository: `git ls-files | grep -ciE 'transcript|\.jsonl$'` → `0`, and `.gitignore:7` ignores
  `.claude`, the local state directory of the agent that develops this repository. A transcript also
  holds whatever the agent read, secrets included (`REQ-SEC-08`).

## Decision

**1. Three states, three sources.** No new stored state.

- **Past** runs are the `dl-114` run log, in git.
- **Waiting** runs are **deduced** from the workflow: a step that is ready (`workflow next`, P4.4)
  and whose role is an agent role, with no active run on it. This is a deduction, as phase
  completion already is (P4.13, `REQ-SYS-03`).
- **Active** runs come from a **local, ephemeral registry** written by `agent execute`: one entry per
  live run, holding the process id, run id, start time and step. It is git-ignored, deleted when the
  run ends, and pruned of entries whose process is gone. It is a cache of the machine's processes,
  not project state, so recomputing it from `ps` yields the same answer.

  **Limit, stated:** a colleague's active runs are not visible. Their runs appear as past runs after
  they push.

**2. The run record gains the session id.** This amends `dl-114`'s ratified Q2 (b): the record also
holds the agent's session id, extracted by the adapter, or `not-reported` where the agent exposes
none (as `dl-114` Q3 (i) does for tokens).

**3. Three execution modes, declared per phase** of a workflow:

- **`fresh`** — no earlier session; the agent receives only Memory, DNA and directives. It is the
  default, and it is **mandatory** for phases whose purpose is independent judgement (`review`, and
  every `qa` phase), per `dl-134-dev-loop-separation-of-duties`.
- **`resume`** — the agent resumes **its own** earlier session on the same element and role, for
  instance a developer back in `green` after a reject. Allowed only if the adapter declares resume
  support.
- **`reference`** — the new agent receives a **summary** of named earlier runs, never their
  transcript. Handoff content stays in the repository: the task's Execution Notes or a summary field
  of the run record (Q2).

**4. Commands and a Resource**, every command with `--format json` (`REQ-INT-05`):

- `wingfoil agent list [--active|--waiting|--past] [--element <type:id>] [--phase <name>]`;
- `wingfoil agent show <run-id>`;
- `wingfoil agent execute --next [--resume <run-id> | --ref <run-id>]`, where `--resume` and `--ref`
  select the modes of point 3 and are refused where the phase does not declare that mode;
- a read-only MCP Resource `wingfoil://agents/runs` (`REQ-INT-01`) for UIs and agents.

**5. The adapter declares**, per agent: how to obtain the session id; whether it supports resume and
with which flag; how to read token usage (`dl-114` Q3 (i)); whether it can export a summary at the
end of a run.

**Release split**, ruled by the approver (plan R5):

- **v0.3:** the run record with session id; `agent list --past` and `--waiting`; `agent show`;
  `fresh` as the default mode.
- **v0.4:** the active registry and `agent list --active`; `--resume` and `--ref`; the MCP
  Resource.

**Open choices:**

**Q1 — where the active registry lives.**
- **(a) `.wingfoil/run/`, git-ignored.** It sits next to the configuration it belongs to, and
  `wingfoil init` adds the ignore line. It is inside `.wingfoil/`, next to the path `REQ-SYS-03`
  forbids, so the fit criterion needs a sentence saying why this is not a state index.
- **(b) a per-user state directory outside the project** (the OS's user state location), keyed by
  the repository's path. Nothing to ignore, nothing a careless `git add -A` can commit, but two
  clones of one repository must be told apart and the location differs per OS.
- **(c) no registry: probe running processes** for the agent CLI and its arguments. No file at all,
  but it depends on each agent's process shape and cannot map a process to a step reliably.

**Q2 — where a `reference` summary lives.**
- **(a) a field of the run record** (`summary`), filled from the adapter's export (point 5) or left
  `not-reported`.
- **(b) the task's `## Execution Notes`**, written by the agent before the step closes.
- **(c) both:** the record points to the Execution Notes section the run wrote.

**Q3 — run-id format.** It must not come from a clock or a random source, so two records of the same
history get the same ids (`REQ-SYS-07`).
- **(a) derived:** `<element-id>/<phase>/<n>`, where `n` is the count of earlier records for that
  element and phase, plus one.
- **(b) the agent's session id**, which the agent generates, is often random, and may be
  `not-reported`.
- **(c) the commit that closes the step**, which does not exist while the run is active.

**Recommendation: Q1 (a), Q2 (c), Q3 (a).**

- **Q1 (a)** keeps everything WingFoil writes under one directory, and the `init` ignore line is
  testable. The `REQ-SYS-03` fit criterion is amended to read "no committed state index", which is
  what its rationale ("dual-source-of-truth drift") is about: a git-ignored cache of live processes
  cannot drift from git.
- **Q2 (c)**: Execution Notes are already where a reviewer reads handoff (`dl-015`), and the record
  pointing to them keeps one run to one record without duplicating prose.
- **Q3 (a)** is readable, sorts, and recomputes the same way on every clone. `n` is taken from the
  run log at the commit the run starts from. From v0.4 the active registry refuses a second
  concurrent run on the same element and phase; until then a duplicate id is caught when the second
  record is committed.

## Rationale

- **Nothing new is stored in git that git cannot already answer.** Past runs are records `dl-114`
  already commits; waiting runs follow from the workflow; only live processes need a place of their
  own, and they are machine-local by nature. Committing them would put a state index in git and
  make it wrong for every other clone.
- **The session id is what joins a record to a session.** Without it, `--resume` has nothing to
  resume and `agent show` cannot tell the user which of the agent's sessions produced a run.
- **Transcripts stay out.** They live outside the repository, differ per machine, and hold what the
  agent read. A summary written into the repository is reviewable and can be secret-scanned; a
  transcript is neither.
- **`fresh` by default** protects the independence of review and qa: a reviewer that inherits the
  developer's session inherits its reasoning.
- **Trade-off.** `resume` and `reference` make runs depend on earlier ones, so two runs from the same
  Memory can differ in what they were given. Declaring the mode per phase, and recording it in the run
  record, keeps that visible to the Determinism Index's process measure rather than hidden.

Alternatives considered:
- **A committed `agents.yaml` of active runs.** Rejected: a state index (`REQ-SYS-03`), wrong on
  every clone the moment it is committed.
- **Pass the previous transcript to the new agent.** Rejected: outside the repository, machine-local,
  unscannable, and unbounded against `REQ-PERF-01`'s 30 s launch budget and `REQ-PERF-05`'s bounded
  context.
- **Leave tracking to each agent's own UI.** Rejected: it cannot see the workflow, so it cannot say
  which steps are waiting.

## Actions

1. **Ratify, choosing Q1–Q3.** Owner: approver. The choice goes in the approve commit's `Reason:`.
2. **Amend `dl-114`** with the session-id field (point 2). With `dl-108`'s amend verb not yet shipped
   (`grep -cE "name: '(agent|memoryAmend)" src/core/index.ts` → `0`), the amendment is recorded here,
   as `dl-017` did for `dl-012`, and applied to `dl-114`'s body when the verb exists.
3. **Vision and requirements**, each with a `doc-versioning` bump:
   - `06_features.md`: `agent list` and `agent show` as new P5.3 rows, and the execution modes in
     P5.3.1's description;
   - new BDD files under `docs/02_requirements/02_bdd/features/p5-interaction/` for `agent list` and
     `agent show`; `P5.3.1-agent-execute.feature` gains the mode scenarios, including `--resume`
     refused on a `fresh`-only phase;
   - `REQ-INT-07` gains the run record and modes (with `adr-012`'s rewrite for R2); `REQ-SYS-03`'s fit
     criterion under Q1 (a).
4. **`spec-003-workflows-yaml-schema`** gains the per-phase `mode:` attribute (values `fresh`,
   `resume`, `reference`; default `fresh`); **the agent-adapter spec** (`spec-016`, identified in
   `identify-specs`) gains the adapter declarations of point 5 and the run-id rule of Q3.
5. **`dna.yaml`** gains the run-log path (`dl-114` Action 2); **`init`** writes the ignore line under
   Q1 (a).
6. Tasks are derived by v0.3 `release-planning` (`build-backlog`), split per plan R5, not created
   here.

## Relations

- **Origin:** approver ruling, 2026-09-29, v0.3 release-planning (`release-planning-rel-v0.3-plan`
  R5); the adapter per plan R2.
- **Amends:** `dl-114-recording-agent-token-consumption` Q2 (the session id). Precedents for one
  decision-log amending another: `dl-014-dev-loop-plan-deltas` (on `dl-002`),
  `dl-017-decision-log-remove-delivery-states` (on `dl-012`). `dl-108-amending-an-approved-element`
  (`ready`, v0.3) is not yet implemented.
- **Depends on:** P5.3.1 `agent execute`; `adr-012` (agent CLI through an adapter, plan R2), to be
  recorded in this planning's `record-adrs` step.
- **Related:**
  - `dl-134-dev-loop-separation-of-duties`, whose
    independent executors are the `fresh` mode;
  - `dl-094-one-author-identity-per-act`, `dl-111-tool-signature-in-commits` (who and which build,
    per act; the run record adds which session);
  - `dl-015` (Execution Notes as handoff).
- **Traceability:** P5.3.1, P5.3.2, P5.4.3, P5.4.4, P4.4, P4.5 (`workflow status`, pending gates),
  P4.13; `REQ-SYS-03`, `REQ-STATE-02`, `REQ-SYS-07`, `REQ-INT-01`, `REQ-INT-05`, `REQ-INT-07`,
  `REQ-PERF-01`, `REQ-PERF-05`, `REQ-SEC-08`; BDD
  `p5-interaction/P5.3.1-agent-execute.feature`, `p5-interaction/P5.3.2-agent-role-selection.feature`,
  `p4-workflow/P4.13-state-deduction.feature`.
