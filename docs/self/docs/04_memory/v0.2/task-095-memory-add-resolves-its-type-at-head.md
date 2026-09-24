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

### red — role: developer

Commit `9455ca82`. Two new suites, no change to any existing one at this step:

- **`test/core/memory-add-type-baseline.test.ts`** — the baseline at the `CoreFn` seam, driving the
  REAL registered `memory.memoryAdd` operation in throwaway repos (`bug-075`): the `bug-085` type
  refusal, the diagnostic's two directions, the committed `path` deciding where an element lands, the
  committed scaffold deciding what bytes it carries, the mirror case where the working tree
  *withdraws* a scaffold `HEAD` records, the uncommitted-scaffold refusal, both AC4 fail-closed
  refusals, the "a working-tree read failure cannot decide" property, and the four AC5 ordinary
  flows including `task-092`'s absence guard.
- **`test/cli/memory-add-type-baseline.integration.test.ts`** — the two things only the process
  boundary shows: the exit code a script keys on and the stderr a human reads, through the compiled
  `dist/cli.js` in a real `wingfoil init` project, plus AC4's `init` measurement in the form this
  task needs it (the registry **and every `template.file` it names**, read out of the registry rather
  than hard-coded). `spawnSync`, per `task-086`'s gotcha, with the reason in the file's TSDoc so the
  next reader does not "simplify" it back.

Observed red — AC6's command, before any `src/` change:

```
$ npx jest test/core/memory-add-type-baseline.test.ts \
           test/cli/memory-add-type-baseline.integration.test.ts
Test Suites: 2 failed, 2 total
Tests:       10 failed, 9 passed, 19 total
```

The 10 failures are the defect. The 9 passes are exactly the cases T1 classifies as
characterization: the genuinely-unknown-type message (both seams); `init` committing the registry and
its templates; the ordinary add on a committed type (both seams); *edit → commit → add* (both seams —
the commit was not yet required, so the positive half already passed); `task-092`'s absence guard;
and adding while another element is dirty.

**One fixture bug was corrected before the commit, so the red count above is the honest one:**
`git status --porcelain` reports an unstaged modification as `' M <path>'` and my first draft
`.trim()`-ed the leading space away. Corrected to `.trimEnd()`. It was an assertion about git's
output format, not about the code under test.

*Not* corrected, because it is a genuine red: the "a working-tree read failure cannot change the
refusal" case fails by **throwing** on the pre-fix code rather than by a failed expectation. That is
the defect in its purest form — today the working-tree read *is* the decision, so its failure
propagates; after the fix it is a diagnostic wrapped in `catch → undefined` and the refusal is
returned normally.

### green — role: developer

Commit `27d8346f`. One new module, one call site, one export block.

| Change | Where |
|---|---|
| `resolveAddType(root, type): CoreResult<ResolvedAddType>` — resolves `loadMemoryYamlAtHead(root)` itself, returns the committed `path`/`id_pattern`/`template` plus the scaffold's committed bytes (`readPathAtRev(root, 'HEAD', '.wingfoil/' + template.file)`). Five refusals, all `CoreResult.error`, all exit `1`; two private diagnostics (`workingTreeEntry`, `workingTreeHasScaffold`) that fail to "no disagreement" | **new** `src/core/memory-add-type.ts` |
| `memoryAddFn` — the `loadMemoryYaml` pre-load, the registry lookup and the `readDocument` scaffold read all replaced by one `resolveAddType` call; its TSDoc steps 3–5 rewritten to name the baseline each step reads, including the `bug-087` carve-out | `src/core/index.ts` |
| `resolveAddType` / `ResolvedAddType` exported from `src/core` | `src/core/index.ts` |

Design points worth naming:

- **The fix is in the shape, not next to the call.** `memoryAddFn` no longer holds a `MemoryYaml` at
  all and `resolveAddType` accepts none, so AC2's "unreachable rather than guarded" is enforced by
  the type checker: a call handing either one a working-tree registry would not compile. The honest
  difference from `task-091` is recorded in D1 — there was no parameter to delete, so the decision
  moved behind a function whose only inputs are a root and a type name.
- **One baseline per command.** Registry, `path`, `id_pattern`, `template` block and scaffold bytes
  all come from the single `resolveAddType` call, so `memory add` cannot decide two of them from two
  copies — `task-091`'s D1 property, on this verb.
- **Both diagnostics fail to "no disagreement".** `workingTreeEntry` returns `undefined` and
  `workingTreeHasScaffold` returns `false` on any failure to read or parse; both are pinned by tests,
  two of them with spies.
- **The pinned fit criteria are untouched.** `unknown memory type '<t>' (not defined in memory.yaml)`
  (P1.3 sc.2, spec-008 § 6) and `memory type '<t>' has no id_pattern/template in memory.yaml` remain
  the verbatim **first** sentence; a second one is appended only when the working tree and `HEAD`
  actually disagree about *that type*. Every existing assertion matching those messages with
  `toBe`/`===` runs on a committed fixture and still matches byte for byte.
- **`task-092`'s guards are untouched and still run in the same order** — `requireAbsentTarget`
  before the write, `committedScopeError` after the commit. What changed beneath them is only that
  the target path is now derived from the committed `path` pattern.

Full suite after green: `npx jest` → **124 suites, 1930 tests passed**, exit 0. No existing test
changed, and none broke.

### refactor — role: developer

Commit `9e4ddcf3`. No behaviour added; the coverage the green step owed, plus the two properties it
asserted in prose.

- **`test/core/memory-add-type-resolve.test.ts`** exercises `resolveAddType` **directly**, on
  hand-made commits — `task-090`/`task-091`'s precedent, for their reason: with the resolution in
  place, `memory add` itself cannot reach several of its branches, so an indirect test could only
  assert that a diagnostic stays silent. It covers the branch `memory add` can never produce (a
  registered type declaring no `id_pattern`/`template` — `memory add` cannot register a type), the
  scaffold refusal's second tail (`add '<path>' and commit it`, when the file is on disk nowhere),
  and:
  - **neither diagnostic can decide** — a throwing `loadMemoryYaml` and a throwing `documentExists`
    each leave the refusal exactly as `HEAD` words it (two `jest.spyOn`s);
  - **a defect in the committed read propagates** — a non-`ValidationError` from
    `loadMemoryYamlAtHead` must not be converted into "unknown type" or "invalid registry"; a
    `ValidationError` becomes the fail-closed refusal and carries its `issues`. Same property and
    same technique `task-091` used on the transition read.

#### AC3/AC5 — the AC1 reproduction re-run against the fixed build

```
# same scratch recipe, same uncommitted `fabricated-type` + untracked scaffold
$ node dist/cli.js memory add --type fabricated-type --title 'Probe'
error: unknown memory type 'fabricated-type' (not defined in memory.yaml) — the working tree's
'.wingfoil/memory.yaml' defines it, but that change is not committed, and an element is created
against the committed registry (dl-080); commit '.wingfoil/memory.yaml' first, then retry
$ echo $?              ->  1
$ git log --oneline | wc -l    ->  1      # unchanged: nothing was written
$ ls docs                      ->  (no such directory)
$ git add -A && git commit -q -m 'chore: register a new memory type'
$ node dist/cli.js memory add --type fabricated-type --title 'Probe'
{ "id": "fab-001-probe", "path": "docs/memory/fabricated/fab-001-probe.md" }        exit 0
$ git log -1 --format='%s'                     ->  wf(fabricated-type): add fab-001-probe
$ git show HEAD~1:.wingfoil/memory.yaml | grep -c fabricated-type   ->  1
```

The element and the type that defines it are now in the same committed record, which is the whole of
`bug-085`'s Expected Behavior. The `Steps to Reproduce`'s step 5 no longer has a subject: there is no
committed element to strand.

#### AC7 — `bug-087` re-measured after the fix, and left alone

Its Steps to Reproduce, walked verbatim against this branch's `dist/`:

```
$ node dist/cli.js memory add --type adr --title 'Alpha'   # adr-001-alpha
$ node dist/cli.js memory add --type adr --title 'Beta'    # adr-002-beta
$ git rm -q docs/memory/adr/adr-001-alpha.md && git commit -q -m 'chore: remove alpha, leaving a gap'
$ git status --porcelain                     ->  (clean, fully committed)
$ node dist/cli.js memory add --type adr --title 'Beta'
error: refusing to create docs/memory/adr/adr-002-beta.md: something already exists there (at HEAD,
in the index, in the working tree). …                                              exit 1
```

Unchanged from what `bug-087` records for `task-092`'s branch. My change touches its ground in
exactly one narrow way and closes nothing: `resolveTypeDirectory(root, pathPattern)` is now fed the
`path` pattern from `HEAD`, so the **directory** the counter reads is the committed one — but the
**count** inside it is still `readdirSync` of the working tree, which is the whole of `bug-087`. It
is not trivially closable and I did not widen to reach it.

The same walk turned up a **face of `bug-087` its own record does not carry**, and it bears on the
premise its triage rests on. Raised as a proposed element, not acted on:

```
$ node dist/cli.js memory add --type adr --title 'Gamma'   # after the same gap, a DIFFERENT title
{ "id": "adr-002-gamma", … }                                                       exit 0
$ ls docs/memory/adr/
adr-002-beta.md   adr-002-gamma.md
```

Two distinct elements both numbered `002`, on a fully clean and fully committed repository, at exit
`0` and silently. `bug-087`'s Notes say that after `task-092` "what is left refuses loudly rather
than corrupting quietly" and its triage grades it `medium`, **not a release blocker**, on exactly
that sentence; this case neither refuses nor is loud. It collides only when the title matches.

#### Coverage — measured on both sides, not quoted

Baseline taken by running `npx jest --coverage` in a detached worktree at this branch's base
(`02b77f97`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `02b77f97` | 98.71 | 93.52 | 98.90 | 99.24 | 1909 |
| this branch | **98.72** | **93.62** | **98.90** | **99.26** | **1939** |

No metric regressed. `src/core/memory-add-type.ts` is at **100 / 100 / 100 / 100**; `src/core/index.ts`
is unchanged at 98.79 / 92.30 / 100 / 99.53.

The `+30` tests are accounted for rather than assumed: 19 in the two `red` suites, 8 in the
`refactor` suite, and **3** in `test/core/latency-budget-placement.test.ts`, whose `it.each` runs one
case per file under `test/` — three new test files, three new cases. Settled by running that suite
alone on both sides (`126` at base, `129` here).

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git -C /home/robypomper/Workspaces/WingFoil2 log --oneline -1 main
99fb235d docs(self): bug-092 — correct "indistinguishable" to "a guard-railed subset"
$ git merge main
Merge made by the 'ort' strategy.
 …bug-092-dna-set-and-dna-update-are-indistinguishable.md | 40 ++++++++++++++
 1 file changed, 40 insertions(+)
```

`main` moved by one commit while this task ran, and it touches one `bug` document under
`docs/self/docs/04_memory/bugs/` — no `src/`, no `test/`, nothing this task cites. Every gate below
was run **after** that merge.

#### Gates (run in this worktree, after the merge)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **125 suites, 1939 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.72 / 93.62 / 98.90 / 99.26** — no metric below base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Build typecheck, **emitting** | `npx tsc -p tsconfig.build.json` | exit **0**, no output |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, no output (`bug-026` stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

BDD acceptance scenarios touched by this change, and the tests that cover them:

| BDD scenario | Test that covers it |
|---|---|
| P1.3 sc.1 *Add a new Memory document in draft state* | `test/core/memory-add.test.ts` (unchanged, green) + `memory-add-type-baseline.test.ts` "AC5: adding an element of a COMMITTED type still works, in one scoped commit" |
| P1.3 sc.2 *Error — adding a document of an undefined type* | `test/core/memory-add.test.ts` (unchanged — its fixture commits `memory.yaml`, so the message matches byte for byte) + `memory-add-type-baseline.test.ts` "AC1/AC3/AC6: a type defined only in the working tree is refused at exit 1" and "AC3: a genuinely unknown type keeps the pinned P1.3 message verbatim" |
| P1.3 sc.3 *Error — missing required title* | `test/core/memory-add.test.ts` (unchanged) — still the only exit-2 path, thrown before any baseline read |
| spec-008 § 6 *error envelope* | `test/cli/memory-add-type-baseline.integration.test.ts` "AC3: a genuinely unknown type still prints the spec-008 §6 example verbatim at exit 1" |
| P5.1.1 *fresh init then add* | `test/cli/fresh-init-transitions.test.ts` (untouched, green) + the CLI suite's `init` measurement and ordinary-add case |
| P1.11 `writeMemoryEntry` / REQ-SEC-06 confinement | `test/memory/entry.test.ts`, `test/storage/memory-path.test.ts` (both unchanged) — the confined write is untouched |

### review-ready summary — role: reviewer

**What changed, in one sentence.** `memory add` decided three things from the files on disk — whether
a type exists, where its files land and which scaffold to copy — so an uncommitted `types:` entry was
enough to commit an element of a type no commit defines and whose body came from a file in no commit,
after which every verb answered `document not found`; all three now resolve against the
`.wingfoil/memory.yaml` committed at `HEAD` and the scaffold committed beside it, inside
`resolveAddType(root, type)`, which accepts no parsed configuration — so there is no call path that
can reach the decision with a working-tree copy.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 reproduce first on a scratch project, commands in the notes | done | `design` § AC1 — exit 0, `git show HEAD:.wingfoil/memory.yaml \| grep -c` → 0, `git cat-file -e` on the scaffold → 128, and all three verbs answering `document not found` after the tree is restored |
| AC2 registry, `path` and `template` all resolve at `HEAD`, `task-091`'s shape | done | `design` § D1/D2; `green` §. D1 records the one honest difference — no parameter existed to remove — and what was done instead, rather than substituting a guard |
| AC3 refusal exits `1`, names the type, says it is not committed; second sentence only on real disagreement | done | `design` § D3/D4; `refactor` § transcript; both suites assert `1`, never `2`, and the diagnostic is keyed on the type rather than on the file being dirty |
| AC4 `init` leaves no bootstrap window (re-verified); fail-closed pinned | done — **fail-closed**, argued in D5 on three grounds, one shared with `task-091` | `design` § AC4 — re-measured, and extended to the **seven scaffold templates**, which `task-091` had no reason to measure; tests at both seams |
| AC5 the three ordinary flows pinned, absence guard not regressed | done | four characterization cases at the `CoreFn` seam + two at the process boundary, all green on the pre-fix run |
| AC6 a test pins the defect and fails against current code | done | `red` § — 10 failed / 9 passed before, 19 passed after; commands recorded |
| AC7 `bug-087` not widened into | done | `refactor` § AC7 — its Steps walked verbatim on the fixed build, unchanged; the one narrow way my change touches its ground is stated, and a face of it its record does not carry is raised rather than acted on |
| AC8 all six gates green, full `tsc` silent | done | `refactor` § Gates |

**Weak spots a reviewer should check**

1. **A behaviour change in the permissive direction** (`task-091`'s M2, on a new surface): a scaffold
   committed at `HEAD` but deleted in the working tree used to fail with a raw `ENOENT` (leaking an
   absolute path through the `error:` envelope) and now **succeeds** from the committed bytes. Correct
   under the rule adopted, measured in D2, and pinned by a test — but it is where the new behaviour
   permits what the old refused.
2. **The scaffold read moved too, and AC2 can be read as naming only `memory.yaml`'s `template` key.**
   D2 argues the wider reading from `task-091`'s own one-baseline-per-command principle and from
   AC1's measurement that the committed element's body came from an untracked file. A reviewer who
   disagrees should say so: it is the one place I extended past the narrowest reading of the AC.
3. **Refusal messages grew a second sentence**, only when the working tree and `HEAD` disagree about
   the requested type. Any consumer matching a message with `===` rather than a prefix would see the
   difference; in this repository nothing does (`test/core/memory-add.test.ts:190` commits its
   fixture and still matches exactly).
4. **A new file in `src/core`.** `resolveAddType` could have gone into `src/core/index.ts` or into
   `memory-transition.ts`. It went into its own module for the reason `write-guard.ts` did — one
   decision, one place — and, practically, to keep this branch's footprint in the shared
   `src/core/index.ts` down to one import line, one call site and one export block while `task-093`,
   `task-096` and `task-097` are in flight on the same file.
5. **`bug-087` remains open and its ground moved slightly.** `resolveTypeDirectory` now takes the
   committed `path` pattern. Nothing about the counter changed, but a reviewer scoping `bug-087`'s
   eventual fix should read D6 first.

**Files touched outside the task file:** `src/core/memory-add-type.ts` (new), `src/core/index.ts`,
and three new test files (`test/core/memory-add-type-baseline.test.ts`,
`test/core/memory-add-type-resolve.test.ts`,
`test/cli/memory-add-type-baseline.integration.test.ts`). **In `src/core/index.ts` the change is one
added import line (`import { resolveAddType } from './memory-add-type';`, next to the
`memory-transition` import), one export block, a TSDoc rewrite of `memoryAddFn`'s steps 3–5, and a
13-line replacement inside `memoryAddFn`'s body.** No barrel other than `src/core/index.ts` is
touched, and no existing import line was rewritten — which is the specific hazard the wave brief
names (`task-091`/`task-092`'s clean-but-semantic merge conflict).

**Out of scope, raised rather than fixed (brief rule: proposing is mine, filing is the
orchestrator's).** Listed in this run's final report: the silent duplicate-sequence face of
`bug-087`; and the observation that `memory search`/`memory history` and the MCP Memory Resources
still read the working-tree registry — correctly, since they gate nothing, but `memory search --type`
is what a user reaches for after one of these refusals, so the two can disagree.
