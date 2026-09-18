---
id: "task-046-memory-approve"
type: task
title: "Implement `wingfoil memory approve`"
status: done
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.7"
bug: ["bug-017-agent-authority-guarantee-untested"]
depends_on: ["task-040-role-based-approval-authority", "task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Sam, deliver feature **P1.7** (US-2-10): approve a pending document with a mandatory reason; the commit records approver identity, ISO-8601 timestamp, and reason.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.7-memory-approve.feature`.

Key scenario: `wingfoil memory approve task-101 --reason 'meets standards'` → advances to approved state; commit records approver + timestamp + reason; exit 0.


**`bug-017` — pin the guarantee this task's whole authority model rests on.** Nothing anywhere asserts
that an AI agent holding `approver` via `team.agents[].executes_as` gains **no** approval authority.
`resolveMemberRoles` reads `dna.team.members` only and never mentions `team.agents`, so the property
holds structurally — but nothing would fail if a future edit introduced an agent fallback, which is
exactly what `task-034` shipped on its first pass and was rejected for.

One characterization case in `test/core/approval-authority.test.ts` closes it: a `DnaYaml` fixture with
`team.agents: [{ executes_as: ['approver'], approval_authority: true }]` and **no** member holding
`approver`, asserting `requireApprovalAuthority` refuses. Use `approval_authority: true` deliberately —
`task-034`'s second rejection turned on the fact that **no code anywhere reads that field**; it is a
declarative `dna.yaml` marker enforced by governance (`adr-006`, CLAUDE.md §4/§8). A test that sets it
`true` and still expects refusal pins both halves at once: agents get nothing from `executes_as`, and
nothing from the marker either. `bug-017` needs closing by hand — no `bug:` back-reference.
## Implementation Notes

Depends on REQ-SEC-03 approval authority (`task-040`) + REQ-SEC-04 mandatory reason (`task-041`). Mirrors the manual `wf(...): approve` commit convention this planning phase used.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### start — role: developer

`status: backlog → in-progress` (`5979d15`). The `bug:` list is non-empty
(`bug-017-agent-authority-guarantee-untested`, recorded before start per `dl-045` sub-question 1, so
no retroactive reconstruction), so `bug.sync_state` moved it `planned → in-progress` in its own
commit `05e6722`, touching only the bug file.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer, for red/green/refactor); doc-versioning, documentation, security-secrets
(global).

#### read_related (`dl-015`, HARD gate) — `depends_on` + the decision-logs handed over explicitly

- **`task-040-role-based-approval-authority` (`done`) — read.** Consequences taken on: (1) the gate
  this task wires in is `requireApprovalAuthority(root, dna, typeName)` — a `CoreResult`-returning
  pre-flight shaped exactly like `requireGitIdentity`, returning `VALIDATION` (exit `1`) with the
  verbatim REQ-SEC-03 fit-criterion message `user not authorized to approve type '<type>'`. (2) The
  authority *decision* is type-independent: adr-006 fixes one uniform `approver` role and
  `resolveMemberRoles` reads `dna.team.members[]` keyed on the **live git identity**'s email, so
  `typeName` is interpolated into the refusal message only. That is what dictates the call order
  below (the type has to be read off the document before the message can be built). (3) task-040
  states explicitly that it ships the reusable primitive only and that `memory approve` is this
  task's job — no second implementation is written here. (4) `readGitIdentity(root)` is the single
  git-config read both it and `requireGitIdentity` go through; the `Approver:` line therefore records
  exactly the identity the resulting commit is authored as.
- **`task-041-mandatory-reason-on-verbs` (`done`) — read.** Consequences taken on: (1) `--reason` is
  read through `requireReason(options)`, which **throws** `UsageError` (exit **2**, via
  `exitCodeForThrow`) with the exact string `missing required argument: --reason` — not a
  `CoreResult.error`. (2) It must be called **before any read/write**, so an omitted `--reason` makes
  no change (REQ-SEC-04 fit criterion). (3) It reads the value-bearing `ParamsContext.options` seam,
  so `memoryApprove` declares `options: [{ name: 'reason', required: true }]` (declarative metadata —
  `src/core/registry.ts`: the `CoreFn` does the enforcing, commander does not). (4) Its recorded
  spec-gap note (SARD REQ-SEC-04 lists `deprecate`; spec-008 §2 and P1.9 make it optional there) is
  task-048's to settle, not this task's — `approve` is unambiguously in the mandatory set.
- **`task-045-memory-submit` (`done`) — read (both passes), as instructed.** The five helpers it
  built are **reused, not forked**: `prepareMemoryTransition`/`commitMemoryTransition`
  (`src/core/memory-transition.ts`, including the `verifyFrontmatterEdit` re-parse post-condition and
  `commitPaths --only` from bug-027), `formatMemoryCommitMessage` (`src/memory/commit-message.ts` —
  its `transition`/`approver`/`reason` inputs already exist and are unused until now),
  `setFrontmatterField`/`removeFrontmatterField` (`src/memory/frontmatter-edit.ts`) and
  `contractTarget`/`resolveTypeTransition` (`src/memory/state-machine.ts`). Also taken on: its
  second-pass lesson that a review-ready summary must not assert a file's state without running the
  command that settles it, and that `commitMemoryTransition` already refuses (exit 1, nothing
  written) when the rendered frontmatter fails its post-condition — so `approve` gets spec-010's
  "**only** `status` changes" enforced for free by passing no extra `expected` fields.
- **`dl-053-illegal-transition-target-for-verbless-edges` (`ready`, ratified 2026-09-17) — handed to
  this task explicitly; the fix is MINE, not a docs agent's.** Ratified rule (approval commit
  `f15a434`): `<to>` is the verb's **first legal edge in the type's `sequence`**; when the document is
  already AT that target, the message names the **next legal edge of the same verb**; `(none)` when
  the verb has no legal edge at all. It must never name the next state in `sequence` regardless of
  verb. The shipped `contractTarget` still does exactly that on the self-loop path, so it is
  corrected here, in its own early commit, with tests per verb and type (below).
- **`dl-054-submit-commit-subject-bracket` (`ready`, ratified 2026-09-17) — handed over explicitly.**
  Ratified option 2 (approval commit `194ff91`): the `[from → to]` bracket belongs to the
  approver-gated verbs. So `memory approve` emits
  `wf({type}): approve {ids} [{old} → {new}]` plus the mandatory `Approver:` / `Reason:` body
  (CLAUDE.md §5.1, P1.7, REQ-SEC-04); `add`/`submit` stay plain and task-045's shipped subject is
  **not** changed. This also means `verifyTransitionConsistency` (`src/memory/audit.ts`
  `BRACKET_RE`) starts cross-checking tool-made approve commits, which is the property dl-054 wanted.
- **`dl-027-req-sec-04-deprecate-reason-scope` (`ready`) — read.** Option (a): `--reason` is
  mandatory on the approval gates. `approve` is one, so it is required here; nothing about
  `deprecate` is decided or pre-empted by this task.
- **`dl-032-illegal-transition-message-contract` (`ready`) — read.** Option (c), exit `1`, message
  `illegal transition <from> -> <to> for type '<type>'` with the engine's explanation as `detail`.
  Inherited unchanged through `resolveTypeTransition`; dl-053 only settles what `<to>` is.
- **`dl-045-absorbed-bug-back-reference` (`ready`) — handed over explicitly.** `bug-017` is absorbed
  (no dedicated fix task); its `bug:` entry predates `start`, so the chain is `planned → in-progress`
  (start, `05e6722`) → `in-progress → in-review` (submit), one commit per bug file, inside this
  task's own branch. The Acceptance Criteria paragraph's closing sentence "`bug-017` needs closing by
  hand — no `bug:` back-reference" predates dl-045 and is contradicted by the frontmatter; the
  frontmatter governs (same correction task-045 recorded for bug-016).
- **`bug-017-agent-authority-guarantee-untested` (absorbed, `in-progress`) — read.** Its ask is one
  characterization case in `test/core/approval-authority.test.ts`: a `DnaYaml` fixture carrying
  `team.agents: [{ executes_as: ['approver'], approval_authority: true }]` and **no** member holding
  `approver`, asserting `requireApprovalAuthority` refuses. Verified, not assumed: `grep -rn
  "team.agents\|agents:" test/core/approval-authority.test.ts` → no match, so the guarantee is
  genuinely unpinned today. Note `src/dna/schema.ts`'s `AgentEntry` also requires `name`, so the
  fixture carries one.
- **`bug-030`** (fresh `wingfoil init` leaves a project with no state machine, so every transition
  verb fails) — read, **not** fixed and not duplicated here. Consequence taken on: no test in this
  task builds its fixture with `wingfoil init`; every fixture writes an explicit `memory.yaml` with a
  real machine, the way `test/core/memory-submit.test.ts` already does.
- **`bug-041`** (three frontmatter-edit YAML edge cases) — read; it is absorbed into **task-047**, not
  this task. `memory approve` touches `setFrontmatterField` only through the existing
  `renderApproveDocument` path and adds no new behaviour to `src/memory/frontmatter-edit.ts`, so
  those code paths are left untouched for task-047.

#### verify_specs

No new `tech-spec` is needed — every semantic this task ships is already pinned by an `approved`
spec. Counted from frontmatter only (the anchored form, per task-045's correction):
`for f in docs/self/docs/04_memory/design/specs/*.md; do awk 'NR>1 && /^---$/{exit} /^status:/{print $NF}' $f; done | sort | uniq -c` → `15 approved`.

- `spec-004-mcp-surface-contract` §4.3 — one commit per Tool call, `wf({type}): {verb} {id}` shape,
  identical CLI/MCP validation (state-machine legality, REQ-SEC-03 authority, REQ-SEC-04 reason).
  Its inline JSON example's illegal-transition string (`"illegal transition: task cannot go from
  draft to approved"`) is stale against dl-032 — already filed as `bug-032`, not re-filed here.
- `spec-006-core-domain-api` §3 — `memoryApprove`, module `memory`, `mutates: true`, CLI
  `wingfoil memory approve`, MCP Tool `memory.approve`. The row is marked *(planned)*; the refactor
  step drops that marker for this one row, exactly as task-045 did for `memorySubmit`.
- `spec-008-cli-grammar` §2 (`--reason <text>` **required** on `memory approve`; omitted → exit `2`,
  `error: missing required argument: --reason`), §5 (exit codes), §7 (bare `<id>` positional for a
  command whose noun scopes the type).
- `spec-009-validation-strategy` §3 — exit by nature of the failure: an authority refusal and an
  illegal transition are business-rule failures → `1`; a missing argument is a usage failure → `2`.
- `spec-010-memory-frontmatter-schema` — field-write ownership: **`memory.approve` changes only
  `status`**; the approver identity and reason live in the commit message, never in frontmatter
  (that is `memory.reject`'s `rejection_reason`, task-047's). No required-field check on approve:
  spec-010 puts that on `submit`.
- `spec-001-memory-yaml-schema` — which states `approve` drives (a `gates` key that is not also
  `waiting`), and the `Reason:` trailer on the reject/approve commit body.

#### Design

`memoryApproveFn` (one compact block in `src/core/index.ts` next to `memorySubmitFn`, plus one
registry entry under the `memory` module). Every refusal happens before the single write, so "the
state is unchanged" (P1.7 sc.2/sc.3) holds by construction:

1. `requireGitIdentity(root)` (REQ-SEC-01) → `CoreResult.error`, exit `1`.
2. `<id>` absent/blank → `UsageError` (exit `2`), same wording shape as `memory submit`.
3. `requireReason(options)` (REQ-SEC-04, task-041) → `UsageError` `missing required argument: --reason`
   (exit `2`). **P1.7 sc.2.** Placed before any file read so nothing is touched.
4. `loadMemoryYaml(root)`.
5. `prepareMemoryTransition(root, memoryYaml, id, 'approve')` — not found / unknown type / no machine /
   invalid state / illegal transition, each a `CoreResult.error` (exit `1`); the illegal one carries
   dl-032's pinned message with dl-053's `<to>`.
6. `loadDnaYaml(root)` + `requireApprovalAuthority(root, dna, prepared.type)` (REQ-SEC-03) → exit `1`
   with `user not authorized to approve type '<type>'`. **P1.7 sc.3.**
7. `setFrontmatterField(content, 'status', to)` → `commitMemoryTransition(...)` with the subject+body
   from `formatMemoryCommitMessage({ type, op: 'approve', ids: [id], transition: { from, to },
   approver: { name, email, role: APPROVER_ROLE }, reason })`. **P1.7 sc.1.**

**Ordering decision (5 before 6), recorded deliberately.** REQ-SEC-03's message interpolates the
document's *type*, which is only knowable by locating the document — and `findMemoryDocumentById` is
a full scan of every registered type's content root (`src/memory/query.ts:173`), so checking authority
"first" would mean scanning twice on the happy path. The authority decision itself does not depend on
anything step 5 computes (adr-006: one uniform `approver` role, keyed on git identity), and step 5
writes nothing, so no security property is weakened: the only observable difference is that an
unauthorized caller attempting an *already illegal* transition sees the illegal-transition message
instead of the authority one. Both exit `1`, no BDD scenario pins the combination, and the repository
is a git clone the caller can read anyway, so there is no confidentiality boundary being crossed.
Flagged for the reviewer rather than buried.

**The `Approver:` line** is `Approver: {git user.name} <{git user.email}> ({APPROVER_ROLE})` —
identity from `readGitIdentity(root)` (the same read `requireApprovalAuthority` gated on, so the line
can never name someone other than the principal that was authorized), and the role is the single
`approver` role that authority was granted under, not the member's full role list (deterministic, and
it is the role the approval is *made in*). The ISO-8601 timestamp is supplied by the git commit
itself (P1.2/P1.10), never written into the message — `reconstructMemoryTransitions` reads it from
`git log`.

**dl-053 correction to `contractTarget`** (`src/memory/state-machine.ts`, its own early commit so
task-047 can take it with a small merge): collect the verb's legal targets by walking `sequence` in
order; `<to>` is the first such target that differs from `currentState`; `(none)` when there is none.
The old code took the first legal target and, on a self-loop, fell back to `sequence[index + 1]`
regardless of verb. Observed today, against the REAL `memory.yaml` (`npm run build` then a `node -e`
driver over `dist/memory/state-machine`):

| type | from | verb | shipped (old) | dl-053 (new) |
|---|---|---|---|---|
| `task` | `approved` | `submit` | `pending` | `pending` (unchanged — BDD P1.6 sc.2 / P5.2.3 sc.2) |
| `task` | `backlog` | `approve` | `in-progress` *(engine-only edge)* | `approved` |
| `task` | `draft` | `reject` | `pending` *(a forward move)* | `in-progress` |
| `task` | `approved` | `approve` | `backlog` | `backlog` (unchanged) |
| `adr` | `accepted` | `approve` | `superseded` *(no verb drives it)* | `(none)` |
| `adr` | `draft` | `reject` | `pending` *(a forward move)* | `(none)` |
| `decision-log` | `draft` | `approve` | `ready` | `ready` (unchanged) |
| `decision-log` | `ready` | `approve` | `(none)` | `(none)` (unchanged) |
| `decision-log` | `draft` | `reject` | `in-discussion` *(a forward move)* | `(none)` |
| `bug` | `triaged` | `approve` | `planned` *(engine-only edge)* | `resolved` |
| `bug` | `closed` | `reject` | `(none)` | `in-progress` |
| `release` | `planning` | `submit` | `in-development` *(engine-only edge)* | `(none)` |

**One existing assertion pins the old behaviour and is corrected here** (checked, not assumed —
`grep -rn "illegal transition" test/ src/ docs/02_requirements`): `test/memory/state-machine.test.ts`
"never prints a self-loop: from the canonical target itself, `<to>` is the next state in `sequence`"
asserts `release` `planning` `submit` → `planning -> in-development`. `release` declares no `gates`
and `submit`'s only legal edge is `draft → planning`, so under dl-053 the answer is `(none)`; the
test is rewritten to the ratified rule and renamed. The two BDD-pinned strings
(`P1.6-memory-submit.feature:21`, `P5.2.3-mcp-tools.feature:18`) and every other assertion listed by
that grep are unaffected — verified by the full suite in `refactor`.

**Coordination with task-047 (`memory reject`, running in parallel on the same files).** The dl-053
fix is a single commit touching only `src/memory/state-machine.ts` + `test/memory/state-machine.ts`'s
contract block, landed early. Expected merge contention, to be resolved as a sorted union:
`src/core/index.ts` (one block + one registry entry each), `test/core/parity.test.ts`,
`test/core/production-registry.test.ts`, `test/mcp/read-only-agent-channel.test.ts` (list literals).

Out of scope, recorded: the MCP `memory.approve` Tool is registered mechanically (REQ-SYS-05 parity),
but the MCP surface still populates no positional, so it cannot carry `<id>` — the same limitation
`memory.add`/`memory.submit` have; P5.2.3 is `minor-v0.4` scope.

#### T1 — AC classification

| AC | Class | Evidence |
|---|---|---|
| P1.7 sc.1 — approve a pending document with a reason → post-review approved state, commit records approver + timestamp + reason, exit 0 | **red-first** | no `memoryApprove` anywhere in `src/`: `grep -rn "memoryApprove" src/` → 2 hits, both doc-comment examples in `src/core/registry.ts` (`:40`, `:110`) |
| P1.7 sc.2 — no `--reason` → exit 2, `missing required argument: --reason`, state unchanged | **red-first** | the helper exists but has **zero** production callers: `grep -rn "requireReason" src/ \| grep -v "require-reason.ts"` → no output |
| P1.7 sc.3 — approver lacks authority → exit 1, `user not authorized to approve type 'task'`, state unchanged | **red-first** | same: `grep -rn "requireApprovalAuthority" src/` → only its own definition and three doc-comment mentions, no call site |
| dl-054 — subject carries `[from → to]`; body carries `Approver:` + `Reason:`; readable back by `memory history` / `verifyTransitionConsistency` | **red-first** | no approve commit is produced by any code path today (same evidence as sc.1) |
| spec-010 — approve changes **only** `status` | **red-first** | no approve code path exists; the post-condition that enforces it (`commitMemoryTransition`) has no approve caller |
| dl-053 — `<to>` is the verb's own next legal edge, never the next `sequence` state | **red-first** | measured above: `task`/`backlog`/`approve` prints `in-progress` today, and `test/memory/state-machine.test.ts` actively asserts the old `release`/`planning` fallback |
| bug-017 — an agent holding `approver` via `executes_as` (with `approval_authority: true`) gains no approval authority | **characterization** | the property already holds structurally (`resolveMemberRoles` reads `team.members` only, `src/core/approval-authority.ts:38-43`); the test pins it and **passes on first run**. No red is fabricated and no code is added to force one. |

### red — role: developer

Two red commits, in the order dl-053's fix was asked to land.

**`c8d193d` — dl-053.** Ten cases added to `test/memory/state-machine.test.ts`'s dl-032 contract
block, over the REAL `memory.yaml` machines, covering `approve` and `reject` as well as `submit`
across `task`, `adr`, `decision-log`, `bug` and `release`. Red run:

```
npx jest test/memory/state-machine.test.ts
Tests:       8 failed, 63 passed, 71 total
```

The two that passed on first run are the cases dl-053 leaves unchanged (`task`/`approved`/`approve`
→ `backlog`; `decision-log`/`draft`/`approve` → `ready`). The existing assertion "never prints a
self-loop … the next state in `sequence`" was rewritten in this same commit, as designed.

**`403b895` — P1.7 + bug-017.** New suite `test/core/memory-approve.test.ts` (15 cases) driving the
REAL registered `memory.memoryApprove` `CoreFn`; the three P1.7 scenarios end-to-end through real
`commander` in `test/cli/program.integration.test.ts`; `memoryApprove`/`memory.approve` added to the
three surface lists (`test/core/production-registry.test.ts`, `test/core/parity.test.ts`,
`test/mcp/read-only-agent-channel.test.ts`). Red run:

```
npx jest test/core/memory-approve.test.ts test/core/approval-authority.test.ts \
  test/core/parity.test.ts test/core/production-registry.test.ts \
  test/mcp/read-only-agent-channel.test.ts test/cli/program.integration.test.ts
Test Suites: 5 failed, 1 passed, 6 total
Tests:       23 failed, 71 passed, 94 total
```

Causes: `fixture bug: "memoryApprove" operation not registered on the memory module`; the three lists
lacking the op; and, through the CLI, `error: unknown command 'approve'`. **The one suite that
passes is `approval-authority.test.ts`** — bug-017's case is a characterization (T1) and passes on
first run; no red was fabricated for it and no code was added to force one
(`npx jest test/core/approval-authority.test.ts -t "bug-017"` → `10 skipped, 1 passed, 11 total`).

### green — role: developer

`339420a`. `memoryApproveFn` + its `CORE_MODULES` entry, exactly as designed — one contiguous block
next to `memorySubmitFn`, one registry entry, three added imports. Every task-045 helper is reused
unchanged; none is forked. Two small notes:

- `formatMemoryCommitMessage`'s `transition`/`approver`/`reason` inputs already existed (task-045
  built them for this verb) and were dead until now, so dl-054 cost no formatter change.
- spec-010's "approve changes **only** `status`" needs no explicit check: `commitMemoryTransition`'s
  post-condition already refuses unless `status` is the target **and no other field's parsed value
  changed**. Passing an empty `expected` is therefore the enforcement, not a gap — and the
  byte-for-byte assertion in `memory-approve.test.ts` sc.1 (`toBe(taskDoc(... 'backlog'))`) pins it
  from the outside as well.

### Merge of `main` (dl-035)

Merged `main` at `652dbfa` (past the `451f3e8` the orchestrator named — `task-057`, the
dl-051/053/054 approvals and their doc actions, `spec-012` §5.1, and `dl-061`). No conflict. Re-read
after the merge, and the effect on sentences written above:

- **`spec-004` §4.3 changed** (+22 lines): it now states the `[{from} → {to}]` split *explicitly* —
  the bracket belongs to `approve`/`reject`/`deprecate`, `add`/`submit` stay plain — plus a dated
  Revision note. The design section above cites §4.3 as pinning the subject only generically; that
  was true when written and is **superseded here**: the split is now written down, and the shipped
  verb already conforms to it verbatim. No code change needed.
- **`dl-054` changed** (+9 lines): a dated re-count of the bracketed/plain submit subjects. The
  ratified option is unchanged.
- **`dev-loop-rel-v0.2-plan.md` → v1.1**: §3.6 now spells out that the review-gate `memory.submit`
  subject is plain. This task's own submit commit below follows it.
- **`dl-061-dev-loop-reject-bug-sync` (new, `in-discussion`)**: read. It concerns the review-*reject*
  fallback, which declares no `bug.sync_state`. It does not touch this task's path — the
  `in-progress → in-review` sync at `dev-loop.yaml:90` is a declared call site and is what runs
  below. Recorded only so a later reject on this task knows the gap exists.
- No requirement, BDD feature or other cited spec moved across the merge:
  `git diff 911a5f3^2 HEAD --stat -- docs/02_requirements` → empty (`911a5f3` is the merge commit).

### refactor — role: developer

`9ee7321`: `spec-006` §3's `memoryApprove` row loses its *(planned)* marker (the same edit task-045
made for `memorySubmit`; spec-006 has no `version` field to bump).

**No code refactor was made, and none is claimed.** Two candidates were considered and rejected for
stated reasons rather than skipped silently:

1. *Factoring the shared preamble of `memorySubmitFn`/`memoryApproveFn`* (identity → id → load →
   prepare). Deliberately not done: `src/core/index.ts` is shared by parallel dev-loops —
   `task-047-memory-reject` is editing this exact region right now, and `task-048` follows — so
   extracting a common skeleton today would both pre-empt the shape those two verbs need (reject also
   writes `rejection_reason`; deprecate takes no mandatory reason) and turn a clean list-append merge
   into a rewritten-function merge. The right moment is after all four verbs exist.
2. *Avoiding the second `readGitIdentity(root)` call.* `requireApprovalAuthority` reads the git
   identity internally, and the `Approver:` line needs the same name/email, so the config is read
   twice (four `git config` invocations instead of two). Not optimised: the alternative is to call
   `hasApproverRole` directly and rebuild the REQ-SEC-03 message here, which forks task-040's gate
   and duplicates a fit-criterion string. Cost is two extra `git config` reads on a command that
   already runs `git add` + `git commit`; correctness and single-source-of-truth win.

### review-ready summary

**Gates** (run in the worktree, after the merge and the refactor commit):

| Command | Result |
|---|---|
| `npx jest --maxWorkers=4` | **93/93 suites, 1350/1350 tests passed** |
| `npx jest --coverage --maxWorkers=4` | All files **98.36** stmts · **91.07** branches · **98.64** funcs · **99.06** lines. Baseline, same command on `main` `652dbfa` in a scratch worktree: 98.36 · 90.91 · 98.64 · 99.06 — branches improve, no metric regresses. `src/core` 98.75 · 92.33 · 100 · 99.29 (baseline 98.75 · 91.93 · 100 · 99.29); `src/memory/state-machine.ts` 95.89 · 93.87 · 100 · 97.14 (baseline 95.94 · 92.45 · 100 · 97.18 — the two uncovered lines are the pre-existing exhaustive `default` arm at 240–241, unchanged) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 2, **only** `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing, untouched) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

**BDD P1.7 → tests** (`docs/02_requirements/02_bdd/features/p1-memory/P1.7-memory-approve.feature`)

| Scenario | Tests |
|---|---|
| sc.1 "Approve a pending document with a reason" | `test/core/memory-approve.test.ts` "P1.7 sc.1: approves a pending document with a reason — one commit recording approver, timestamp and reason, exit 0", plus "…the review hand-off gate reaches the literally-named `approved` state (in-review → approved)" and "…a type falling back to `defaults.states` approves pending → approved"; `test/cli/program.integration.test.ts` "sc.1 `memory approve task-101 --reason \"meets standards\"`…" |
| sc.2 "Error - approving without a reason" | `test/core/memory-approve.test.ts` "P1.7 sc.2: omitting `--reason` exits 2 with the exact REQ-SEC-04 message and changes nothing"; `program.integration` "sc.2 `memory approve task-101` without `--reason`…" |
| sc.3 "Error - approver lacks authority for the type" | `test/core/memory-approve.test.ts` "P1.7 sc.3: a caller holding no `approver` role exits 1 with the REQ-SEC-03 message, state unchanged" + "…the refusal names the document's OWN type, not a fixed one"; `program.integration` "sc.3 a caller holding no approver role…" |

`P5.2.3` (the MCP Tool path) is `minor-v0.4` scope: `memory.approve` is registered as a Tool and the
parity/read-only-channel tests assert that, but no MCP-channel behavioural test is claimed here — the
MCP surface still populates no positional, the same limitation `memory.add`/`memory.submit` carry.

**Other contracts pinned by this task's tests**

| Contract | Test |
|---|---|
| dl-054 + CLAUDE.md §5.1 — subject bracket + `Approver:`/`Reason:` body | `memory-approve.test.ts` sc.1 (exact full `%B`), "dl-054: … `verifyTransitionConsistency` finds no drift", "P1.7: the commit body round-trips through `parseApprovalMetadata`" |
| P1.2/P1.10 — the ISO-8601 timestamp comes from git, not the message | `memory-approve.test.ts` sc.1 (`git log -1 --format=%aI` matches the ISO-8601 shape; the message is asserted `toBe` an exact string with no timestamp in it) |
| P1.10 round-trip | "`memory history` reads the approve back as operation `approve`, pending -> backlog" |
| spec-010 — only `status` changes | `memory-approve.test.ts` sc.1 byte-for-byte file assertion |
| dl-032 + dl-053 — the illegal-transition message | `memory-approve.test.ts` "dl-032/dl-053: approving a `draft` task…"; the ten dl-053 cases in `test/memory/state-machine.test.ts` |
| bug-027 — the commit stays scoped | "bug-027: a change someone else staged is NOT swept into the `wf(task): approve` commit" |
| bug-017 (absorbed) | `test/core/approval-authority.test.ts` "bug-017: an agent holding `approver` via `executes_as` — even with `approval_authority: true` — gets NO approval authority" |

**T1 outcome:** every red-first AC had a genuine failing test first (the two red runs above);
bug-017 stayed a characterization and passed on first run.

**For the approver / the reviewer**

1. **Call order — authority (step 6) runs after `prepareMemoryTransition` (step 5).** The rationale is
   in the design section and in `memoryApproveFn`'s TSDoc. The one observable consequence: an
   unauthorized caller attempting an *already illegal* transition sees the illegal-transition message
   instead of the authority one. Both exit `1`, no BDD scenario pins the combination, and nothing is
   written either way — but it is a deliberate choice, not an accident.
2. **The `Approver:` role is always the literal `approver`**, not the member's full role list — it is
   the role the approval is made *in*, and `requireApprovalAuthority` grants authority on no other.
   A member who is also `tech-lead` still gets `(approver)`.
3. **dl-053's rule is now load-bearing for `task-047`.** `contractTarget` is corrected in its own
   early commit (`acbd724`) touching only `src/memory/state-machine.ts`; `task-047` runs in parallel
   on that file and should take that commit rather than re-deriving the rule.
4. **`--reason` is recorded verbatim on one line.** `audit.ts`'s `REASON_LINE_RE` captures only the
   first line of a `Reason:` value (a pre-existing, documented limitation, not introduced here), so a
   multi-paragraph `--reason` would be written in full into the commit but read back truncated by
   `memory history`. Left alone deliberately — changing it is out of this task's scope — and reported
   as a proposed element instead.
