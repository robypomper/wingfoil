---
id: "dl-080-perennial-agents"
type: decision-log
title: "Perennial agents: specialist agents that live as long as the project, declared in DNA, rebuilt from git, and available to the agents each workflow step launches"
status: in-discussion
context: "product"
release: ""
contributor: "Roberto Pompermaier"
credit: "Original idea: project-lifetime agents acting as the project's institutional conscience and knowledge, one per discipline, that step agents can talk to."
tmpl_version: 260703
---

## Context

Today WingFoil knows one kind of agent: the **step agent**. A workflow step names a `role`.
`wingfoil agent execute [--next]` (**P5.3.1**, REQ-INT-07) resolves the role and the target element,
and launches an agent with a context built from DNA + Memory + the role's directives (**P5.4.3/P5.4.4**,
REQ-STATE-05). The agent works on that one element and then goes away. What it learned stays behind
only if it wrote it into Memory, and the next step agent gets a fresh context built by the same
deterministic loader. `dna.yaml` models this in `team.agents` as a single generic entry
(`executes_as: [developer, reviewer, qa, architect]`, `approval_authority: false`).

That model is deterministic and easy to audit, but it has no **continuity of judgement**. No agent
spans the project. Nothing plays the part that senior people play in an organization: the architect
who remembers why an option was dropped two releases ago, the security lead who spots a pattern
across three unrelated tasks, or the project manager who sees that the backlog is drifting from the
release-line's goal. Step agents rebuild that knowledge from scratch every time, and only from what
was formally recorded. A lot of useful knowledge sits between a Memory element and the next one:
rejected alternatives, recurring review findings, conventions that exist in practice but were never
written down.

The proposal: the project manager can declare **perennial agents** in addition to step agents. These
are started when development begins, one per discipline (architecture, project management,
engineering, review, testing, security, …). Step agents launched by the workflow can consult them.
Together they act as the project's **institutional conscience and knowledge**.

This document puts that idea into WingFoil's terms: its pillars, its invariants, and its
requirement IDs. It also names the questions that must be settled before the idea can be downcast
into USM → BDD → SARD → backlog.

## Decision

### 1. Definition

A **perennial agent** (PA) is a **declared, named, advisory** agent with these properties:

- **Identity lasts as long as the project.** It exists from the `sw-life-cycle` phase that starts it
  until `sunset`, across every release-line and release.
- **One role, one domain.** It is bound to exactly **one DNA role** (so it inherits that role's
  directives through `roles.yaml`, P5.4.2 / REQ-SYS-08) and to a declared **knowledge domain**: the
  Memory types, DNA path categories and tags it tracks.
- **It can be consulted.** Step agents, other PAs (within limits) and humans can ask it questions
  through a consultation channel on the Interaction Layer.
- **It is advisory only.** It never holds approval authority, never moves an element past a gate,
  and never overrides a directive. Its output is advice with citations, plus draft Memory elements
  at most.

| | Step agent (today) | Perennial agent (proposed) |
|---|---|---|
| Declared in | a workflow step's `role:` | `dna.yaml` `team.agents.perennial[]` |
| Lifetime | one step on one element | the project (`start` → `sunset`) |
| Context | role directives + Memory for the **task** (REQ-STATE-05) | role directives + Memory for the **domain** + its own knowledge journal |
| Launched by | `agent execute` (P5.3.1) | `sw-life-cycle` action, or `agent perennial start` |
| Writes | deliverables, submits its element | advice, knowledge-journal notes, draft elements |
| Approval authority | none | none |

### 2. The persistence is in git, not in the process

This is the central design choice, and it is what keeps the idea compatible with the North Star.
A PA's **identity and knowledge** last as long as the project. **Its running process does not have
to.** A PA has three layers of knowledge:

| Layer | What | Authoritative? | Where |
|---|---|---|---|
| **L0 — Project record** | DNA + Memory + Directives, filtered by the PA's domain | yes | existing pillars |
| **L1 — Knowledge journal** | distilled, cited notes the PA writes as it goes: rejected alternatives, recurring findings, unwritten conventions it has observed | yes, once recorded | a Memory type or path (see open question Q1) |
| **L2 — Session cache** | whatever the live model instance has in its context window | **no**, and it can be thrown away | process memory only |

**Rehydration invariant:** the context a PA starts from is a pure function of
`(pa-id, project-commit)`. It is L0 filtered by domain plus L1, assembled by the same loader under
the same ordering rules as step-agent context. This extends REQ-SYS-07 / REQ-STATE-09 from the
`(task, role, project-commit)` tuple to `(pa-id, project-commit)`. Two runs that consult the same PA
at the same commit start from byte-identical context. Anything a PA "knows" that is not in L0 or L1
does not count as project knowledge. If it matters, the PA must write it to L1, where it is
versioned, cited and reviewable like everything else.

This also follows REQ-SYS-03 / REQ-STATE-02: there is **no runtime-state index** for PAs. Whether a
PA process is running is operational state, not project state. The project records only the
**declaration** (DNA) and the **journal** (L1).

### 3. Declaration — DNA (P2), extending `team.agents`

```yaml
team:
  agents:
    - name: AI agent (Claude/Cursor/etc.)       # existing step-agent entry, unchanged
      executes_as: [ developer, reviewer, qa, architect ]
      approval_authority: false
    perennial:                                  # proposed
      - id: pa-architecture
        role: architect                         # directives come from roles.yaml, never listed here
        domain:
          memory_types: [ adr, tech-spec, decision-log ]
          paths: [ sources, docs ]              # dna.yaml `paths:` categories
          tags: [ architecture ]
        consulted_by: [ developer, reviewer, tech-lead ]   # roles allowed to consult it
        journal: true                           # has an L1 knowledge journal (see Q1)
      - id: pa-security
        role: security                          # a custom role (P5.4.1), declared in team.roles
        domain: { memory_types: [ bug, tech-spec ], paths: [ sources, config ], tags: [ security ] }
        consulted_by: [ developer, reviewer ]
        journal: true
```

The declaration schema follows the existing rules: validated with Zod, bound by role rather than by
person (REQ-SYS-08), and free of secrets (REQ-SEC-08). A PA whose `role` is not in `team.roles` is
rejected with the same "unknown role" error P5.4.2 already specifies.

Suggested **reference catalogue**. These are shipped as a template, not mandated (compare P3.8):

| PA | Role | Domain | Typical question |
|---|---|---|---|
| `pa-architecture` | architect | adr, tech-spec, decision-log; `sources` | "Does this module boundary contradict an accepted ADR?" |
| `pa-delivery` | product-owner | release-line, release, task, bug | "Is this task still inside the release scope?" |
| `pa-engineering` | developer | `sources`, `tests`; code-quality directives | "What is the established pattern for X here?" |
| `pa-review` | reviewer | review findings, rejected submits | "What do reviews in this area keep rejecting?" |
| `pa-quality` | qa | BDD features, `tests` | "Which acceptance criteria does this change touch?" |
| `pa-security` | security (custom) | `sources`, `config`, security-secrets directive | "Does this change add a new trust boundary?" |

### 4. Lifecycle — Workflow (P4)

The engine derives a PA's lifecycle; nothing stores it:

`declared` (in DNA) → `active` (started by a workflow action; can be rehydrated at any commit) →
`retired` (removed from DNA, or `sunset` reached). The journal of a retired PA stays in git as
history.

Proposed workflow actions (all run by the engine, none by hand):

- `agent.perennial.start(all | id)` — in `sw-life-cycle`, right after `init` (the config pillars
  must exist before a PA can be declared and rehydrated).
- `agent.perennial.refresh` — at phase boundaries where L0 changes a lot (for example after
  `release-publishing`). It rebuilds every active PA from the new commit so no PA answers from stale
  context.
- `agent.perennial.retire(all)` — in `sunset` / `end-of-life`.
- A phase may declare **`consult:`**. Example: `dev-loop`'s design gate declares
  `consult: [pa-architecture, pa-security]`. The engine then requires a recorded consultation of each
  listed PA before the phase can complete. That check is shallow in the Is/Is Not sense: it tests
  that the consultation record exists, not that the advice was right.

### 5. Communication — the consultation protocol (P5)

A consultation is **synchronous request/response**, not a free conversation:

```
request : { from: {role, workflow, phase, element}, to: pa-id, question, refs[] }
response: { answer, citations[]: (element-id | path@commit), project-commit, pa-id }
```

- **Answers must cite.** Every claim points to L0/L1 sources. An uncited claim is marked
  `uncited: true` so the consulting agent can weigh it. A PA is valuable because it remembers
  *recorded* things, not because it is persuasive.
- **Channels.** MCP Tool `agent_consult` for agents. It is a Tool rather than a Resource because it
  can produce a record (REQ-SEC-05). CLI `wingfoil agent consult <pa-id> "<question>"` for humans,
  for example a newcomer who wants the project's institutional memory. CLI and MCP stay at parity
  (REQ-SYS-05).
- **PA → PA** consultations are allowed with a **depth limit of 1**: a PA consulted by another PA
  cannot consult further. This rules out loops and unbounded fan-out.
- **PA-initiated signals.** A PA that notices a problem, such as a contradiction between a task and
  an ADR, does not act on it. It **files a draft element** through the existing ingest mains
  (`bug-ingest`, `decision-log-ingest`, `adr-ingest`), and the draft inherits the active element as
  those mains already specify. It can also raise an **X1 human-needed notification**. Humans and
  gates decide from there.

### 6. Authority and security (REQ-SEC-03/05)

- `approval_authority` is **always false** for a PA, and the schema rejects `true`. A PA never calls
  `memory.approve` / `memory.reject`.
- The only mutating Tools a PA may call are: writing its own L1 journal, and `memory.add` /
  `memory.submit` of draft elements through the ingest mains. Anything else is refused at the Tool
  layer, whatever the role's permissions would allow a step agent.
- A PA's advice **never overrides a directive**. If the two conflict, the directive wins and the
  conflict itself becomes a draft decision-log.

### 7. Boundaries (Is / Is Not)

WingFoil **does not become an agent runtime.** It declares PAs, assembles their deterministic context,
starts them through the same wrapper as P5.3.1 (REQ-INT-07), routes consultations and records them.
The model's reasoning still happens in the configured agent. WingFoil does not judge whether an
answer is correct, in line with "not a code reviewer / not a work verifier". The consultation
channel is request/response through Tools, not a real-time collaboration surface ("not a real-time
collaboration platform").

### Open questions for the approver

**Q1 — Where does the L1 knowledge journal live?**
- **(A)** A new Memory type `knowledge-note` (`docs/04_memory/knowledge/{pa-id}/{id}.md`) with a
  light machine `draft → accepted (·→ deprecated)`, gated by the PA's human counterpart role.
  *Cost:* one more type and one more gate. *Buys:* journal notes are reviewable before they shape
  later answers.
- **(B)** Reuse `decision-log` with `context: knowledge`. *Cost:* dilutes what a DL is (a decision)
  with what a note is (an observation). *Buys:* no new type.
- **(C)** No journal: a PA is L0 only. *Cost:* the PA knows nothing that is not already formal
  Memory, which removes most of what "institutional conscience" means. *Buys:* the smallest surface
  and trivial determinism.

**Q2 — How much of a consultation is recorded?**
- **(A)** Every consultation, as a commit or file tied to the consulting element. Fully reproducible,
  but noisy.
- **(B)** Only consultations that a phase's `consult:` requires, or that a deliverable cites (in a
  task's Execution Notes). *Cost:* an unrecorded consultation still influenced a step, which is a
  determinism gap. *Buys:* a readable record.
- **(C)** None. Incompatible with REQ-SYS-07 whenever advice affects output, so listed only for
  completeness.

**Q3 — Process model.**
- **(A)** Long-running process per PA (for example its own MCP server). Lower latency, but it has
  L2 state that can drift from L0/L1.
- **(B)** An instance rehydrated on demand for each consultation (identity is perennial, the process
  is not). Deterministic by construction, but pays the context-assembly cost every time
  (REQ-PERF-*).
- The two are compatible: (B) defines the semantics, and (A) is an allowed optimization *only if*
  it is refreshed at every project-commit change it answers against.

**Q4 — Where in the plan.** The idea needs `agent execute` (P5.3.1, v0.3 backlog) and a workflow
engine, and neither exists yet. The choice is between a new **P5.5 — Perennial Agents** sub-group
inside rl-v1 (after v0.3) and a **rl-v2** candidate, which leaves the MVP scope untouched.

## Rationale

- **It is the natural next step after role-based context, not a new pillar.** Everything a PA needs
  already exists as a concept: roles and directive binding (P3/P5.4), deterministic context assembly
  (P5.4.4), MCP Tools and Resources (P5.2), ingest mains that inherit the active element (P4),
  human-needed notifications (X1). A PA is those concepts with a **project-long identity** and a
  **domain** instead of a task.
- **Putting persistence in git keeps the North Star.** A "conscience" that lived only in a model's
  context window would be the least deterministic part of the system: two runs would get different
  advice depending on which conversation happened to come first. Requiring that everything a PA
  knows can be rebuilt from `(pa-id, project-commit)` turns the idea from a threat to the
  Determinism Index into a contributor to it. Knowledge that today evaporates between step agents is
  pushed into versioned, cited Memory.
- **Advisory-only keeps governance intact.** PAs add judgement without adding authority, so
  REQ-SEC-03 and the "agents never approve" rule (§4, §8) need no exception. A persuasive agent that
  could approve would be a gate one agent could walk past.
- **Mandatory citations stop PAs from becoming oracles.** A cited answer can be checked against the
  record. An uncited one is flagged, so a step agent never quietly inherits unrecorded opinion as
  fact.
- **The alternatives considered were weaker.** Longer step contexts ("just load more Memory") scale
  badly and still lose the cross-element observations. One all-knowing project agent loses the
  specialization and the role → directive binding that makes the advice predictable.

## Actions

1. **Settle Q1–Q4.** Owner: approver, recorded in this document's approve commit `Reason:`.
2. If ratified, downcast along the documentary chain (`docs/design.md`):
   - vision: add **P5.5 — Perennial Agents** to `06_features.md` (candidates: P5.5.1 declaration,
     P5.5.2 rehydration, P5.5.3 consultation, P5.5.4 phase `consult:` gate, P5.5.5 PA-initiated
     signals) and place it in `07_sequencer.md` per Q4;
   - USM stories and BDD features under `p5-interaction/`;
   - SARD candidates: **REQ-STATE-10** (PA rehydration determinism over `(pa-id, project-commit)`),
     **REQ-SEC-10** (PAs are advisory: no approval, restricted mutating Tools), **REQ-INT-10**
     (consultation protocol, citations, depth limit);
   - a **tech-spec** for the `team.agents.perennial` schema and the consultation request/response
     shape.
3. Do not schedule implementation before P5.3.1 and the workflow engine exist. Both are
   prerequisites, not parallel work.

## Relations

- **Extends:** P5.3.1 / REQ-INT-07 (agent execution wrapper), P5.4.1–P5.4.4 (roles, binding, context
  pre-loading), `dna.yaml` `team.agents`.
- **Constrained by:** REQ-SYS-07 / REQ-STATE-09 (determinism), REQ-SYS-03 (no state index),
  REQ-SEC-03 / REQ-SEC-05 (approval authority, read-only channel), REQ-SYS-05 (CLI/MCP parity),
  `03_is-isnot.md` (not an agent, not a verifier, not a real-time collaboration platform).
- **Reuses:** the `bug-ingest` / `decision-log-ingest` / `adr-ingest` mains (element inheritance),
  X1 notifications, `spec-012-context-loader-relevance-filtering` (domain filtering is the same
  mechanism as task relevance filtering).
