---
id: "task-056-role-based-directive-assignment"
type: task
title: "Implement Role-Based Directive Assignment"
status: in-progress
release: "v0.2"
priority: "High"
tags: ["v0.2", "p3"]
ref: "P3.7"
bug: ""
depends_on: ["task-034-role-based-binding"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P3.7** (US-4-06): bind multiple directives to one role.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p3-directives/P3.7-role-based-assignment.feature`.

Key scenario: assign `testing`+`code-quality`+`security` to `developer` → role lists exactly those 3.

## Implementation Notes

Depends on REQ-SYS-08 (`task-034`). Complements the `directive assign` verb (P3.2).

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Directives loaded: architecture, determinism, traceability (+ global doc-versioning, documentation,
security-secrets).

**Outcome of this phase: the dev-loop STOPS here, at the design gate, pending an approver decision on
`--force` (see "the `--force` question" below). No `red`/`green`/`refactor` was run. Everything else in
this section is a completed design, ready to execute unchanged once the gate is cleared.**

#### Ground truth checked before classifying

Every claim below is the output of the command quoted with it, run in this worktree at the branch point
`7bac856` (= `main`).

- Baseline suite: `npx jest --maxWorkers=4` → **100 suites / 1527 tests passing, 0 failed** (59.0 s).
- `grep -rn "P3\.7" src/ test/` → **13 hits, all doc comments or a test title**. No production code
  branch exists for P3.7; `src/core/directive-assign.ts:15` states it in so many words — *"P3.7 remains
  an unbuilt prediction, not an observed fact."* The one behavioural hit is
  `test/core/directive-assign.test.ts:192` (`AC5 — idempotence (P3.7 Sc.2 …)`), which pins the
  **single-id** idempotence case only.
- `grep -rn "'--force'\|\"--force\"" src/ --include=*.ts` → **no hit**. No verb on the surface carries a
  `--force` (or any other destructive-opt-in) flag today.
- `grep -rn "warnings" src/core/types.ts src/cli/registrar.ts` → **no hit**. `CoreResult`'s success arm
  is `{ ok: true, value, commit? }` (`src/core/types.ts:30-42`) and `registrar.ts` renders a success as
  `renderSuccess(result.value, format)` on stdout and nothing else. **There is no channel by which a
  successful mutating operation can emit a warning to stderr on either surface** — `directives list`'s
  `warnings` (`src/core/directives-list.ts:96-98`) are a field of a *read* op's payload, and
  `src/core/context.ts:38-42` says the choice to return rather than print them is deliberate and
  surface-agnostic. This is the load-bearing fact behind the `--force` scope call below.
- `wingfoil directive assign` today reads **one** id: `options?.directive` is a `string`
  (`src/core/index.ts:1109`), passed as a one-element list to `checkAssignable(…, [directive])` and
  `withAssignedDirectives(current, [directive])` (`:1118`, `:1122`). A comma-bearing value is therefore
  looked up verbatim as a single id and fails `unknown directive: testing,code-quality,security` — the
  BDD Sc.1 invocation is not merely unimplemented, it is currently an error.

#### CLI shape for P3.7 — the reading, and the evidence for it (dl-041 handed at design)

Two sub-questions: **new verb or extension?**, and **what syntax?**

**(i) Extension of `directive assign`, not a new verb.** Settled by evidence, not preference:

- `docs/01_vision/X_cli-cmds.md:95-98` lists the whole Directives command surface — `directive create`,
  `directive assign`, `directive remove`, `directives list`. There is no fourth verb, and the
  `directive assign` row's own synopsis is `[--directive DIRECTIVE_ID] [--role ROLE]`.
- `spec-008-cli-grammar` §1 enumerates the singular noun's verbs as exactly `create`, `assign`,
  `remove`.
- `spec-006-core-domain-api` §3 (`:158-161`) has exactly three `directive`-module rows —
  `directiveCreate`, `directiveAssign`, `directiveRemove` — plus `directivesList` on `directives`.
  P3.7 has **no row of its own**, so it registers no new `CoreOperation` and adds nothing to the
  CLI/Tool/Resource enumerations (`parity`, `production-registry`, `read-only-agent-channel`).
- `docs/01_vision/06_features.md:67` describes P3.7 as a *relationship* ("one-to-many"), not a command;
  `docs/02_requirements/03_sard/01_architecture.md:91-92` traces P3.2 **and** P3.7 to the same
  REQ-SYS-08 architecture element.

So `dl-041` B's answer carries over unchanged: the work lands on the already-registered
`directive.directiveAssign`, and this task widens that one operation's input.

**(ii) Syntax: a comma-separated `--directive` value.** The feature file leaves the syntax open —
`When I assign "testing", "code-quality", and "security" to role "developer"` names three ids in prose
and no flag at all — so per the brief this is a reading to record, with its reason:

- **In-repo precedent, same seam:** `memory add --tags "tag1,tag2"` is the project's existing
  list-valued option, parsed by `parseTags` (`src/memory/add.ts:38-45`: split on `,`, trim, drop empties).
  `X_cli-cmds.md:25` spells it exactly that way. A comma list needs **zero** change to the shared CLI
  option seam.
- **A repeated `--directive` flag is not reachable without widening shared machinery.** The seam is
  typed `Readonly<Record<string, string>>` end to end — `CoreOption` / `CliCommand.options`
  (`src/cli/registrar.ts:51,67`), `buildOptionValues` (`src/cli/program.ts`, which keeps a value only
  `if (typeof value === 'string')`), and `ParamsContext.options`. Commander registers each declared
  option as `--{name} <value>` with no collector, so `--directive a --directive b` is **last-wins
  today** (consistent with `spec-008` §1's "if a flag is repeated, the last occurrence wins").
  Supporting repetition means widening that record to `string | string[]` across the registrar, the
  Commander wiring and every op that reads `options` — a change to machinery four merged tasks share,
  for a syntax no document asks for.
- **Several bare positionals** would collide with `spec-008` §7's positional convention (a bare
  positional is the element the noun already scopes — `directive remove <name>`) and would make
  `directive assign` the only verb mixing positionals with `--role`.

**Recorded reading:** `wingfoil directive assign --directive testing,code-quality,security --role developer`.
A single id keeps working byte-for-byte as task-051 shipped it (a value with no comma parses to a
one-element list), so P3.2's three scenarios are unaffected.

#### T1 — acceptance-criteria classification (`agent.classify_acs`, dl-014)

AC source: `docs/02_requirements/02_bdd/features/p3-directives/P3.7-role-based-assignment.feature`
(3 scenarios) + the determinism/all-or-nothing constraints handed to this task.

| AC | Criterion | Class | Evidence |
|----|-----------|-------|----------|
| AC1 | Sc.1 — one invocation assigning `testing`, `code-quality`, `security` to `developer` → the role lists exactly those 3; exit 0; ONE commit touching only `.wingfoil/roles.yaml` | **red-first** | the comma value is an error today: `checkAssignable` looks up the literal `testing,code-quality,security` (`src/core/index.ts:1118`) → `unknown directive: …` |
| AC2 | Sc.2 — re-assigning an already-assigned **single** id → appears exactly once, exit 0, no commit | **characterization** | already shipped and pinned: `test/core/directive-assign.test.ts:192` `AC5: re-assigning …` asserts exit 0, `commit` undefined, bytes and HEAD unchanged. This task must not change it |
| AC3 | Sc.2, list form — a **fully** overlapping list is a no-op (no write, no commit); a **partially** overlapping list appends only the ids not already present, in argument order | **red-first** | the verb cannot accept a list at all (AC1 evidence). The underlying set-union `withAssignedDirectives` exists and is tested, but nothing reaches it with >1 id |
| AC4 | Sc.3 — `testing` + `ghost` → `roles.yaml` byte-identical, no commit, exit 1, message exactly `unknown directive: ghost` | **red-first** | today the same invocation yields `unknown directive: testing,ghost` — the wrong id in the message |
| AC5 | Duplicate ids inside one request (`testing,testing`) are assigned once | **red-first** | same as AC1 |
| AC6 | Determinism (REQ-SYS-07): the resulting list is a pure function of (current list, argument order) — existing entries never move, new ids append in argument order, no sort, no dependence on YAML mapping order | **characterization at the unit level** (`withAssignedDirectives` is already pinned by `test/directives/roles-edit.test.ts`) / **red-first at the verb level** | the verb-level path with >1 id does not exist |
| AC7 | Registration is unchanged — still exactly one `directive.directiveAssign` op; the CLI/Tool/Resource enumerations gain nothing | **characterization** | `spec-006` §3 has no P3.7 row (above); the three enumeration suites must stay green untouched |
| AC8 | Usage errors keep `spec-008` §4 wording and exit 2 | **characterization** for the absent-flag cases (`test/core/directive-assign.test.ts:225-236`, AC9 there) / **red-first** for the new blank-value case (D3 below) | that `it.each` covers `{role}`, `{directive}`, `{}` — it does not cover `--directive ""` or `--directive ","` |

No AC requires a new tech-spec (`agent.verify_specs` below), so the design gate would be a pass-through
— **were it not for `--force`**.

#### `agent.read_related` (dl-015, HARD gate) — acknowledged

- **`task-034-role-based-binding`** (the declared `depends_on`; read at
  `docs/self/docs/04_memory/v0.2/task-034-role-based-binding.md`). Its second pass is the operative
  one: per `dl-033` option (b), `src/dna/roles.ts` is canonical for **binding** and is scoped **out of
  approval entirely** — `resolveApprover`/`NoRoleHolderError` were *removed* from it, and its module
  surface is pinned to exactly `['UnknownRoleError','assertRoleDefined','isRoleDefined','resolveRoleHolders']`
  by `test/dna/roles.test.ts`. Consequence for this task: I consume **only** `isRoleDefined` +
  `UnknownRoleError` — and I consume them *transitively*, through `checkAssignable`, which already
  calls them (`src/core/directive-assign.ts:78`). Nothing here asks an authority question, so
  `src/core/approval-authority.ts` is not involved. Also carried over: task-034's REQ-SYS-08 Fit
  Criterion (reassigning a role in DNA changes effective directives with zero directive-file edits)
  holds unchanged, because a multi-id assignment still only writes `assignments.<role>` in `roles.yaml`
  and never touches a directive asset.
- **`task-051-directive-assign`** (read in full, incl. both passes). The reuse surface is exactly as its
  final section promises, and I verified each claim against the source rather than the note:
  - `checkAssignable(dna, files, role, ids)` **already takes a list** and validates the role first, then
    every id in argument order, returning before anything is written
    (`src/core/directive-assign.ts:72-82`). Its own TSDoc cites P3.7's "no partial assignment". So
    all-or-nothing is inherited, not re-derived — my only obligation is to pass the whole list to it in
    one call, which is what the BDD Sc.3 test will pin.
  - `withAssignedDirectives(current, ids)` **already takes a list** and is order-preserving, append-only
    and de-duplicating (`src/directives/roles-edit.ts:27-33`), which is AC3/AC5/AC6 by construction.
  - `setRoleAssignmentsInText(text, role, next)` rewrites the role's list to *exactly* `next` and is
    idempotent (`result === text` short-circuits before the re-parse self-check,
    `roles-edit.ts:160-161`); `updateRoleAssignments` short-circuits earlier still on
    `JSON.stringify(next) === JSON.stringify(current)` (`directive-assign.ts:204`), which is what makes
    a fully-overlapping list a genuine no-op with **no commit**.
  - Its second pass is a warning I am taking literally: four of six "pinned refusal" claims in its first
    pass were overstated, caught by mutation runs. Any claim I make in `red`/`review` about *which*
    guard refuses an input will be backed by a mutation run, not by reading.
  - Its D6 (the `#`-gated fallback) is the behaviour `dl-062` has now overruled — see below.
- **`task-052-directive-remove`** (read in full). `checkUnreferenced` lives in the same module and is
  **not** on my path: it guards an asset being *removed* while a binding names it; I make bindings.
  Two things I do inherit: (1) its correction to `src/core/directive-assign.ts`'s module doc — that doc
  currently says P3.7 "remains an unbuilt prediction", a sentence my `green` must update, and it is the
  same doc range `dl-062` quotes as evidence, so it must stay accurate; (2) its handling of the shared
  enumeration literals and `bug-045` (stale test titles): if I touch an enumeration literal I bring its
  title current in the same pass. **AC7 says I should not have to touch any of them**, and that is a
  checkable prediction, not an assumption — `npx jest test/core/parity.test.ts
  test/core/production-registry.test.ts test/mcp/read-only-agent-channel.test.ts` must stay green with
  those files unmodified.
- **`task-055-auto-load-directives-by-role`** (read: design → review-ready summary → second pass).
  Resolution is *downstream* of assignment and I change none of it, but two of its outputs constrain me:
  - `resolveRoleDirectives` composes a role's in-force set from exactly `assignments[role] ∪ global`
    (`src/core/context.ts`), so a multi-id assignment changes that set by exactly the ids appended —
    no other role, and no `global` entry, can move.
  - Its three warnings (`dl-051` 1-4, `spec-012` §5.1) have a **fixed order**: no-assignments, then
    dangling ids ascending, then shadowed ids ascending. `directive assign` **cannot create a dangling
    binding**, because `checkAssignable` requires every id to exist on disk *before* the write — that is
    a property worth pinning, and it is cheap: assign a list, then assert
    `buildDirectiveListing(root, role).warnings` contains no `has no directive file` entry. Its second
    pass is the reason I will pin *order*, not just membership, for anything order-sensitive I assert.

#### Decision-logs / bugs handed to this task — acknowledged

- **`dl-062-roles-yaml-unwritable-fallback`** — read in full, **and** its approve commit `4cd1876` read
  verbatim (`git show 4cd1876 --format=%B --no-patch`). Ratified: **Q1 option 3**, flag spelled
  **`--force`** (explicitly *not* the `--rewrite` the document's own text proposes — the commit body
  says so and gives the reason: `--force` is the established spelling for "proceed although this is
  destructive" and is meant to generalise to the next verb that needs one). The ratified rule:
  `setRoleAssignmentsInText` returning `undefined` ⇒ **CONFLICT, regardless of whether the file contains
  a `#`** (the `#` test is deleted); the whole-file `js-yaml` rewrite happens **only** with `--force`,
  and **only** with a stderr warning naming what the rewrite normalizes (blank lines, explicit quoting,
  `version: 1.0` → `1`, CRLF → LF); the unflagged whole-file `dump` survives **only** for the
  file-does-not-exist path. Q2 (task-052's `global` refusal wording) is ratified as shipped and does not
  touch this task. **Scope call: see the dedicated section below — this is why the loop stops here.**
- **`dl-041`** (`ready`) — question B: `directiveAssign` registers on the singular `directive` module.
  Already true on `main` and unchanged by this task (AC7). Question A landed as option (b): `spec-006`
  §3 carries an explicit `module` column, which is where I read the "no P3.7 row" evidence above.
- **`dl-029`** (`ready`, option (c) hybrid) — a DNA role absent from `assignments` is legal and still
  receives globals, plus the `no directives assigned to role '<role>'` warning. Assigning a **list** to
  such a role inserts the key with all the ids (task-051's AC7 path, `insertRole` in
  `roles-edit.ts:164-189`, which already loops over `next`) and the dl-029 warning correctly disappears
  afterwards. Not an error, never was.
- **`dl-033`** — binding resolver only; see task-034 above. No approval-authority symbol is reachable
  from this task.
- **`dl-037`** (custom wins) / **`dl-042`** (listing contract) / **`dl-051`** + **`spec-012` §5.1** —
  precedence and the three warnings are *resolution* concerns. Assignment binds by **id** and is
  indifferent to which file wins (`checkAssignable` builds its known-set from
  `files.map(f => f.frontmatter.id)` over built-in **and** custom alike), so a built-in id is assignable
  and no asset file is touched (REQ-SEC-07/dl-030: assignment is not modification). What this task must
  not do is create a warning where there was none — hence the AC6 check above.
- **REQ-SYS-08** — the role catalogue is `dna.yaml` `team.roles`, enforced once, in `checkAssignable`.
  A multi-id request validates the role **once**, before any id, exactly as the single-id request does.
- **REQ-SYS-07** — assignment order is a pure function of the input: ids are consumed in argument order,
  existing entries never move, nothing sorts, and no code path iterates a YAML mapping. `roles.yaml`'s
  mapping order is read only to *locate* the role's key line, never to order the output.
- **Known and filed, NOT mine** (confirmed not duplicated and not fixed here): `bug-042` (`--reason`
  trailer contract), `bug-043` (lockfile), `bug-044` (symlinked `custom/`), `bug-045` (stale test
  titles), `bug-030`, `bug-024`, `bug-026` (the allowed `tsc` error), `dl-064`, `dl-065`, `dl-066`.

#### `agent.verify_specs`

| Question | Authority (status) |
|---|---|
| new operation / registration for P3.7? | **No** — `spec-006` §3 `:158-161` has three `directive` rows and no P3.7 row (approved; `dl-041` A option (b) added the `module` column) |
| verb, noun, Tool name | `spec-006` §3 row `directiveAssign` · module `directive` · `mutates: true` · `wingfoil directive assign` · Tool `directive.assign` (approved, `dl-041` B) |
| command surface has no fourth directive verb | `spec-008` §1 (approved); `X_cli-cmds.md:95-98` |
| list-valued option syntax | **Unspecified** — no spec pins one. Read from the `--tags` precedent (`X_cli-cmds.md:25`, `parseTags`); recorded above and flagged as `[AUTHORING]` |
| exit codes / `error: <reason>` | `spec-008` §4-§6 (approved), `src/core/exit-code.ts` |
| role catalogue = `dna.yaml` `team.roles` | `spec-002` (approved); REQ-SYS-08 |
| `roles.yaml` location and shape | `spec-011` (approved) `:40`, `:105` (P3.2/P3.7 named explicitly) |
| `roles.yaml` **write contract** | **Unspecified in any approved spec** — `dl-062` (`ready`) ratifies it and its Action puts it into `spec-011`; that amendment is unowned today |
| identity pre-flight | REQ-SEC-01 via `requireGitIdentity` |

**No new tech-spec is needed for P3.7 itself.** The design gate would pass through. The stop below is
not a specification gap in P3.7 — it is a scope question on a ratified decision that lands on the same
verb.

#### Design decisions (ready to execute; none implemented yet)

- **D1 — one operation, widened input.** `DirectiveAssignParams` is unchanged (`options` is still
  `Record<string,string>`); `directiveAssignFn` gains one parse step and passes the resulting list to
  the two functions that already accept lists. Net production diff is expected to be ~15 lines in
  `src/core/index.ts` plus one small pure helper. **`src/core/directive-assign.ts` and
  `src/directives/roles-edit.ts` need no behavioural change at all** — which is task-051's D1 paying off
  exactly as predicted, and is the single most useful fact in this design.
- **D2 — the parse helper.** `parseDirectiveIds(raw): string[]` — split on `,`, trim, drop empty
  segments, de-duplicate **preserving first-occurrence order** (AC5). It belongs beside
  `withAssignedDirectives` in `src/directives/roles-edit.ts` (pure, `js-yaml`-only leaf) rather than in
  `src/core`, so the whole set-semantics story stays in one module. De-duplication happens here rather
  than being left to `withAssignedDirectives` so that the *echo* in the result payload and the commit
  subject is already de-duplicated — otherwise `--directive testing,testing` would produce a commit
  subject naming `testing` twice.
- **D3 — a blank `--directive` is a usage error `[AUTHORING]`.** `--directive ""`, `--directive ","`
  and `--directive " , "` all parse to zero ids. Decided: throw `UsageError('missing required argument:
  --directive')` → exit 2, matching `spec-008` §4's wording and `parseTags`'s "contributes no tags ⇒
  treat as absent" precedent. **This changes a shipped behaviour**: today `--directive ""` reaches
  `checkAssignable` and yields exit 1 `unknown directive: ` (empty id in the message). No test pins the
  old behaviour (`grep -n "directive: ''" test/` → no hit; the AC9 `it.each` at
  `test/core/directive-assign.test.ts:225-236` covers only *absent* options), and exit 2 for a
  meaningless argument is the better of the two, but it is a user-visible change to P3.2's verb and is
  flagged here for the reviewer rather than slipped in.
- **D4 — result payload becomes plural `[AUTHORING]`.** `DirectiveAssignResult.directive: string`
  becomes `directives: readonly string[]` (the requested ids, de-duplicated, in argument order);
  `role` and `assignments` are unchanged. Rejected alternative: keep `directive` when exactly one id was
  given — a payload whose *shape* depends on input arity is hostile to `--format json` consumers and to
  REQ-SYS-07's "pure function of the input" spirit. Cost: three `toEqual` assertions
  (`test/core/directive-assign.test.ts:121`, `:204`, plus the CLI integration read) change shape. No
  spec pins this payload (`spec-006` §3's row names the operation, not its result type), so it is
  `[AUTHORING]` and reported.
- **D5 — commit subject `[AUTHORING]`.** `wf(directive): assign <id1>, <id2>, <id3> to <role>` —
  comma-space joined in argument order, which both extends task-051's D4 (`wf(directive): assign <id> to
  <role>`, byte-identical for one id) and matches `CLAUDE.md` §5.1's `{id1}, {id2}` multi-element
  convention. Still exactly **one** commit staging only `.wingfoil/roles.yaml`.
- **D6 — all-or-nothing is inherited, and pinned end-to-end.** One `checkAssignable` call with the whole
  list, before `updateRoleAssignments` is reached. The Sc.3 test asserts three things, not one:
  `roles.yaml` bytes identical, `git rev-parse HEAD` unchanged, and the message naming `ghost` (the
  unknown id) — never the whole list.
- **D7 — no new registration, no enumeration edits** (AC7). Prediction to verify, not assume: the three
  enumeration suites stay green with those files unmodified.
- **Out of scope**: `--force` (below); `roles.yaml`'s `global:` list (no feature asks for editing it);
  assigning one directive to several roles in one invocation (P3.7 is one-to-many the *other* way —
  `06_features.md:201` "One role → multiple directives"); any change to resolution, listing or context.

#### the `--force` question (`dl-062` Q1 option 3) — **scope call: a follow-up, not this task**

Judgement: **implementing `--force` does not belong to task-056**, and per this task's brief the loop
therefore stops at design and reports rather than deferring it unilaterally. The reasoning, in the order
the evidence forced it:

1. **It is not P3.7.** No AC, no BDD scenario and no user story in this task's contract mentions it;
   `P3.7-role-based-assignment.feature` has three scenarios and none is about an unwritable file. It is
   the ratification of a **P3.2** behaviour that happens to live behind the same verb.
2. **The stderr warning the ratification makes mandatory has no seam to travel on.** The approve commit
   is explicit that the warning is load-bearing, not decoration: *"the stderr warning enumerating the
   normalizations is not optional decoration: it is the part that makes the flag honest."* But
   `grep -rn "warnings" src/core/types.ts src/cli/registrar.ts` → **no hit**: a successful `CoreResult`
   carries `value` and `commit` and nothing else, and the registrar writes only `renderSuccess(...)` to
   stdout. `src/core` must not write to stderr itself — `src/core/context.ts:38-42` records that
   returning warnings rather than printing them is a deliberate, surface-agnostic choice, and REQ-SYS-05
   requires the MCP Tool `directive.assign` to behave identically. So `--force` requires a **new
   success-warning channel across `CoreResult` → CLI → MCP**, which in turn needs: a rendering rule for
   `--format json`/`yaml` (`spec-008` §6 fixes the format of `error:` lines only — a warning line's
   format is specified nowhere), an MCP Tool-result counterpart, and a decision about whether every
   other operation inherits the channel. That is a task, with spec consequences, not a clause of this
   one.
3. **Its `spec-008` landing place does not fit as written.** `dl-062`'s Action says the flag gets a
   "`spec-008` §2 entry", but §2 is titled *"Global flags — accepted by every command"*. `--force` is
   command-specific. Either §2 grows a non-global row (changing what §2 means) or a new section is
   needed. Deciding that is a spec edit, and `spec-011`'s write-contract amendment — `dl-062`'s other
   Action — is explicitly entangled with `dl-060`'s and `bug-040`'s corrections to the same passage,
   both currently unowned.
4. **Nothing is lost by separating them.** P3.7 and `--force` are disjoint in code: P3.7 changes what
   the *caller* passes into `updateRoleAssignments` (a longer `ids` list), `--force` changes what
   `updateRoleAssignments` does when `setRoleAssignmentsInText` returns `undefined`. They meet at no
   line. And the "one shared implementation for both verbs" risk the brief warns about **cannot
   arise**: there is only one verb (`directive assign`) and one writer (`updateRoleAssignments`), so
   whoever implements `--force` implements it once by construction. `directive remove` is provably not
   a consumer (`task-052`'s design, ratified into `dl-062`'s own Review addendum (a)).
5. **Meanwhile the ratified rule is not silently ignored.** Until `--force` ships, the `#`-gated
   branch stays exactly as task-051 shipped it — i.e. `main` is knowingly one step behind a `ready`
   decision-log, which is a scheduling fact for the approver, not something this task may quietly
   resolve in either direction. Deleting the `#` test *without* `--force` would be option **2**, which
   the approver considered and did not choose.

**What the approver must decide**, stated so the answer is one line either way:

- **(a)** `--force` is a follow-up task ⇒ task-056 resumes at `red` with the design above, unchanged.
- **(b)** `--force` belongs here ⇒ task-056's scope is widened, and the success-warning channel
  (point 2) plus the `spec-008`/`spec-011` amendments (point 3) come with it — at which point this is
  two features in one dev-loop and the `spec-008` §2-vs-command-specific question needs answering
  first.
