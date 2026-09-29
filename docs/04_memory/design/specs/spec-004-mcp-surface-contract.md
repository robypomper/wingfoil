---
id: spec-004-mcp-surface-contract
type: tech-spec
title: "MCP server surface contract (Resources, Prompts, Tools)"
status: approved
scope: "src/mcp"
supersedes: ""
tmpl_version: 260703
---

## Context

WingFoil's Interaction Layer (P5) is dual: a CLI for humans and an **MCP server** for agents (P5.2).
Nothing under `src/mcp` exists yet — this spec is the forward-looking contract that the future
implementation must satisfy, so agent-facing behaviour is defined once rather than re-derived ad hoc
per feature (P5.2.1/P5.2.2/P5.2.3) when `src/mcp` is finally built.

Without a single shared surface definition, two risks emerge: (1) the read channel (Resources) could
drift into accepting writes, silently violating the least-privilege boundary that REQ-INT-01 and
REQ-SEC-05 require between reading project state and mutating it; (2) the MCP Tools surface could
diverge from the CLI's state-mutating command set, breaking the CLI/MCP parity mandated by REQ-SYS-05
(every CLI state-mutating operation reachable via MCP and vice versa). This spec fixes the URI scheme,
the refusal contract for Resources, the Prompt embedding contract, and the Tool-to-CLI-verb mapping so
that whichever agent implements `src/mcp` produces a server compatible with this contract, not a
divergent reinterpretation.

## Specification

### 1. Transport & channels

The MCP server exposes exactly three channel types, matching the MCP protocol's own primitives —
**Resources**, **Prompts**, **Tools** — plus no additional custom channel. Read access and mutation
access are strictly partitioned by channel: Resources and Prompts are read-only; only Tools mutate
state (REQ-SEC-05).

```
MCP server surface
├── Resources   (read-only)   — wingfoil://dna, wingfoil://memory/*, wingfoil://workflows
├── Prompts     (read-only)   — one per role, e.g. "developer-session", "reviewer-session"
└── Tools       (mutating)    — memory.* and workflow.* actions, 1:1 with CLI state-mutating verbs
```

### 2. Resources (REQ-INT-01, REQ-SEC-05)

#### 2.1 URI scheme

```
wingfoil://dna
wingfoil://dna/{section}                      # e.g. wingfoil://dna/team, wingfoil://dna/paths
wingfoil://memory/{type}                      # list of elements of that type
wingfoil://memory/{type}/{id}                 # a single Memory document (content + frontmatter)
wingfoil://workflows
wingfoil://workflows/{name}                   # a single workflow definition (main or sub)
```

- `{type}` is any type key declared in `memory.yaml` `types:` (`release-line, release, task, adr,
  decision-log, tech-spec, bug`).
- `{id}` is the element's `id` frontmatter value (e.g. `task-042-foo`), not its filesystem path —
  the server resolves `id → path` via each type's `path` pattern in `memory.yaml`.
- Listing a collection (`wingfoil://memory/{type}` with no `{id}`) returns each element's frontmatter
  only (id, title, status, tags) — not full body content — to keep listing calls cheap; fetching
  `wingfoil://memory/{type}/{id}` returns full content + metadata.

#### 2.2 Read contract

A `resources/read` request against any resolvable URI returns:

```json
{
  "uri": "wingfoil://memory/task/task-042-foo",
  "mimeType": "text/markdown",
  "text": "<full file content, frontmatter + body>",
  "metadata": {
    "id": "task-042-foo",
    "type": "task",
    "status": "in-progress",
    "title": "..."
  }
}
```

An unresolvable URI (unknown type, unknown id, malformed scheme) returns a standard MCP "resource not
found" error — this is a read-path error, distinct from the write-refusal below.

#### 2.3 Write refusal (fit criterion, verbatim)

The Resources channel implements **no** `resources/write` capability. Per REQ-INT-01 / REQ-SEC-05, any
client attempt to write through the Resources channel — whatever transport-level shape that attempt
takes (an unsupported `resources/write` call, or a `resources/read` request carrying a write
intent/payload) — MUST be refused with the exact message:

```
resources are read-only
```

The refusal persists nothing: the underlying Memory/DNA/Workflow files are byte-for-byte unchanged
after a refused attempt (asserted by the channel-enumeration test in REQ-SEC-05's fit criterion — the
only agent write path that successfully mutates state is a Tool call).

### 3. Prompts (REQ-INT-02)

#### 3.1 Naming & enumeration

One Prompt is registered per role declared in `dna.yaml` `team.roles` / the DNA role set (`developer,
reviewer, qa, architect, product-owner, tech-lead, facilitator, approver`), named `{role}-session`,
e.g. `developer-session`, `reviewer-session`. `prompts/list` returns this fixed set derived from DNA at
server start — it is not hand-maintained.

#### 3.2 Embedding contract

Invoking `prompts/get` for `{role}-session` returns a prompt whose message content embeds **100% of
that role's currently assigned directives** (per `roles.yaml`, resolved at session-start time — not
cached from server boot), each as a distinct, clearly delimited block:

```
prompts/get("developer-session") →
  messages: [
    {
      role: "system",
      content:
        "# Role: developer\n\n"
      + "## Directive: code-quality\n<full directive body>\n\n"
      + "## Directive: testing\n<full directive body>\n\n"
      + "## Directive: determinism\n<full directive body>\n\n"
      + "## Directive: doc-versioning\n<full directive body>\n\n"   # global, all roles
      + "## Directive: documentation\n<full directive body>\n\n"    # global, all roles
      + "## Directive: security-secrets\n<full directive body>\n\n" # global, all roles
    }
  ]
```

Directive resolution order for a role R: `roles.yaml[R].directives` ∪ the `global (all roles)` binding
defined in `roles.yaml` (this project's own dogfooded config, generalized per-project). A directive assigned to R
after server start but before the next `prompts/get("{R}-session")` call MUST appear in that next
call's output — Prompts are resolved per-request, not baked in at server boot (fit criterion: "a newly
assigned directive appears on the next session start").

#### 3.3 No mutation

Prompts are, like Resources, read-only: invoking a Prompt returns instructional text; it has no side
effect on Memory/DNA/Workflow state.

### 4. Tools (REQ-INT-03, REQ-SYS-05)

#### 4.1 Naming convention

Tool names mirror the CLI verb they wrap, using `.` in place of the CLI's space-separated subcommand
form, so the mapping is mechanical and auditable:

```
CLI command                    → MCP Tool name
wingfoil memory add             → memory.add
wingfoil memory submit          → memory.submit
wingfoil memory approve         → memory.approve
wingfoil memory reject          → memory.reject
wingfoil memory deprecate       → memory.deprecate
wingfoil workflow start         → workflow.start
wingfoil workflow end           → workflow.end
wingfoil workflow next          → workflow.next        (advances/reads active step)
```

Read-only CLI query commands (`memory search`, `memory history`, `dna show`, `paths`, `workflow
status/list/show`) are **not** duplicated as Tools — they are already served by the Resources channel
(§2) or are non-mutating enough to be exposed as Resources in a future revision; this spec scopes Tools
to the **state-mutating** surface only, per REQ-INT-03's own scope ("Tools for agents to submit
deliverables and update workflow state").

#### 4.2 Parity requirement (REQ-SYS-05)

Every CLI command that mutates state MUST have a corresponding Tool, and vice versa — no Tool exists
without a CLI equivalent, no state-mutating CLI verb exists without a Tool equivalent. This is a
closed bijection, not a best-effort overlap:

```
{ CLI state-mutating verbs } ≡ { MCP Tools }
```

Concretely, for the Memory pillar this is exactly the five lifecycle verbs (`add, submit, approve,
reject, deprecate` — features P1.3/P1.6/P1.7/P1.8/P1.9) plus whatever workflow-action verbs `workflow.yaml` steps
invoke (`element.set_state`, `git.*` actions wrapped by `agent.execute`, etc., per P4.10) once those
ship in v1.0.

#### 4.3 Input/output shape

Each Tool's input schema mirrors its CLI's required flags one-to-one (e.g. `memory.approve` requires
`type`, `id`, `reason` — matching REQ-SEC-04's mandatory `--reason`). Each Tool call:

1. Performs the **same validation** as the CLI path (state-machine legality per `memory.yaml`, role
   authority per REQ-SEC-03, mandatory-reason per REQ-SEC-04).
2. On success, produces **exactly one git commit** in the `wf({type}): {verb} {id}` format, authored
   as the invoking agent's configured git identity (REQ-SEC-01/02) — identical commit shape to the CLI
   path, so `memory history` and audit tooling cannot distinguish CLI-originated from MCP-originated
   transitions except by author.
3. On an illegal transition, is **rejected identically to the CLI path** (REQ-INT-03 fit criterion):
   same error message, same exit-equivalent status, no partial write.

**The `[{from} → {to}]` bracket belongs to the approver-gated verbs only** — `approve`, `reject`,
`deprecate` — whose subject must say which edge was taken, because those verbs sit on a gate and the
edge is a decision rather than a derivation. `add` and `submit` subjects stay **plain**
(`wf({type}): submit {id}`, exactly the item-2 format above): their target state is derivable from the
type's state machine in `memory.yaml`, so the bracket would add nothing a reader or `memory history`
cannot already resolve. Ratified by `dl-054-submit-commit-subject-bracket` (option 2), which chose the
form already written here over the hand-made bracketed `submit` subjects that accumulated in this
repository's history; those stay readable — `src/memory/audit.ts` parses both shapes, and its consistency check
skips a plain `add`/`submit` subject — they simply stop being produced. The split applies to the CLI
and MCP paths identically, since item 2 makes their commit shape one and the same.

```json
// memory.approve tool call
{
  "name": "memory.approve",
  "arguments": {
    "type": "task",
    "id": "task-042-foo",
    "reason": "meets acceptance criteria, tests pass"
  }
}
// → success: { "committed": true, "commit": "<sha>", "old_state": "in-review", "new_state": "approved" }
// → illegal transition (the same call on a `task` in `draft`): MCP tool-error, message identical
//   to the CLI's — REQ-STATE-01's pinned string, `dl-032` option (c):
//   "illegal transition draft -> backlog for type 'task'"
//   `<to>` is `approve`'s canonical edge on the `task` machine (`pending -> backlog`), not the next
//   state in `sequence`, per `dl-053-illegal-transition-target-for-verbless-edges`; the engine's
//   explanation ("not a `gates` state — `approve` is only legal from a gate") rides as the detail.
```

## Consequences

- Any future task implementing `src/mcp` (v0.1 read-only skeleton per `06_features.md` P5.2.1, full
  endpoints in v0.4 per P5.2.2/P5.2.3) must conform to the URI scheme (§2.1), the exact refusal string
  `"resources are read-only"` (§2.3), the per-request Prompt embedding contract (§3.2), and the Tool
  naming/parity rule (§4.1–4.2) defined here — deviating requires revising this spec first.
- The v0.1 "read-only skeleton" milestone (`06_features.md` P5.2.1 notes) is scoped to implementing
  §2 only; §3 and §4 land with v0.2 (P5.2.2) and v0.4 (P5.2.3) respectively — this spec covers all
  three because the contract is a single coherent surface even though delivery is staged.
- If a new Memory element type or a new workflow-action verb is introduced later, its Resources URI
  and, if mutating, its Tool follow the same naming rules automatically — no separate spec revision is
  needed unless the naming *rule itself* changes.
- If REQ-SYS-05's parity requirement is ever relaxed (e.g. some CLI verb becomes CLI-only by design),
  this spec must be revised and the exception recorded explicitly in §4.2, since parity is currently
  stated as an unconditional bijection.

## Process Notes

Authored proactively during `initial-design` for rl-v1, ahead of any `src/mcp` implementation task,
grounded entirely in `docs/02_requirements/03_sard/04_integrations.md` (REQ-INT-01/02/03),
`docs/02_requirements/03_sard/05_security-compliance.md` (REQ-SEC-05), and
`docs/01_vision/06_features.md` (P5.2.1/P5.2.2/P5.2.3, plus the release-staging notes for v0.1/v0.2/v0.4).
No prior-art source material was identified or used; this is authored fresh from the ground-truth specs.

**Revision (2026-09-17) — §4.3 states the `[{from} → {to}]` split explicitly, per
`dl-054-submit-commit-subject-bracket`.** §4.3 item 2 pinned the subject only as
`wf({type}): {verb} {id}`, generically; it never said which verbs carry the state bracket, so
`task-045-memory-submit` had to re-derive that from `src/memory/audit.ts`'s parsing convention and
CLAUDE.md §5.1. `dl-054` (`ready`, approved `194ff91`) ratified option 2 — the bracket belongs to the
approver-gated verbs (`approve`, `reject`, `deprecate`), `add` and `submit` stay plain — so the next
verb does not have to rediscover it. The decision changes nothing already written or built: item 2's
format is unchanged, `task-045`'s shipped subject builder already conforms, and no commit message was
rewritten. Edited in place without a supersede or a state change, per the `spec-001` precedent
`dl-041` cites.

**Revision (2026-09-21) — §4.3's illegal-transition example carries the ratified message, per
`dl-053-illegal-transition-target-for-verbless-edges` (and `dl-032`, `bug-032`).** The example ended
with `illegal transition: task cannot go from draft to approved`, a pre-`dl-032` wording that
`dl-032`'s implementation (`2cd936f`) never reached — the one MCP-side rendering of the refusal
contradicted REQ-STATE-01, BDD `P1.6` sc.2 and `P5.2.3` sc.2, while §4.3 item 3 promises the MCP path
is "rejected identically to the CLI path". It now shows the string the shipped engine emits for that
example's own call (`approve` on a `task` in `draft`):
`illegal transition draft -> backlog for type 'task'`, with `<to>` computed as `approve`'s canonical
edge by `contractTarget` (`src/memory/state-machine.ts`) under `dl-053` option 1 — verified by running
`resolveTypeTransition` against `docs/self/.wingfoil/memory.yaml`, not transcribed. The spec's contract
is unchanged: only an illustrative comment moved, and no Tool is registered on the running server yet.
Edited in place without a supersede or a state change, per the `spec-001` precedent `dl-041` cites; the
tech-spec template carries no `version:` field, so this dated note is the record (`dl-047`).
