---
id: "task-047-memory-reject"
type: task
title: "Implement `wingfoil memory reject`"
status: done
release: "v0.2"
priority: "Critical"
tags: ["v0.2", "p1"]
ref: "P1.8"
bug: ["bug-041-frontmatter-edit-yaml-edge-cases"]
depends_on: ["task-041-mandatory-reason-on-verbs"]
tmpl_version: 260703
---

## Description

As Morgan, deliver feature **P1.8** (US-4-11): reject a pending document with feedback; frontmatter returns to `draft` and the commit records rejecter identity, timestamp, and reason.

## Acceptance Criteria

See `docs/02_requirements/02_bdd/features/p1-memory/P1.8-memory-reject.feature`.

Key scenario: `wingfoil memory reject task-101 --reason 'tests missing'` → `status: draft`; commit records reason; exit 0.

## Implementation Notes

Depends on REQ-SEC-04 mandatory reason (`task-041`). Also sets `rejection_reason` frontmatter per the reject convention.

## Execution Notes

<!-- Running log filled in per dev-loop phase (design / red / green / refactor / review). Not written
     after the fact. Raw material for the release Execution Notes / retrospective. -->

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer, for red/green/refactor); doc-versioning, documentation, security-secrets
(global).

#### read_related (`dl-015`, HARD gate) and governance acknowledgements

- **`task-041-mandatory-reason-on-verbs` (`depends_on`) — read, `done`.** Consequences taken on:
  (1) `requireReason(options)` (`src/core/require-reason.ts`) reads `options?.reason` off task-020's
  value-bearing `ParamsContext.options` seam and throws `UsageError('missing required argument:
  --reason')` → exit `2` via `exitCodeForThrow`. `memory reject` calls it; it is not forked or
  re-implemented. (2) task-041 deliberately scoped the helper to the two approval gates
  (`approve`/`reject`) and left `deprecate` to read `options?.reason` directly — this task is one of
  the two intended consumers, so nothing about that scope needs revisiting here. (3) `required: true`
  on a registry option is **declarative metadata only** (`src/core/registry.ts:23-31`,
  `src/cli/program.ts:137-139` registers every declared option the same way) — Commander does not
  enforce it, so the operation must, which is exactly what `requireReason` is for.
- **`task-045-memory-submit` — read, `done`, both passes.** Every helper it built is consumed, none
  forked: `prepareMemoryTransition` / `commitMemoryTransition` (`src/core/memory-transition.ts`, with
  the `verifyFrontmatterEdit` re-parse post-condition), `formatMemoryCommitMessage`
  (`src/memory/commit-message.ts`, which already carries the optional `transition` bracket and the
  `approver`/`reason` body lines this verb needs), `setFrontmatterField` / `removeFrontmatterField`
  (`src/memory/frontmatter-edit.ts`), `REJECTION_REASON_FIELD`, `resolveTypeTransition` /
  `contractTarget` (`src/memory/state-machine.ts`). Its second-pass lesson is taken literally: the
  editor is byte-level and can be wrong in a shape nobody thought of, so the post-condition is the
  real guard — and G1 below is the case where that guard does **not** fire.
- **`dl-045-absorbed-bug-back-reference` (`ready`)** — `bug: ["bug-041-frontmatter-edit-yaml-edge-cases"]`
  is recorded on this task before `start`, so no retroactive reconstruction: `planned → in-progress`
  synced at `start` (`8fa272a`), `in-progress → in-review` at review. Handed to this task explicitly
  by the orchestrator, since `read_related` does not cover decision-logs.
- **`dl-054-submit-commit-subject-bracket` (`ready`, ratified today)** — the ratified split is
  "`[from → to]` belongs to the approver-gated verbs (`approve`, `reject`, `deprecate`); `add`/`submit`
  stay plain". `memory reject` is approver-gated, so its subject is
  `wf({type}): reject {id} [{from} → {to}]` plus the mandatory `Approver:`/`Reason:` body
  (CLAUDE.md §5.1, P1.8, REQ-SEC-04). This is also the shape `src/memory/audit.ts` already reads back:
  `BRACKET_RE` (`:282`) and `parseApprovalMetadata` (`:162`) both exist and are exercised by
  `memory history` (P1.10), so reject is the first verb whose commits `verifyTransitionConsistency`
  can cross-check instead of skipping.
- **`dl-053-illegal-transition-target-for-verbless-edges` (`ready`, ratified today)** — the `<to>`
  rule is the canonical edge with a *verb-shaped* self-loop fallback. **`task-046` owns the
  `contractTarget` correction and is editing that same function in parallel; this task consumes
  `resolveTypeTransition` and changes nothing in `src/memory/state-machine.ts`.** The consequence for
  testing is recorded under "Deliberate non-assertion" below.
- **`dl-032-illegal-transition-message-contract` (`ready`)** — option (c), exit `1`: the message is
  the pinned `illegal transition <from> -> <to> for type '<type>'`, the engine's explanation rides as
  the issue's `detail`. Reject inherits this for free through `prepareMemoryTransition`.
- **`dl-027-req-sec-04-deprecate-reason-scope` (`ready`)** — option (a) is already applied to the
  SARD: REQ-SEC-04's Description now reads "`approve` and `reject` require a `--reason`"
  (`grep -n 'REQ-SEC-04' -A4 docs/02_requirements/03_sard/05_security-compliance.md`), so `reject`
  is unambiguously in scope for the mandatory reason and there is no conflict left to resolve here.
- **`bug-041-frontmatter-edit-yaml-edge-cases` (absorbed) — read in full.** All three shapes
  reproduced against this branch's base (`194ff91`) before any fix, in a scratch Jest suite
  (`test/memory/zz-scratch.test.ts`, deleted after the run):

  | Case | Input | Output at `194ff91` |
  |---|---|---|
  | G1 | `setFrontmatterField('---\nid: x\nstatus: draft\nrejection_reason:   # set by memory.reject\n---\n', 'rejection_reason', 'needs tests')` | `rejection_reason: "needs tests"# set by memory.reject`, and `verifyFrontmatterEdit(...)` → `[]` — **the post-condition does not fire** |
  | G2 | `removeFrontmatterField('---\nid: x\nrejection_reason:\n- a\n# note\n- b\nstatus: draft\n---\n', 'rejection_reason')` | `---\nid: x\n# note\n- b\nstatus: draft\n---\n` — invalid YAML |
  | G3 | `setFrontmatterField('---\nid: x\nnotes: |+\n  a\n\n---\n', 'status', 'pending')` | `notes` parses as `"a\n"` before and `"a\n\n"` after; post-condition refuses with `field 'notes' changed although this operation does not own it` |

  G1 is the one this verb can hit: `memory reject` is the only writer of `rejection_reason`
  (spec-010 field-write ownership), and a template or hand edit declaring `rejection_reason:` with an
  empty value and an inline comment is exactly the shape above. G2/G3 are not reachable through this
  verb, but they are in this task's Acceptance Criteria by approver decision and they live in the one
  function reject depends on.

#### verify_specs

No new `tech-spec` needed — every semantic this verb needs is already pinned by an `approved` spec.
All 15 specs are `approved`, counted from frontmatter only (not from example blocks in spec bodies):
`for f in docs/self/docs/04_memory/design/specs/*.md; do awk 'NR>1 && /^---$/{exit} /^status:/{print $NF}' "$f"; done | sort | uniq -c`
→ `15 approved`.

- `spec-001-memory-yaml-schema` — `reject`'s target is `gates.{state}.reject`, taken **verbatim**, and
  need not be a `sequence` member. On this repository's machines: `pending → draft` (default, `task`,
  `adr`, `tech-spec`), `in-discussion → draft` (`decision-log`), `in-review → in-progress` (`task`),
  `open → closed` / `in-review → in-progress` / `resolved → in-progress` (`bug`). The spec also records
  that the rejection reason "lives in the `wf(...): reject ...` git commit body (approver identity +
  reason, per P1.7)".
- `spec-004-mcp-surface-contract` §4.1/§4.3 — Tool name `memory.reject`; one commit, same validation
  on both channels (state-machine legality, **role authority per REQ-SEC-03**, mandatory reason per
  REQ-SEC-04).
- `spec-006-core-domain-api` §3 — `memoryReject`, module `memory`, `mutates: true`, CLI
  `wingfoil memory reject`, Tool `memory.reject`. The row carries a `*(planned)*` marker, which §3
  defines as "not yet registered"; registering the operation makes it stale, so the marker is dropped
  from that one row (same edit `task-045` made to the `memorySubmit` row).
- `spec-008-cli-grammar` §2 (`--reason <text>` **required** on `memory reject`, "Recorded verbatim in
  the resulting git commit body"; omitted → exit `2`, `missing required argument: --reason`), §5
  (exit codes), §7 (bare `<id>` positional: `memory reject <id> --reason ...` is named explicitly).
- `spec-009-validation-strategy` §3 — exit by nature of failure.
- `spec-010-memory-frontmatter-schema` — the `rejection_reason` row and the field-write ownership
  table: `memory.reject` changes `status` **and** `rejection_reason` (set to the exact `--reason`
  text) and nothing else; it is "the one exception to 'status only' among the transition verbs"; the
  next `memory.submit` clears it. The commit body stays the authoritative record; the frontmatter copy
  is a convenience mirror.
- REQ-SEC-01 (git identity), REQ-SEC-03 (`user not authorized to approve type '<type>'`),
  REQ-SEC-04 (mandatory reason), REQ-STATE-01 (illegal transition), REQ-SYS-05 (one behaviour behind
  both surfaces), REQ-SYS-07 (determinism).

**Verified, not assumed — `memory.submit` already clears `rejection_reason`.**
`grep -n REJECTION_REASON_FIELD src/memory/submit.ts src/core/index.ts` →
`renderSubmitDocument` removes the key and `memorySubmitFn` passes
`{ [REJECTION_REASON_FIELD]: undefined }` as the post-condition's expectation. A round-trip test
(reject → submit on the same document, `test/core/memory-reject.test.ts`) pins the pair end to end
rather than trusting the read.

#### SPEC CONFLICT — P1.8 sc.2's message vs REQ-STATE-01 / `dl-032` / `dl-053`

`P1.8-memory-reject.feature` sc.2 pins, for `memory reject` on a `draft` document:

> exits with code 1 and message `"only pending documents can be rejected (current: draft)"`

REQ-STATE-01's Fit Criterion, `dl-032` (option c, `ready`) and `dl-053` (`ready`, ratified today) all
pin a different string for the same event: `illegal transition <from> -> <to> for type '<type>'`,
exit `1`. `dl-053` is explicit that this is `reject`'s message — its review table lists
`task | draft | reject → illegal transition draft -> pending for type 'task'` as the behaviour to
correct, and its ratification names `task-047` as an inheritor of the rule. Nothing in either
decision-log mentions P1.8's competing wording, so it was very likely not noticed.

**Resolution taken: the generic contract message, not P1.8 sc.2's string.** Reasons: (1) P1.8's
wording is machine-specific — it hard-codes `pending` as "the state one may reject from", which is
false for `decision-log` (`in-discussion`) and for `bug` (`open`, `in-review`, `resolved`) on this
repository's own `memory.yaml`, so it cannot be implemented generically without lying to the user;
(2) two ratified decision-logs and a SARD Fit Criterion outrank one BDD line, and `dl-053` was
ratified today with `task-047` named in it; (3) emitting a second, verb-specific message for the same
condition would fork the contract `dl-032` exists to unify. The two parts of sc.2 that are *not* in
conflict — exit code `1` and "the state is unchanged" — are asserted literally.
This is filed as a proposed decision-log in the final report (rule 2 of the wave brief); it is **not**
silently absorbed.

#### Deliberate non-assertion — the `<to>` of the illegal-transition message

`dl-053`'s ratified fallback is not yet in the tree (`contractTarget` still walks `sequence` on a
self-loop) and **`task-046` owns that correction**. `reject` from `draft` on `task` is precisely a
self-loop case, so its `<to>` is `pending` today and `in-progress` after task-046 lands. This task
therefore asserts the message **shape** — `/^illegal transition draft -> \S+ for type 'task'$/` — plus
the code and the unchanged state, and does not re-pin `<to>`. Pinning it here would either duplicate
task-046's assertion or break at its merge; the non-self-loop cases this task does exercise
(`in-review`, `approved`) are stable under both rules and are pinned exactly.

#### Design

| Piece | Where | Notes |
|---|---|---|
| `renderRejectDocument(content, target, reason)` | `src/memory/reject.ts` (new) | `setFrontmatterField(status)` then `setFrontmatterField(rejection_reason)`; the pure counterpart of `renderSubmitDocument` |
| bug-041 G1/G2/G3 fixes | `src/memory/frontmatter-edit.ts` | G1: a re-attached tail starting with `#` gets a separating space. G2: inside a nested (empty-header) value a column-0 comment continues the block, exactly as an indented one already does — `lastContent` still only advances on real content, so a *trailing* comment stays with the parent mapping. G3: an absent key is inserted after the last **non-blank** frontmatter line |
| `memoryRejectFn` + registry entry | `src/core/index.ts` (one contiguous block next to `memorySubmitFn`) | `options: [{ name: 'reason', required: true }]`, `mutates: true` |

Order inside `memoryRejectFn`, every refusal before the single write:

1. `requireGitIdentity(root)` — REQ-SEC-01, exit `1`.
2. `<id>` absent/blank → `UsageError('missing required argument: memory reject <id>')`, exit `2`
   (same wording shape as `memory submit`/`memory history`).
3. `requireReason(params.options)` — REQ-SEC-04 / P1.8 sc.3, exit `2` (task-041's helper).
4. Load `memory.yaml` (`loadOrError`).
5. `prepareMemoryTransition(root, memoryYaml, id, 'reject')` — not found / unknown type / no machine /
   invalid state / illegal transition, each exit `1`.
6. Load `dna.yaml` + `requireApprovalAuthority(root, dna, type)` — REQ-SEC-03, exit `1`.
7. Render (`status` → the gate's reject target, `rejection_reason` → the reason verbatim) and commit:
   one commit scoped to the one file, subject + body per dl-054/CLAUDE.md §5.1, with
   `commitMemoryTransition`'s post-condition asserting `status` **and** `rejection_reason` and that no
   other field moved.

**Why the authority check runs after `prepareMemoryTransition`, not before it.** REQ-SEC-03's
fit-criterion message names the element **type** (`user not authorized to approve type 'task'`), and
the type is a fact of the document, readable only once the document has been located. Locating it is
what `prepareMemoryTransition` does, and nothing is written anywhere in steps 1–6, so "the state is
unchanged" holds for every refusal regardless of order. The visible consequence — an illegal
transition is reported before a missing authority when both apply — is behaviour a reviewer should
confirm is acceptable; there is no confidentiality boundary here (the store is a readable git
working tree).

**`Approver:` identity.** `readGitIdentity(root)` supplies name and email — the same identity
`requireApprovalAuthority` checks and the same one git records as the commit author, so the body line
and the commit attribution can never disagree (adr-001/adr-006). The role is `APPROVER_ROLE`
(`'approver'`, `src/core/approval-authority.ts:29`) — the role under which the authority was
exercised, not the member's whole role list. The line renders as
`Approver: {name} <{email}> (approver)`, which is what `APPROVER_LINE_RE` (`src/memory/audit.ts:125`)
parses back.

**Reject reuses REQ-SEC-03's `approve`-worded message verbatim** rather than introducing a
`... to reject type '<type>'` variant: REQ-SEC-03 pins that exact string as its Fit Criterion, reject
*is* an approval-gate decision (CLAUDE.md §5.1: agents may execute `memory.reject` "only when
explicitly instructed by the `approver` role — same restriction as `memory.approve`"), and forking
the message would fork `requireApprovalAuthority` with it. Recorded as a deliberate wording choice.

**Arbitrary reason text.** `toYamlScalar` (task-045) already serializes a non-token string as a JSON
string literal, which is a valid YAML double-quoted scalar; combined with the G1 fix this covers
quotes, colons, `#`, newlines, leading `-`, `yes`/`null`, unicode and leading/trailing whitespace. The
commit body takes the reason **verbatim** (spec-008 §2), so a multi-line reason reaches git intact
even though `audit.ts`'s `REASON_LINE_RE` reads back only its first line — a pre-existing, documented
limitation of the reader (`src/memory/audit.ts:141-145`), not something this verb introduces.

**Strict-parser check (deviation from bug-041's suggested fix, recorded).** bug-041 recommends
parsing the output with a second, stricter YAML parser. eemeli `yaml` 2.9.0 is present in
`node_modules` only as a transitive dependency of `typedoc` (`node -e "const p=require('./package.json');
console.log(Object.keys(p.dependencies), Object.keys(p.devDependencies))"` lists neither), and
promoting it to a declared `devDependency` would rewrite `package-lock.json` while four dev-loops run
in parallel. Instead each of the three cases is pinned **byte-exactly** on the rendered output — a
strictly stronger assertion than "some parser accepts it", since it fixes the one byte (the space
before `#`) the strict parser objects to — and additionally round-tripped through `js-yaml`.

#### T1 — AC classification

| AC | Class | Evidence |
|---|---|---|
| P1.8 sc.1 — `memory reject task-101 --reason 'tests missing'` → `status: draft`, commit records identity/timestamp/reason, exit `0` | **red-first** | no `memoryReject` anywhere: `grep -rn "memoryReject" src/` → no output |
| P1.8 sc.2 — rejecting a non-rejectable document leaves the state unchanged, exit `1` (message per the conflict resolution above) | **red-first** | no operation exists |
| P1.8 sc.3 — no `--reason` → exit `2`, `missing required argument: --reason`, state unchanged | **red-first** | no operation exists |
| spec-010 — `rejection_reason` set to the reason verbatim; `status` to the gate's reject target; nothing else changes; a following `memory.submit` clears it | **red-first** | `grep -rn "rejection_reason" src/ --include=*.ts` → 7 hits, all either the *removal* side (`submit.ts`, `core/index.ts`'s submit doc-comment) or prose anticipating this task (`frontmatter-edit.ts:157`); no code sets the field |
| REQ-SEC-03 — a principal without the `approver` role is refused, `user not authorized to approve type '<type>'`, exit `1`, state unchanged | **red-first** | `requireApprovalAuthority` exists (task-040) but has **no** production call site: `grep -rn "requireApprovalAuthority" src/ \| grep -v approval-authority.ts` → two hits, both doc-comment mentions (`git-identity.ts:58`, `builtin-asset.ts:130`) — no call |
| REQ-SEC-04 — reason mandatory (P1.8 sc.3 above) | **red-first** | `requireReason` exists with no production call site either (`grep -rn "requireReason" src/ \| grep -v require-reason.ts` → none) |
| dl-054 — subject carries `[from → to]`; body carries `Approver:` and `Reason:` | **red-first** | no reject commit is produced by any code |
| Arbitrary reason text is serialized YAML-safely and round-trips | **red-first** | the code path does not exist; `toYamlScalar` itself is already covered by task-045's own test, so the new assertion is on the *verb*, end to end |
| bug-041 G1 — a value written over an empty, commented key keeps a separating space | **red-first** | reproduced at `194ff91` (table above); post-condition returns `[]`, so nothing catches it today |
| bug-041 G2 — removing a key whose value is a column-0 sequence containing a column-0 comment | **red-first** | reproduced at `194ff91`: output is invalid YAML |
| bug-041 G3 — appending an absent key after a trailing keep-chomped block scalar | **red-first** | reproduced at `194ff91`: `notes` changes from `"a\n"` to `"a\n\n"` |
| `spec-006` §3 — drop the stale `*(planned)*` marker on the `memoryReject` row | **characterization (documentation only)** | prose; the row's other columns already describe what is being registered. No behaviour, so no test and no fabricated red |

### red — role: developer

Commit `ec68fd1`. New suites `test/memory/reject.test.ts` and `test/core/memory-reject.test.ts`; a
`bug-041` block appended to `test/memory/frontmatter-edit.test.ts`; a `memory reject` block appended to
`test/cli/program.integration.test.ts` (the real compiled `dist/` driven through real `commander`);
the three registry/parity list literals (`production-registry`, `parity`, `read-only-agent-channel`)
gain `memoryReject`. Observed red, for the stated reasons:

```
npx jest test/memory/frontmatter-edit.test.ts test/memory/reject.test.ts test/core/memory-reject.test.ts \
  test/core/parity.test.ts test/core/production-registry.test.ts test/mcp/read-only-agent-channel.test.ts
Test Suites: 6 failed, 6 total
Tests:       26 failed, 59 passed, 85 total
```

Causes: `Cannot find module '../../src/memory/reject'`; `fixture bug: "memoryReject" operation not
registered on the memory module` (×17); the three bug-041 shapes producing the exact bytes recorded in
the design table; the registry lists lacking `memoryReject`. The CLI block was run separately
(`npx jest test/cli/program.integration.test.ts -t "task-047"` → `4 failed`), since it spawns the
compiled `dist/` and so fails on the missing command rather than on a missing module.

Two of the appended `bug-041` cases passed on first run and are labelled **characterization** in the
T1 table below: the trailing-comment-after-a-sequence case and the append-with-no-trailing-blank case
pin behaviour that was already correct and that the two fixes must not break.

### green — role: developer

Commit `e5155ed`. As designed. Two things worth recording:

- **`enumerateOperations` sorts.** The two `production-registry` list literals are in **alphabetical**
  order, not registry-declaration order, so `memory.memoryReject` sits between `memoryHistory` and
  `memorySearch` even though the `CORE_MODULES` entry is written after `memorySubmit` (kept there so
  the block stays contiguous with `memorySubmitFn`, per the wave brief's rule 7). Found by running the
  test, not by reading the source.
- **A fixture interaction in my own new unit test.** `test/memory/reject.test.ts`'s `DOC` deliberately
  carries a `rejection_reason:` line in the BODY (to prove the editor only matches column-0 keys in
  frontmatter), which made a `/^rejection_reason:/gm` count over the whole document report 2. The count
  is now scoped to `splitFrontmatter(...).frontmatter`. The production behaviour was correct
  throughout — the assertion was.

### refactor — role: developer

Commit `0c26b2d`: `spec-006` §3's `memoryReject` row drops its `*(planned)*` marker (§3 defines the
marker as "not yet registered"; the operation is now registered). No code refactor: the verb is one
linear function that already reuses every existing seam, `renderRejectDocument` is a two-call pure
function, and the three `frontmatter-edit` fixes are each one expression. Skipped an invented refactor
commit rather than manufacturing one.

**Considered and deliberately NOT done:** `memoryRejectFn` and `memorySubmitFn` share a four-step
preamble (identity → `<id>` → load `memory.yaml` → `prepareMemoryTransition`). Extracting it would
edit `memorySubmitFn`, which `task-046` is also touching in the same file in parallel, for no
behavioural gain — and the shared part is already `prepareMemoryTransition` itself. Recorded here
rather than done, so a reviewer can decide it belongs to whichever of task-046/047/048 lands last.

### Merge of `main` (dl-035)

`d29bc17` merges `main` at `652dbfa` (dl-051/053/054 approvals and their edits, `task-057`, `spec-004`
§4.3's new bracket paragraph, `spec-012` §5.1, and the new `dl-061`). No conflict. Re-read after the
merge, and the effect on this task's notes:

- **`spec-004` §4.3 now states the bracket split explicitly** (Revision dated 2026-09-17): "The
  `[{from} → {to}]` bracket belongs to the approver-gated verbs only — `approve`, `reject`,
  `deprecate`". The design above derived exactly this rule from `dl-054`'s approval commit body before
  the spec said it; the spec now confirms it, so the `spec-004` §4.3 citation in `verify_specs` is
  strengthened, not stale. No code change follows.
- **`dl-054`** gained a dated re-count block in its Context; its Decision section still reads
  *"Approver to choose"*, but the element is `ready` and the ratified option is recorded in the
  approval commit `194ff91`'s body (option 2 — the split above). This task follows the approval commit.
- **`dl-061-dev-loop-reject-bug-sync` (`in-discussion`, NEW)** — read. It is about what happens if the
  **review gate rejects this task**: `dev-loop`'s reject fallback moves the task back to `in-progress`
  but drives no `bug.sync_state`, so an absorbed bug would stay at `in-review`. If that happens here,
  `bug-041` needs a hand-made `wf(bug): sync bug-041-… [in-review → in-progress]` back-edge exactly as
  `task-061` emitted for `bug-015`. Noted so the second pass does not have to rediscover it.
- No requirement, BDD feature or spec this task cites changed in the merge:
  `git diff main@{u}...` was not usable offline, so checked directly —
  `git diff ec68fd1 HEAD --stat -- docs/02_requirements` → empty, and the only
  `docs/self/docs/04_memory/design` files touched are the four listed above plus this task's own
  `spec-006` edit.

### review-ready summary

**Gates** (run in the worktree, after the `main` merge and the refactor commit):

| Command | Result |
|---|---|
| `npx jest --maxWorkers=4` | 94/94 suites, 1363/1363 tests passed |
| `npx jest --coverage --maxWorkers=4` | All files **98.37** stmts · **91.03** branches · **98.64** funcs · **99.06** lines. Baseline, same command on `main` `652dbfa` in a scratch worktree: 98.36 · 90.91 · 98.64 · 99.06 — no metric regresses (statements and branches improve) |
| `npx tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `npx tsc --noEmit -p tsconfig.json` | exit 2, only `test/core/directive-create.test.ts(159,19): error TS2339` (bug-026, pre-existing, untouched) |
| `npm run lint` | exit 0 |
| `npm run docs:api` | exit 0 |

New/changed file coverage: `src/memory/reject.ts` 100 on all four metrics; `src/memory/frontmatter-edit.ts`
99.21 stmts · 93.2 branches · 100 funcs · 100 lines (branches up from 92 — every branch the three fixes
add is exercised in both directions); `src/core/memory-transition.ts` unchanged.

**BDD `P1.8-memory-reject.feature` → tests**

| Scenario | Tests |
|---|---|
| sc.1 Reject a pending document with feedback | `test/core/memory-reject.test.ts` "P1.8 sc.1: `--reason` sends a pending document back to draft, records the reason in frontmatter AND in one scoped commit, exit 0"; `test/cli/program.integration.test.ts` "sc.1 `memory reject task-101 --reason 'tests missing'` …" (real compiled CLI) |
| sc.2 Error — rejecting a document that is not pending | `test/core/memory-reject.test.ts` "P1.8 sc.2: rejecting a document that is not in a gate state leaves it unchanged and exits 1"; `program.integration` "sc.2 `memory reject task-200` …". **Both assert exit `1` and "the state is unchanged" literally; the message is the REQ-STATE-01/`dl-032` contract string, NOT sc.2's own wording — see "SPEC CONFLICT" in the design section, and the proposed decision-log in the final report.** |
| sc.3 Error — rejecting without a reason | `test/core/memory-reject.test.ts` "P1.8 sc.3: omitting `--reason` is a usage error (exit 2, REQ-SEC-04) and the state is unchanged" (three shapes of absent option); `program.integration` "sc.3 `memory reject task-101` without `--reason` …" |

Beyond the feature file: `spec-001`'s verbatim gate target on **both** `task` gates
(`pending → draft`, `in-review → in-progress`) and on the `defaults.states` fallback (REQ-STATE-08);
`spec-010`'s two-field write and the reject → submit round-trip restoring the byte-identical document;
`dl-054`'s subject + body, asserted as the exact `git log -1 --format=%B` output; REQ-SEC-01 (isolated
git config), REQ-SEC-03 (a reviewer-only member and an unknown email), REQ-SEC-04; `bug-027`'s scoped
commit; arbitrary-reason serialization (9 shapes as a unit table, plus one end-to-end through the verb
and into the commit body); `bug-041` G1/G2/G3; `memory history` (P1.10) reading the reject back as
`operation: reject`, `pending → draft`, with its reason.

**T1 outcome:** every red-first AC had a genuine failing test first (the run and its causes are in the
`red` section). The two characterization cases are labelled as such and were not forced red; the
`spec-006` marker edit stayed documentation-only with no test, as classified.

**For the approver / reviewer**

1. **P1.8 sc.2's message is not implemented as written** — the single deliberate deviation in this
   task, argued in the design section and filed as a proposed decision-log. Everything else in the
   scenario (exit code, state unchanged) is implemented and asserted.
2. **`<to>` in that message is not pinned by this task** — `dl-053`'s corrected fallback is
   `task-046`'s to ship in `contractTarget`; the assertions here are
   `/^illegal transition draft -> \S+ for type 'task'$/` so they hold before and after that merge.
3. **REQ-SEC-03's refusal message says "approve" on a reject** (`user not authorized to approve type
   'task'`). That is the requirement's verbatim Fit Criterion and `requireApprovalAuthority`'s fixed
   string; reject is an approval-gate decision (CLAUDE.md §5.1), so the message is reused rather than
   forked. Flagged as a wording call, not a defect.
4. **Refusal ordering**: an illegal transition is reported before a missing approval authority, because
   the authority message needs the document's type. Nothing is written on either path.
5. **A multi-line `--reason` reaches git intact but `memory history` truncates it to its first line**
   (`REASON_LINE_RE` in `src/memory/audit.ts`). Pre-existing and documented there, but this verb is the
   first that can produce such a body — filed as a proposed bug in the final report.
