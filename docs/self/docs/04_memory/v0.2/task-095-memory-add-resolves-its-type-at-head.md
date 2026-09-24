---
id: "task-095-memory-add-resolves-its-type-at-head"
type: task
title: "Resolve `memory add`'s type registry, `path` and `template` from the committed repository, so an element cannot be created against a type no commit defines"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "audit-trail"]
ref: "bug-085-memory-add-reads-the-type-registry-from-the-worktree"
bug: ["bug-085-memory-add-reads-the-type-registry-from-the-worktree"]
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target"]
tmpl_version: 260703
---

## Description

`memory add` reads `memory.yaml` from the **working tree** to decide whether the requested type
exists, where its files land and which scaffold to copy. An uncommitted type is therefore enough to
produce a committed element whose type no commit defines — and the element is then **unreachable**:
`memory submit` and `memory deprecate` both answer `document not found`, and `memory search --type`
finds nothing.

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option (B): a read that gates an
operation resolves at `HEAD`. `task-091` moved the four transition verbs; `memory add` was outside
its wording because it consults no state machine, and after that task it is **the only Memory verb
still reading its governing document from the working tree**.

Declared a release blocker at `critical`: strictly worse than `bug-081`, which at least left the
element visible and refusing.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project against current `main` (`bug-075`): an uncommitted
  type, `memory add` at exit 0, `git show HEAD:.wingfoil/memory.yaml` lacking the type, and every
  verb answering `document not found` after the tree is restored. Commands in the notes.
- **AC2** — After the fix the type registry, the type's `path` and its `template` all resolve at
  `HEAD`. **Follow `task-091`'s shape**: remove the parameter so the decision is unreachable from a
  working-tree copy, rather than adding a guard. `loadMemoryYamlAtHead` already exists and is public.
  If one of the three reads cannot be moved that way, say why rather than substituting a guard.
- **AC3** — Refusal exits **`1`** per `spec-005` §1 as ruled on `bug-076`, naming the type and saying
  that it is not committed — the diagnostic shape `task-090` and `task-091` established, where a
  second sentence appears only when the working tree and `HEAD` actually disagree.
- **AC4** — **`init` commits `memory.yaml` in the scaffold commit, so there is no bootstrap window**
  — `task-091` measured this; re-verify rather than inherit it. Then decide fail-closed or fail-open
  for an absent or unreadable committed `memory.yaml` and pin the choice.
- **AC5** — The ordinary flows still pass, each pinned: adding an element of a committed type;
  adding after the type was added **and committed**; and `memory add` still refusing an occupied path
  under `task-092`'s absence guard, which must not regress.
- **AC6** — A test pins the defect and fails against current code.
- **AC7** — **`bug-087` is not in scope** — the id counter reading the working tree is a *different*
  read in the same verb, and `task-092` already removed its destructive face. If your change makes it
  trivially closable, say so; do not widen to reach it.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-091`'s Execution Notes first (`dl-015` read_related): same rule, same shape, same
  diagnostic, and its AC5 sweep is what found this bug.
- `memory add` carries **three** instances of `dl-080`'s class — this read, `bug-087`'s id counter,
  and the write `task-092` guarded. A single pass over `memoryAddFn` may settle more than one; say
  which you touched and which you deliberately left.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->

### start — role: developer

`status: backlog → in-progress` (`bab307d4`). `bug:` names one bug, so `bug.sync_state` ran as its own
commit: `bug-085` `planned → in-progress` (`2a2b8d00`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-095`, branch
`task/task-095-memory-add-resolves-its-type-at-head`, from `main` at `02b77f97` — which contains both
`depends_on` merges (`task-091`, `task-092`), the precondition every AC rests on.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0; `npm run build` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-091-reads-resolve-at-head` (`done`) — Execution Notes read in full.** What I took, and
  therefore did not re-derive:
  1. **The shape.** Its `green` § states both fixes are "in the signature, not next to the call":
     `prepareMemoryTransition(root, id, op)` and `checkAssignable(root, …)` no longer accept a parsed
     document, so "a call that tried would not compile". AC2 asks me to copy that literally, and D1
     below does — with one honest difference recorded there: `memory add` has no helper with a
     parameter to remove, so the equivalent is to move the decision *into* a function that takes
     `root` only.
  2. **The primitives.** `loadMemoryYamlAtHead` / `MEMORY_YAML_PATH` (`src/core/loaders.ts`), built on
     `readPathAtRev(root, 'HEAD', <path>)` (`src/storage/commit.ts`, task-088). D3 of that task made
     `loadMemoryYamlAtHead` public precisely so the next implementer would not re-derive it; AC2 says
     it "already exists and is public", and it does — `grep -n "loadMemoryYamlAtHead" src/core/index.ts`
     → `:92` inside the `export { … } from './loaders'` block.
  3. **One baseline per command, not one per read** (its D1). `memory submit` used to read
     `memory.yaml` twice; the prepared result now carries the committed copy so a single command
     cannot decide two things from two copies. That principle is what settles the *template* read
     below (D2): a command whose registry comes from `HEAD` and whose scaffold comes from the working
     tree would be exactly the split that principle forbids.
  4. **The diagnostic that never decides** (its D5, task-090's `workingTreeWouldGrant`): a second
     sentence appended **only** when the working tree and `HEAD` actually disagree, computed after the
     decision, false/empty on any read failure. Reused verbatim in shape (D4).
  5. **Fail-closed, and why the argument is stronger here than for `dna.yaml`** (its D4, point 1):
     `memory.yaml` has no bootstrap window because `init` commits it. AC4 tells me to re-verify rather
     than inherit that, and I did — measured below, extended to the seven scaffold templates, which
     `task-091` had no reason to measure.
  6. **Its AC5 sweep is this task's subject.** Row **S1** of that table is `bug-085`: "`memory.yaml` →
     `memoryAddFn` (type registry, `path`, `id_pattern`, `template`) … **Yes — filed, not fixed**".
     AC1 below re-derives the transcript from scratch rather than pasting it, and finds a third face
     the sweep did not record (the scaffold).
  7. **The measurement gotcha:** `execFileSync` + `catch` reads back `stderr: ''` for a command that
     exits `0` while printing to fd 2, so CLI-level assertions use `spawnSync`. Reused.
- **`task-092-writes-refuse-a-dirty-target` (`done`) — Execution Notes read in full.** What matters
  to me:
  1. **`memory add`'s guard is *absence*, not cleanliness**, and it is `requireAbsentTarget(root,
     targetPath)` in `memoryAddFn` (its `green` § table). AC5 asks me not to regress it; D5 below
     records where it now sits relative to my change and why the order matters.
  2. **`memory add` resolves its target path twice, deliberately** — the guard must run before
     `writeMemoryEntry`, and `resolveConfinedMemoryPath` is pure. That resolution takes the type's
     `path` pattern, so after D1 it is fed from `HEAD`. Named in D5.
  3. **The root cause it did *not* repair** is `nextSequenceNumber` counting the working tree, raised
     by it and now `bug-087`, `release: v0.3`. AC7 forbids widening to reach it; D6 states exactly
     what my change does and does not do to its ground.
  4. **`pathPorcelainStatus` uses `probeGit`** because `git status --porcelain -- <path>` writes a
     `warning: could not open directory …` to stderr while exiting 0 when an intermediate directory
     of the pathspec is absent. I add no new `git status` call, so this does not bite me; recorded
     because my new refusals sit next to that guard.
- **`bug-085` (`critical`, source bug) — read in full.** Its Summary names three reads ("whether the
  requested type exists, where its files land (`path`) and which scaffold to copy (`template`)") and
  its Notes grade it "strictly worse than `bug-081`". Its "Related but distinct" paragraph scopes
  `bug-087` out and `task-092` in, which is what AC7 restates.
- **`dl-080-which-baseline-each-command-reads` (`ready`) — read in full together with its approve
  commit `333a3c0`.** The ratified sentence: "a read that gates an operation resolves against the
  repository as committed at HEAD, and a write refuses while its target carries modifications the
  command does not own". Nothing below re-argues (A)–(D); the `Reason:` also records that the open
  instances are "to be fixed UNDER this rule rather than one at a time", which is why D2 moves the
  scaffold read as part of the same pass rather than filing it.
- **`bug-087` (`open`, `release: v0.3`) — read in full**, to be sure I leave it alone. Its Notes say
  its severity "is contingent on `task-092` staying landed"; nothing here changes that.

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one.

- **`spec-008-cli-grammar` § 6 "Error format (REQ-INT-08)"** carries `memory add`'s unknown-type
  example verbatim — `error: unknown memory type 'unicorn' (not defined in memory.yaml)` — and
  **§ 5**'s exit-code table gives `1` for "Runtime/domain error". Both hold unchanged: the pinned
  sentence stays the verbatim **first** sentence of the refusal, and every refusal added here is
  exit `1`. Not amended.
- **`docs/02_requirements/02_bdd/features/p1-memory/P1.3-memory-add.feature`**, scenario *Error -
  adding a document of an undefined type*, asserts that exact message at exit 1. Unchanged, and now
  covered by a case in which the type is undefined **at `HEAD`** as well.
- **`spec-001-memory-yaml-schema`** — untouched: no schema field changes, only which copy of
  `memory.yaml` (and of the scaffold it names) `memory add` reads.
- **`spec-005-cli-command-contract` § 1 "Exit-code contract (REQ-INT-04)"** — not amended; `bug-076`
  ruled that a well-formed invocation failing a repository-state precondition is `1`.
- **`dl-080`** is the rule and needs no spec to exist. Its **Action 4** ("write the ruling where an
  implementer meets it") is `task-094`'s, in flight in parallel — not mine, and not re-raised.

`design` gate state: `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied above; `tech-spec.approved` — no spec scaffolded, so the approver gate passes through.

#### AC1 — reproduced first, on a scratch project, against a build of this branch's base

`bug-075`: the verbs cannot be pointed at this repository's own Memory, so every run below is in a
throwaway project under the session scratchpad, against `dist/` built from the branch base
(`npm run build`, exit 0, at `2a2b8d00` = `main` `02b77f97` + the two `start` commits, no `src/` edit).

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum      # exit 0; git status --porcelain -> clean
# uncommitted edit: a `fabricated-type` entry added to types: in .wingfoil/memory.yaml,
# plus an untracked .wingfoil/memory/templates/fabricated.md carrying a marker line
$ git status --porcelain
 M .wingfoil/memory.yaml
?? .wingfoil/memory/templates/fabricated.md
$ node dist/cli.js memory add --type fabricated-type --title 'Probe'
{ "id": "fab-001-probe", "path": "docs/memory/fabricated/fab-001-probe.md" }        exit 0
$ git log -1 --format='%s'                           ->  wf(fabricated-type): add fab-001-probe
$ git show HEAD:.wingfoil/memory.yaml | grep -c fabricated-type                     ->  0
$ git cat-file -e HEAD:.wingfoil/memory/templates/fabricated.md
fatal: path '.wingfoil/memory/templates/fabricated.md' exists on disk, but not in 'HEAD'   # exit 128
$ git show HEAD:docs/memory/fabricated/fab-001-probe.md | tail -1
FABRICATED SCAFFOLD BODY — in no commit.
$ git checkout .wingfoil/memory.yaml && rm .wingfoil/memory/templates/fabricated.md
$ git status --porcelain                              ->  (clean)
$ node dist/cli.js memory submit    fab-001-probe             -> error: document not found: fab-001-probe ; exit 1
$ node dist/cli.js memory deprecate fab-001-probe --reason r  -> error: document not found: fab-001-probe ; exit 1
$ node dist/cli.js memory search --type fabricated-type
{ "query": "", "matches": [], "message": "no documents matched the query" }          exit 0
```

Every clause of `bug-085` holds, and the transcript adds a **third face the bug's Summary implies but
`task-091`'s S1 did not record**: the committed element's body was copied from a scaffold file that
exists in no commit either (`git cat-file -e` → 128, and the marker line is nevertheless inside
`git show HEAD:docs/memory/fabricated/fab-001-probe.md`). So the element is not merely of an
uncommitted *type*; its content is a copy of an uncommitted *file*. That is what makes AC2's third
item ("its `template`") a read of its own and not a restatement of the registry read — see D2.

#### AC4 — what `HEAD` actually carries after `init`, re-measured rather than inherited

```
$ node dist/cli.js init --template scrum && git log --oneline | wc -l      ->  1
$ git show --name-only --format='' HEAD | grep -c .                        ->  27
$ git show HEAD:.wingfoil/memory.yaml | head -1
# Memory element schema (P1.13) — scaffolded by `wingfoil init`.
$ git ls-tree -r --name-only HEAD .wingfoil/memory/templates/
.wingfoil/memory/templates/adr.md          .wingfoil/memory/templates/release-line.md
.wingfoil/memory/templates/bug.md          .wingfoil/memory/templates/release.md
.wingfoil/memory/templates/decision-log.md .wingfoil/memory/templates/task.md
.wingfoil/memory/templates/tech-spec.md
```

`init` commits the whole scaffold in **one** commit, and that commit carries `memory.yaml` **and all
seven `template.file` scaffolds**. `task-091` measured the first half; the second is this task's own
and is what lets D2 be fail-closed on the same grounds as D1. In any project that ran `init`, `HEAD`
carries a valid registry and a readable scaffold for every registered type from the first commit
onwards: there is no bootstrap window on either read.

#### AC2 — the fix

Three reads named by AC2, one decision each.

**D1 — the type registry and the type's `path`: `resolveAddType(root, type)` resolves its own
committed `memory.yaml`.**

Today `memoryAddFn` (`src/core/index.ts`) does `loadOrError(() => loadMemoryYaml(root))` inline and
reads `types[type]`, `path`, `id_pattern` and `template` off the result. **There is no parameter to
remove** — `task-091`'s two fixes each had a helper (`prepareMemoryTransition`, `checkAssignable`)
that *accepted* a parsed document, and this one does not; the working-tree copy arrives through a
call the function makes itself. AC2 anticipates exactly this ("if one of the three reads cannot be
moved that way, say why rather than substituting a guard"), and the answer is not a guard: the
equivalent of removing the parameter is to move the whole decision **behind a function that takes
`root` and a type name and nothing else**. So `resolveAddType(root, type): CoreResult<ResolvedAddType>`
(new `src/core/memory-add-type.ts`) calls `loadMemoryYamlAtHead(root)` itself and returns the
committed `path`, `id_pattern`, `template` and scaffold bytes. Afterwards no call path — present or
future — can reach `memory add`'s type decision with a working-tree registry, because there is no
argument through which one could arrive, and `memoryAddFn` holds no `MemoryYaml` at all. That is the
same *property* `task-091` achieved (unreachable, not guarded), enforced the same way (the type
checker), reached by the one move available on this shape.

The type's `path` rides the same result, so `resolveConfinedMemoryPath(root, pathPattern, { id })` —
`task-092`'s guard target and `writeMemoryEntry`'s destination — is now the committed pattern.

**D2 — the `template`: the scaffold is read at `HEAD` too, by the same function.**

`readDocument(join(root, '.wingfoil', template.file))` reads the scaffold off disk. Moving only the
registry would leave `memory add` deciding *which* scaffold from `HEAD` and copying *which bytes*
from the working tree — precisely the split `task-091`'s D1 forbids ("a single command cannot decide
two things from two copies"), and AC1 measured that it is not hypothetical: the fabricated element's
body came from a file in no commit. So `resolveAddType` reads the scaffold with
`readPathAtRev(root, 'HEAD', '.wingfoil/' + template.file)` — the same primitive `loadMemoryYamlAtHead`
is built on — and `renderAddDocument` renders the committed bytes. Determinism (REQ-SYS-07) is the
second argument: two clones of one commit now scaffold byte-identical elements.

This has one **behaviour change in the permissive direction**, stated rather than smuggled. Measured
against the base build:

```
$ node dist/cli.js init --template scrum && rm .wingfoil/memory/templates/adr.md
$ node dist/cli.js memory add --type adr --title 'X'
error: ENOENT: no such file or directory, open '<abs>/.wingfoil/memory/templates/adr.md'     exit 1
```

A scaffold committed at `HEAD` but deleted in the working tree is a raw `ENOENT` today (leaking an
absolute path through the `error:` envelope); after D2 the add **succeeds** from the committed bytes.
That is `task-091`'s M2 in this task's clothes — the new rule permits where the old refused whenever
the working tree *withdraws* something `HEAD` records — and it is correct under the rule adopted. It
is pinned by a test so nobody reads it as an accident.

**D3 — refusals, all exit `1` (AC3), all before anything is written.**

| Condition | Code | First sentence |
|---|---|---|
| `.wingfoil/memory.yaml` not committed at `HEAD` | `VALIDATION` | `cannot resolve the memory type registry: '.wingfoil/memory.yaml' is not committed at HEAD. …` |
| committed `memory.yaml` does not parse/validate | `VALIDATION` | `cannot resolve the memory type registry: the committed '.wingfoil/memory.yaml' (at HEAD) is not readable as a Memory configuration: …` |
| type absent from the committed registry | `NOT_FOUND` | `unknown memory type '<t>' (not defined in memory.yaml)` — **verbatim**, P1.3 sc.2 / spec-008 § 6 |
| committed entry has no `id_pattern`/`template` | `VALIDATION` | `memory type '<t>' has no id_pattern/template in memory.yaml` — **verbatim**, unchanged |
| the type's `template.file` is not committed at `HEAD` | `VALIDATION` | `cannot read the scaffold for memory type '<t>': '<path>' is not committed at HEAD. …` |

`NOT_FOUND` and `VALIDATION` both map to exit `1` (`ERROR_EXIT_CODES`, `src/core/exit-code.ts`), per
`spec-005` § 1 as ruled on `bug-076`. Nothing here is a malformed invocation, so nothing is `2`.

**D4 — the second sentence, appended only when the working tree and `HEAD` actually disagree.**

`task-091`'s D5 / `task-090`'s `workingTreeWouldGrant`, on this surface: `memory.yaml` is the file an
author edits while designing a new type, so a refusal can contradict the editor. The note is computed
**after** the decision, from one working-tree read wrapped in `catch → undefined`, and no branch of it
can change an outcome. It is keyed on the actual disagreement, not on the file merely being dirty:

- unknown type → the note fires only when the **working tree's registry defines that type**;
- no `id_pattern`/`template` → only when the working tree's entry for that type supplies them;
- scaffold not committed → the tail differs by whether the file is present on disk at all
  (`commit '<path>' first` versus `add '<path>' and commit it`), which is the same disagreement test.

`memory.yaml` dirty for an unrelated reason therefore adds nothing, which is narrower than
`uncommittedMachineNote`'s per-file test in `src/core/memory-transition.ts` and matches AC3's wording
("a second sentence appears only when the working tree and `HEAD` actually disagree").

**D5 — fail-closed for an absent or unreadable committed `memory.yaml`** (AC4's second half), on
three grounds, of which only the second is shared with `task-091`'s D4:

1. **There is no bootstrap window to protect**, re-measured above, and here the measurement covers
   the scaffolds too. Fail-open would be a tolerance with no legitimate flow behind it.
2. **Fail-open is not "read the working tree", it is "create against no registry at all".** An add
   needs a `path`, an `id_pattern` and a scaffold; with nothing committed the only fail-open option
   is the working tree, which is the defect.
3. **The refusal is trivially repairable and says how** (`git add .wingfoil/memory.yaml && git commit`),
   whereas what a fail-open produces is the unreachable element `bug-085` is about — and unlike
   `bug-081`'s stranded element, which at least answers `invalid state`, this one is indistinguishable
   from never having been created.

`task-092`'s `requireAbsentTarget` keeps its place **after** the id is generated and before the write,
unchanged in behaviour (AC5): it is a check on the target path, and the target path is now derived
from the committed `path` pattern. The guard runs on whatever path the resolved pattern produces, so
it cannot regress — pinned by a case that re-runs its refusal.

**D6 — what I deliberately did not touch** (AC7, and the Implementation Notes' "say which you touched
and which you left"). `memory add` carries three instances of `dl-080`'s class:

| Read | This task |
|---|---|
| the type registry, `path`, `template` (`bug-085`) | **fixed** — D1, D2 |
| `nextSequenceNumber(resolveTypeDirectory(root, pathPattern), idPattern)` — the id counter (`bug-087`, `release: v0.3`) | **left**, see below |
| the write target (`bug-078`) | already `task-092`'s `requireAbsentTarget`; untouched |

My change **does touch `bug-087`'s ground, in one narrow way, and does not close it**:
`resolveTypeDirectory` is now fed the `path` pattern from `HEAD` instead of from the working tree, so
the directory the counter reads is the committed one. The count inside that directory is still
`readdirSync` of the **working tree**, which is the whole of `bug-087` — a gap in the sequence still
yields an id whose path is occupied, on a fully clean repository, exactly as its Steps to Reproduce
describe. Nothing here makes it trivially closable, and I did not widen to reach it. Re-measured
after the fix under AC5 below.

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce first on a scratch project | **process gate, not testable** | The AC1 transcript above, run against `dist/` built at the branch base before any `src/` edit. AC6's tests are its durable form. |
| **AC2** — the three reads resolve at `HEAD`, by removing the parameter or saying why not | **red-first** (its consequences) + **structural** | The decision is D1/D2; what a test can pin is that the working-tree copies no longer decide — the same tests as AC3/AC6. The unreachability itself is pinned by the type system: `memoryAddFn` holds no `MemoryYaml` and `resolveAddType` accepts none, so a call handing one over does not compile (`tsc --noEmit` gate). |
| **AC3** — refusals exit `1`, naming the type, second sentence only on real disagreement | **red-first** | Measured red: AC1 shows the path exiting **0** today. `sed -n '408,467p' src/core/index.ts \| grep -nE "readPathAtRev\|AtHead"` (those lines are `memoryAddFn` on the base commit) → exit 1, no match; nothing in that verb reads a revision. |
| **AC4** — `init` leaves no bootstrap window; fail-closed pinned | **split.** *Characterization*: `init` commits `memory.yaml` **and** the seven templates (already true — measured above; pinned by a test that reads `git show HEAD:…` and `git ls-tree`). *Red-first*: absent/unreadable committed `memory.yaml` → refuse (no such refusal exists today; today an absent one is a working-tree read that simply succeeds). |
| **AC5** — ordinary flows still pass, each pinned | **characterization** for the two positive flows (a committed type adds; add-type-then-**commit**-then-add works) and for `task-092`'s absence guard, which refuses on the current code too. Fabricating a red for any of them would mean asserting they are broken, which the `testing` directive forbids. |
| **AC6** — a test pins the defect and fails against current code | **red-first** | Same evidence as AC3; the observed red is recorded under `red`. |
| **AC7** — `bug-087` not in scope | **process gate** | Negative obligation, discharged in D6 and re-measured under AC5 after the fix. |
| **AC8** — six gates green, full `tsc` silent | **process** | Run at `refactor`/`review`. |
