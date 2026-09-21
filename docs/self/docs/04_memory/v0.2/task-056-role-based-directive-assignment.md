---
id: "task-056-role-based-directive-assignment"
type: task
title: "Implement Role-Based Directive Assignment"
status: approved
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

#### design gate — resolved by the approver (2026-09-21)

Option **(a)**: `--force` is **out of task-056's scope** and becomes its own task, scheduled to
**v0.3**, carrying the success-warning channel (`CoreResult` → CLI stderr → MCP Tool result), its
rendering rule for `console`/`json`/`yaml`, and both spec amendments. The `spec-008` §2 mismatch found
above (§2 is *"global flags, accepted by every command"*; `--force` is command-specific) is recorded on
`dl-062` as part of that work, so it is **not** filed separately from here. The dev-loop resumed at
`red` with the design above unchanged.

### red — role: developer (commit `afdd553`)

- `test/directives/roles-edit.test.ts` — a `parseDirectiveIds` describe (10 cases: single id, split,
  trim, first-position de-duplication, empty segments, and four values contributing no ids).
- `test/core/directive-assign.test.ts` — a P3.7 describe against a fixture that **removes** the
  `developer` key from the scaffold's `assignments` (the precondition Sc.1's *"lists exactly those 3"*
  requires — the scaffold already binds `developer` to three directives — and simultaneously dl-029's
  insert path driven with a list): Sc.1, Sc.2 (identical list **and** partially overlapping list),
  Sc.3 (one unknown id, and the first-unknown-in-argument-order case), duplicate ids, whitespace,
  role-before-ids, D3's four blank values, argument-order-not-alphabetical, cross-repo byte identity,
  and the absence of a dangling/no-assignments warning afterwards. The two P3.2 payload `toEqual`s
  move to `directives: [...]` (D4).
- `test/cli/program.integration.test.ts` — four cases on the same verb through the compiled CLI.

**Observed red, verbatim:**

```
$ npx jest test/directives/roles-edit.test.ts test/core/directive-assign.test.ts
  Test Suites: 2 failed, 2 total
  Tests:       24 failed, 60 passed, 84 total
$ npx jest test/cli/program.integration.test.ts -t "P3.7"
  Tests:       4 failed, 59 skipped, 63 total
```

The CLI run also printed today's behaviour on stderr, which is the evidence for three design claims:

```
error: unknown directive: testing,security,documentation   # the comma value looked up verbatim
error: unknown directive: testing,ghost                    # the WRONG id named (Sc.3)
error: unknown directive:                                  # a blank --directive, empty id (D3)
```

Two of the 24 red cases are the **D4 payload change**, not new behaviour: `Sc.1: assigns testing to
developer …` and `AC5: re-assigning …` fail on their `toEqual` alone (`- "directives": ["testing"]` /
`+ "directive": "testing"`), with every other assertion in those tests — exit 0, `commit` undefined,
byte-identical file, unchanged HEAD — passing before the failing line is reached. So AC2's *behaviour*
is characterization, as classified; only the payload's spelling is red-first.

### green — role: developer (commit `a3b7a1c`)

- `src/directives/roles-edit.ts` — `parseDirectiveIds(raw)`, six lines, `js-yaml`-only leaf unchanged
  otherwise.
- `src/core/index.ts` — `directiveAssignFn` parses once and passes the whole list to `checkAssignable`
  and `withAssignedDirectives`; payload key, commit subject and the blank-value guard per D3/D4/D5.
- `src/directives/index.ts` — barrel re-export.

**`src/core/directive-assign.ts` was not modified at all** — task-051's D1 held exactly as predicted:
`checkAssignable` already validated a list before writing anything (P3.7 Sc.3 for free) and
`updateRoleAssignments` already took an arbitrary `update` function.

One **test-fixture** correction in the same pass, found by a red that stayed red for the wrong reason:
the partial-overlap case anchored its expected text on `- determinism`, which also occurs under
`architect:`, so `String.replace` hit the wrong block. Re-anchored on the `developer:` key. The
production output was correct throughout — the diff jest printed showed the edit landing under
`developer:` as intended.

`npx jest --maxWorkers=4` after green → **100 suites / 1555 tests passing** (baseline 100 / 1527).

### refactor — role: developer (commit `0053c31`)

No behaviour change (`git show --stat` = doc comments, two test headers, one spec note).

- `src/core/directive-assign.ts` — *"P3.7 remains an unbuilt prediction, not an observed fact"* was
  true when task-052 wrote it and is not now. Replaced with what P3.7 does, and with the consequence
  that matters to `dl-062`: **P3.7 *is* the second consumer** of that fallback decision (task-052 was
  not, and that correction stands untouched). `updateRoleAssignments`' bullet now states that the
  `#`-gated split it describes is what dl-062 Q1 option 3 ratified away, that `--force` is scheduled to
  v0.3 as its own task, and that `dl-062` — not the paragraph — is the intended contract.
- `src/directives/roles-edit.ts`, `src/directives/index.ts`, and the two test headers — all said P3.3
  and P3.7 were *"designed to reuse"* these primitives; both outcomes are now known.
- `spec-006` §3 — dated **Revision (2026-09-21)** recording that P3.7 registers no operation and needs
  no row, naming the three documents that settle it, so the absent row is not later read as an
  omission. `grep -n "^version" docs/self/docs/04_memory/design/specs/spec-006-core-domain-api.md` →
  no hit, so no doc-version bump applies; edited in place per the `spec-001` precedent the spec's own
  2026-09-17 revision cites.

### mutation runs behind the claims in this section

Every "X is what refuses/produces Y" sentence below was checked by breaking X and re-running, because
task-051's second pass showed four of six such claims can be wrong. Command in each case:
`npx jest test/core/directive-assign.test.ts test/directives/roles-edit.test.ts` (84 cases).

| mutant applied to `src/` | result | which case caught it |
|---|---|---|
| `checkAssignable`: `ids.find(…)` → `ids.slice(0, 1).find(…)` (validate only the first id) | **1 failed / 83 passed** | `Sc.3: one unknown id in the list persists NO partial assignment …` |
| `parseDirectiveIds`: drop the `!ids.includes(id)` guard | **2 failed / 82 passed** | `assigns a duplicated id once, and names it once in the commit subject`; `parseDirectiveIds › de-duplicates, keeping the FIRST occurrence position` |
| `withAssignedDirectives`: `return next` → `return next.sort()` | **7 failed / 77 passed** | incl. `orders the appended ids by argument order, not alphabetically` |
| `directiveAssignFn`: delete the `directives.length === 0` guard | **4 failed / 80 passed** | the four D3 blank-value cases |

So all-or-nothing, the de-duplicated echo, the absence of sorting, and D3 are each pinned by a case
that fails when the corresponding code is removed — not merely accompanied by one.

### AC7 verified, not asserted

AC7 predicted that P3.7 changes no enumeration. Checked both halves:

```
$ git status --short          # after green, before the doc pass
 M src/core/index.ts
 M src/directives/index.ts
 M src/directives/roles-edit.ts
 M test/core/directive-assign.test.ts
$ npx jest test/core/parity.test.ts test/core/production-registry.test.ts \
           test/mcp/read-only-agent-channel.test.ts
  Test Suites: 3 passed, 3 total
  Tests:       24 passed, 24 total
```

None of the three enumeration files is modified and all three are green, so `bug-045`'s "bring the
stale titles current in the same pass" obligation does not arise here — this task touches none of
those literals.

### sync with main (merge `a955eeb`, dl-035 — merge, never rebase)

Two merges this pass. The first (`9bae748`, during the design stop) took `main` to `7b462e3`; this one
takes it to **`91258a7`**. Between the branch point and `91258a7`, `main` gained four commits: three
`docs(self)` edits to `dl-061`, `dl-063` and `dl-064`, and the `wf(bug)` triage approval of
`bug-023`/`030`/`042`/`043`. `git diff --stat 7bac856..91258a7` touches only
`docs/self/docs/04_memory/{design/dls,bugs}/` — **no `src/`, `test/` or spec file**, and no conflict in
either merge. Re-read after merging: `dl-064`'s addendum now says Wave 2 "is closed apart from
`task-056`" and that its B.1 needs its own v0.3 task; it names `directive assign` only as one of nine
`requireGitIdentity` call sites and hands this task nothing. No sentence in these notes went stale.

### review-ready summary

**BDD P3.7 scenario → proving tests** (all passing)

| Scenario | Core test (`test/core/directive-assign.test.ts`) | CLI test (`test/cli/program.integration.test.ts`) |
|---|---|---|
| Bind multiple directives to one role | `Sc.1: assigns testing, code-quality and security to developer in ONE invocation — the role lists exactly those 3` | `P3.7 Sc.1: `--directive testing,security,documentation` binds all three in one commit` |
| Binding is idempotent | `Sc.2: re-assigning the same list exits 0, leaves the file byte-identical and commits nothing` + `Sc.2: a PARTIALLY overlapping list appends only the ids not already bound …` (and, for the single-id form P3.7 Sc.2 literally spells, task-051's `AC5: re-assigning …`, still green) | `re-assigning is idempotent: exit 0 and no new commit` (task-051's, unchanged) |
| Error - the assignment set contains an unknown directive | `Sc.3: one unknown id in the list persists NO partial assignment — exit 1, message names the unknown id` + `Sc.3: names the FIRST unknown id in argument order …` | `P3.7 Sc.3: an unknown id anywhere in the list exits 1, names it, and persists nothing` |

P3.2's three scenarios stay green throughout (`Sc.1`/`Sc.2`/`Sc.3` in the P3.2 describe): a
comma-free `--directive` parses to a one-element list, so the single-id path is unchanged apart from
the payload key.

Supporting cases: `assigns a duplicated id once …`, `trims whitespace around the ids of the list`,
`checks the role before any id of the list (REQ-SYS-08 first)`, the four `D3: --directive %p …`,
`orders the appended ids by argument order, not alphabetically`,
`writes byte-identical roles.yaml for the same list in two independent repositories (REQ-SYS-07)`,
`creates no dangling-binding warning: every assigned id resolves to a directive file`,
`P3.7: the success payload carries `directives` as a list under --format json`,
`P3.7 D3: a blank `--directive` is a usage error (exit 2) …`, plus the 10 `parseDirectiveIds` cases.

**End-to-end on the compiled CLI**, against a scratch git repo seeded with a copy of this
repository's own comment-rich `docs/self/.wingfoil/`:

```
$ grep -c '#' .wingfoil/roles.yaml                                       -> 7
$ node dist/cli.js directive assign --directive security,documentation,code-review --role qa
  {"directives":["security","documentation","code-review"],"role":"qa",
   "assignments":["testing","security","documentation","code-review"]}     exit 0
$ git log -1 --format=%s
  wf(directive): assign security, documentation, code-review to qa
$ git show --stat --format= HEAD     ->  .wingfoil/roles.yaml | 3 +++
$ git diff --numstat HEAD~1 HEAD     ->  3   0   .wingfoil/roles.yaml
$ grep -c '#' .wingfoil/roles.yaml                                       -> 7
$ node dist/cli.js directive assign --directive documentation,security --role qa
  ... exit 0, and `git log --oneline | wc -l` still 2  (seed + the one assign)
$ node dist/cli.js directive assign --directive testing,ghost   --role qa   -> exit 1  error: unknown directive: ghost
$ node dist/cli.js directive assign --directive ghost,phantom   --role qa   -> exit 1  error: unknown directive: ghost
$ node dist/cli.js directive assign --directive testing,security --role wizard -> exit 1  error: unknown role 'wizard' (not defined in dna.yaml)
$ node dist/cli.js directive assign --directive ,              --role qa    -> exit 2  error: missing required argument: --directive
# HEAD unchanged across all four failures; `git status --porcelain` -> 0 paths
```

(The `Warning: … unknown field(s) ignored: scope` lines these runs print on stderr are pre-existing
loader behaviour on this repository's own directive files — `directives list` prints them too —
not introduced here. task-051 recorded the same.)

**Gates — every one re-run after the `a955eeb` merge, in this worktree**

| Gate | Command | Result |
|---|---|---|
| tests | `npx jest --coverage --maxWorkers=4` | **100 suites / 1555 tests passing, 0 failed** |
| coverage | same | All files **98.54 stmts / 92.30 branch / 98.76 funcs / 99.15 lines**. Baseline: `main` at `91258a7` in a detached scratch worktree, same command → 98.54 / **92.27** / **98.75** / 99.15 (100 suites / 1527 tests) ⇒ non-regressing, branch coverage up. `src/directives/roles-edit.ts` and `src/core/directive-assign.ts` both **100/100/100/100**; `src/directives` as a directory is 100 across the board |
| build types | `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| test types | `npx tsc --noEmit -p tsconfig.json` | exit 2 with **only** the pre-existing `bug-026` error `test/core/directive-create.test.ts(159,19): error TS2339` |
| lint.clean | `npm run lint` | exit 0 |
| docs.api | `npm run docs:api` | exit 0 |

**Traceability:** P3.7 (US-4-06) → BDD `p3-directives/P3.7-role-based-assignment.feature` → REQ-SYS-08
(role catalogue, via task-034's `isRoleDefined`/`UnknownRoleError`, reached through `checkAssignable`)
+ REQ-SYS-07 (argument-order determinism) + `spec-006` §3 (`directiveAssign`, no P3.7 row — Revision
2026-09-21) + `spec-008` §1/§4/§5 + `spec-011` (`roles.yaml`, named for P3.2/P3.7 at `:40`, `:105`) +
`dl-041` B (registration) + `dl-029` (role absent from `assignments`) + `dl-037`/`dl-051` (assignment
binds by id and creates no warning) → this task → consumes `task-051`'s `checkAssignable`,
`updateRoleAssignments`, `withAssignedDirectives` and `setRoleAssignmentsInText` **unchanged**.

**Deliberately untouched:** `src/core/directive-assign.ts`'s *code* (doc comments only),
`src/core/context.ts` / `src/core/directives-list.ts` (task-055 — consumed, not modified),
`src/core/builtin-asset.ts`, the three shared enumeration suites, `test/core/directive-create.test.ts`
(`bug-026`), `package-lock.json` (`bug-043`), and the `#`-gated fallback branch (`dl-062`, v0.3).

**The three `[AUTHORING]` choices, stated plainly for the reviewer.** None is pinned by a feature file
or a spec; each is an authored decision, and each is now pinned by a test, which is what makes it
reviewable rather than accidental:

1. **Comma-separated `--directive`** (the whole CLI shape). The feature file names three ids in prose
   and no flag. Chosen because it is the only spelling that needs no change to the shared CLI option
   seam (`Readonly<Record<string, string>>` through `CliCommand.options` → `buildOptionValues` →
   `ParamsContext.options`), and because `memory add --tags "a,b"` is the same shape on the same seam.
   A repeated `--directive` would require widening that record to `string | string[]` across the
   registrar, the Commander wiring and every operation that reads options.
2. **A `--directive` value contributing no ids is a usage error (exit 2)**, not `unknown directive: `
   (exit 1). This **changes a shipped P3.2 behaviour**; the old behaviour was pinned by no test
   (`grep -n "directive: ''" test/` → no hit; task-051's AC9 `it.each` covers only *absent* options)
   and is visible in the red run's stderr above.
3. **`directives: readonly string[]` in the payload** (was `directive: string`) and **`wf(directive):
   assign <id1>, <id2> to <role>`** as the commit subject. The payload change is a visible contract
   change for `--format json` consumers; a shape that varied with the number of ids was rejected as
   worse. The subject extends task-051's D4 and is byte-identical for one id; it follows CLAUDE.md
   §5.1's `{id1}, {id2}` multi-element convention.

**Known weak spots for the reviewer.**

1. Choice 2 above is the only *regression risk* in this task: any script relying on `--directive ""`
   exiting 1 now gets 2. Judged an improvement (a meaningless argument is a usage error), but it is a
   change to a merged verb made inside a task whose feature does not mention it.
2. **`parseDirectiveIds` splits on `,` unconditionally, so a directive id containing a comma becomes
   unassignable — and that is not quite vacuous.** Checked rather than assumed, in both directions:
   `directive create` cannot produce such an id (`DIRECTIVE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`,
   `src/directives/create.ts:26`) and spec-009 §1's shared id class is `[a-z0-9-.]`
   (`ID_CHAR_CLASS`, `src/validation/id.ts:22`) — **but** `DirectiveFrontmatter.id` is an
   unconstrained `z.string()` (`src/directives/schema.ts:36`), so a **hand-authored** directive file
   may carry any id at all, comma included. Such a file loads and lists normally; only
   `directive assign` cannot name it, and the failure it gives is the confusing
   `unknown directive: <first half>`. The underlying gap — `DirectiveFrontmatter.id` not being
   validated against the shared id class — predates this task and affects every directive consumer,
   so it is raised as a proposed element rather than narrowed inside this verb.
3. The P3.7 core fixture removes `developer` from `assignments` by a literal `String.replace` of the
   scaffold's three-line block, and throws `fixture bug: scaffold roles.yaml shape changed` if that
   text ever moves. That is the same technique (and the same fragility) task-051's fixture already
   uses; it fails loudly rather than silently, which is why it was kept.
4. `dl-062`'s ratified `--force` rule is **not** implemented (approver decision above, v0.3). Until it
   ships, a `roles.yaml` the textual editor cannot handle still splits on the presence of a `#`. The
   module doc now says so explicitly and points at `dl-062` rather than at itself.

No secrets committed; every commit stages explicit paths (never `git add -A`/`.`); `node_modules` is
not tracked (it is a symlink to the main clone's, the `bug-043` workaround, and git ignores it).

`status: in-progress → in-review`.
