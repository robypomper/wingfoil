---
id: "task-096-directive-inventory-resolves-at-head"
type: task
title: "Resolve the directive inventory and its references at `HEAD`, so `assign` cannot bind a file present in no commit and `remove` cannot delete one the committed `roles.yaml` still binds"
status: in-review
release: "v0.2"
priority: "high"
tags: ["v0.2", "directives", "security"]
ref: "bug-086-directive-inventory-read-from-the-worktree"
bug: ["bug-086-directive-inventory-read-from-the-worktree"]
depends_on: ["task-091-reads-resolve-at-head", "task-092-writes-refuse-a-dirty-target"]
tmpl_version: 260703
---

## Description

Two directive verbs decide against the working tree, and they are one read seen from two sides —
**which directive files exist, and what references them**.

- **`directive assign`** checks `--directive` against the files on disk, so an untracked file can be
  bound and the committed `roles.yaml` then names a directive present in no commit.
- **`directive remove`** checks REQ-SEC-07 clause (b) against the working tree's `roles.yaml`, so an
  uncommitted deletion of the reference is enough to **destroy** a file the committed `roles.yaml`
  still binds — the only WingFoil verb that deletes an artefact.

`task-091` moved `--role` to `HEAD` and left both of these, offering the boundary "governance versus
the asset being operated on". Its reviewer showed the boundary does not hold: `directive remove`'s
check reads `roles.yaml`, which is governance by that same definition. What actually separates them is
**cost** — and cost is a scheduling reason, not a rule.

Declared a release blocker at `high`.

## Acceptance Criteria

- **AC1** — **The missing primitive comes first and is the task's real work.** Reading the directive
  inventory at a revision needs a *directory listing at that revision* — a `git ls-tree`-shaped
  facility `src/storage` does not have. Build it there, beside `readPathAtRev`, with its own tests
  and TSDoc. It is reusable and should be written as such, not inlined into a directive check.
- **AC2** — Reproduce both halves first, on scratch projects against current `main` (`bug-075`):
  `assign` binding an untracked `ghost` directive, and `remove` deleting a directive the committed
  `roles.yaml` still binds twice. Commands in the notes, and for `remove` show the file gone and
  `git show HEAD:.wingfoil/roles.yaml | grep -c` still non-zero.
- **AC3** — After the fix both reads resolve at `HEAD`, following `task-091`'s shape (parameter
  removed, decision unreachable from a working-tree copy). Refusals exit **`1`** per `spec-005` §1.
- **AC4** — **`remove` is the half that must not be got wrong.** Its check answers "may this asset be
  deleted?", and a wrong answer destroys a file. Establish what happens when the directive file
  itself is uncommitted — deleting an untracked file is not the same act as deleting a committed one,
  and refusing both may be wrong. Argue it.
- **AC5** — The ordinary flows still pass, each pinned: assigning a committed directive to a
  committed role; the add-commit-assign sequence; removing a directive whose reference was removed
  **and committed**; and `task-091`'s `--role` check unchanged.
- **AC6** — Tests pin both defects and fail against current code.
- **AC7** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-091`'s Execution Notes first (`dl-015` read_related), including its D2 section, which
  argues the boundary this task overturns — and `bug-086`'s Notes, which record why.
- `dl-042`'s warnings channel already reports a directive bound to a role with no directive file.
  Check whether it still behaves correctly once the inventory is committed-resolved: a warning that
  can no longer occur is dead code, and one that changes meaning should be updated.
- The new storage primitive is the part most likely to outlive this task. Give it the TSDoc a future
  caller will read, and say in the notes what else could use it.
- Classify every AC per `dl-014`/T1. AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->

### start — role: developer

`status: backlog → in-progress` (`b4818c2`). `bug:` names one bug, so `bug.sync_state` ran as its own
commit: `bug-086` `planned → in-progress` (`ee053b8`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-096`, branch
`task/task-096-directive-inventory-resolves-at-head`, from `main` at `02b77f9`.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-091-reads-resolve-at-head` (`done`) — Execution Notes read in full**, including its `D2`
  section, which argues the boundary this task overturns. What I took from it:
  1. **The shape, and that it is a shape rather than a check.** `D1`/`D2` both *remove the parameter*
     through which a working-tree document could reach the decision — `prepareMemoryTransition(root,
     id, op)` and `checkAssignable(root, directiveFiles, role, ids)` — so "unreachable rather than
     guarded" is enforced by the type checker. Both fixes below copy that literally: `checkAssignable`
     loses `directiveFiles` and `checkUnreferenced` loses `rolesYaml`.
  2. **`D2`, the boundary, and why it goes.** task-091 offered "the role catalogue is *governance*,
     the directive file is the *asset being operated on*" and its own `D2` then names the real reason:
     *"it needs a directory listing at a revision, which `src/storage` has no primitive for"*. Its
     reviewer showed the boundary does not hold (`directive remove`'s clause-(b) check reads
     `roles.yaml`, governance by that same definition). `bug-086`'s Notes settle it: what separates
     them is cost, and cost is a scheduling reason. So AC1's primitive is the task, and the boundary
     is simply deleted rather than re-argued.
  3. **The fail-closed precedent, and that it is a precedent and not a rule** (its `D4`, three
     grounds, only one shared with task-090). `D4` below re-derives the answer for *each* of this
     task's two reads and gets **different** answers, which is the point of re-deriving it.
  4. **The diagnostic that never decides** (`D5`, `workingTreeWouldDefine`). Reused unchanged for the
     role half; `D3` below says why the two new reads do not get one of their own.
  5. **Its own AC5 sweep rows `S2` and `S3` are this task's subject** — they are `bug-086`'s two
     transcripts. AC2 re-derives them from scratch rather than pasting, as it asks.
  6. **The measurement gotcha:** `execFileSync` + `catch` reads back `stderr: ''` for a command that
     exits `0` while printing to fd 2, so CLI-level assertions use `spawnSync`. Reused.
- **`task-092-writes-refuse-a-dirty-target` (`done`) — Execution Notes read in full.** It is the other
  `depends_on`, and it turns out to *answer* AC4 rather than merely neighbour it:
  1. **`requireUnmodifiedTarget` already guards `directive remove`'s target**, added by its `green`
     step (`src/core/index.ts`, the call before `removeDocument`). `pathPorcelainStatus` returns a
     non-empty code for an **untracked** file (`??`) as well as a modified one, so an uncommitted
     directive file is already un-removable. Measured, not inferred — AC4 below.
  2. **Its `R3` is the same verb from the write side**: staging a deletion discards the working-tree
     blob, so an uncommitted edit to the directive being removed is *destroyed* rather than swept in.
     That is why the refusal, not a read change, is the right answer to AC4.
  3. **Its AC3 method** — "establish what a caller can actually absorb, rather than assume" — is what
     `D4` does for the two reads here.
  4. **Its per-path narrowness** (`dl-080`'s rejected option (D)): an unrelated dirty file must never
     block a write. Nothing here widens that.
- **`bug-086` (`high`, release blocker) — read in full**, including the Notes that record why the two
  halves are one element and why `remove` is graded above `assign`.
- **`dl-080-which-baseline-each-command-reads` (`ready`) — read in full.** Option (B) is the rule;
  its cost is "accepted knowingly". Nothing below re-argues it.

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one; everything this task enforces is already
written down.

- **`dl-080`** (`ready`) is the rule itself and needs no spec.
- **`spec-005-cli-command-contract`** § "1. Exit-code contract (REQ-INT-04)" — **not** amended: every
  refusal here is a well-formed invocation failing a repository-state precondition, i.e. exit `1`
  (AC3; ruled on `bug-076`, restated by `task-090`/`task-091`/`task-092`).
- **REQ-SEC-07** clause (b) (`docs/02_requirements/03_sard/05_security-compliance.md`) is the
  requirement `remove`'s half enforces; `dl-030-req-sec-07-referenced-asset-ownership` (option (b))
  is what assigned it to the directive verb. Neither changes — what changes is *which copy of
  `roles.yaml` answers it*.
- **REQ-SYS-08** is what `assign`'s half protects, in the same shape `bug-082` broke it: a committed
  binding whose referent exists in no commit.
- **`spec-011-storage-layout`** fixes `.wingfoil/directives/{built-in,custom}/`, which the new
  primitive is pointed at; it is cited, not amended.
- **`dl-042-directives-list-output-contract`** (D) owns the dangling-binding warning the
  Implementation Notes ask about. `D5` below records what I measured about it. No amendment: the
  warning's wording and channel are unchanged.

`design` gate state: `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied above; `tech-spec.approved` — no spec scaffolded, so the approver gate passes through.

#### AC2 — both halves reproduced, on scratch projects, before any `src/` change

Built this branch at its base (`npm run build`, exit 0 — no `src/` edit yet, so `dist/` is `main` at
`02b77f9` plus the two `start` commits), then throwaway projects under the session scratchpad. A
scratch project is required: `bug-075` means the verbs cannot be pointed at this repository's own
configuration.

**`assign` — a committed binding to a directive present in no commit.**

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum        # exit 0; git status --porcelain -> clean
$ printf -- '---\nid: ghost\nname: ghost\ntype: directive\nkind: custom\ntitle: "Ghost"\n---\n\n# Ghost\n' \
    > .wingfoil/directives/custom/ghost.md
$ git status --porcelain
?? .wingfoil/directives/custom/ghost.md
$ node dist/cli.js directive assign --directive ghost --role developer          exit 0
$ git log -1 --format='%s'          ->  wf(directive): assign ghost to developer
$ git show HEAD:.wingfoil/roles.yaml | grep -c ghost                   ->  1
$ git cat-file -e HEAD:.wingfoil/directives/custom/ghost.md
fatal: path '.wingfoil/directives/custom/ghost.md' exists on disk, but not in 'HEAD'    exit 128
```

**`remove` — a committed, still-referenced asset destroyed (the sharper half).**

```
$ node dist/cli.js init --template scrum >/dev/null
$ node dist/cli.js directive remove determinism
error: cannot remove 'determinism': still assigned to role 'architect'          exit 1   # control
$ git show HEAD:.wingfoil/roles.yaml | grep -c determinism              ->  2
$ sed -i '/- determinism/d' .wingfoil/roles.yaml      # uncommitted
$ git status --porcelain -- .wingfoil/roles.yaml
 M .wingfoil/roles.yaml
$ node dist/cli.js directive remove determinism                                  exit 0
$ git log -1 --format='%s'          ->  wf(directive): remove determinism
$ git show --name-only --format='' HEAD  ->  .wingfoil/directives/custom/determinism.md
$ test -e .wingfoil/directives/custom/determinism.md && echo PRESENT || echo GONE   ->  GONE
$ git show HEAD:.wingfoil/roles.yaml | grep -c determinism              ->  2
```

The file is gone and the `roles.yaml` committed **at that very commit** still binds it twice — an
uncommitted edit walking past the one check REQ-SEC-07 clause (b) exists to enforce, on the only verb
in the system that destroys an artefact.

#### AC4 — what happens when the directive file itself is uncommitted, measured first

```
$ node dist/cli.js init --template scrum >/dev/null
$ node dist/cli.js directive create --name alpha     exit 0
$ git log -1 --format='%s'   ->  wf(directive): create alpha       # create COMMITS the file
$ git status --porcelain     ->  (clean)

# B — an UNTRACKED directive file, removed
$ printf -- '---\nid: ghost\n…\n---\n' > .wingfoil/directives/custom/ghost.md
$ node dist/cli.js directive remove ghost
error: refusing to commit .wingfoil/directives/custom/ghost.md: it carries uncommitted modifications
this operation does not own [git status '??'] — the file is not in the index, the file is not tracked
at HEAD. A `wf(...)` commit records the change its subject declares and nothing else; commit or stash
these changes first, then retry.                                                  exit 1
$ test -e .wingfoil/directives/custom/ghost.md    ->  PRESENT      # nothing destroyed
$ git log -1 --format='%s'   ->  wf(directive): create alpha       # HEAD unchanged

# C — a COMMITTED directive carrying an uncommitted edit, removed
$ printf '\nAN UNCOMMITTED PARAGRAPH.\n' >> .wingfoil/directives/custom/alpha.md
$ node dist/cli.js directive remove alpha
error: refusing to commit .wingfoil/directives/custom/alpha.md: … [git status ' M'] — the body. …
                                                                                   exit 1
```

**The argument (AC4 asks for one, not a report).** Deleting an untracked file is indeed not the same
act as deleting a committed one — and it is **not this verb's act at all**. `directive remove`'s
contract is to produce one scoped commit that *records* the deletion (`wf(directive): remove <name>`,
`commitPaths`); a file in no commit has no deletion to record, so the verb cannot honour its own
contract over it. Refusing is therefore not a conservative tax, it is the only outcome that keeps the
verb's contract true. Three further points decide it, all measured above:

1. **It is already the behaviour**, delivered by `task-092`'s write rule rather than by any read: `??`
   is a non-empty porcelain code, so `requireUnmodifiedTarget` refuses. Nothing needs to be *added*
   for AC4 — what the fix must do is *not break it*, which is why it is pinned by two tests.
2. **The refusal a user needs is that one, not "unknown directive".** This is the live design risk of
   this task: moving `remove`'s *resolution* read to `HEAD` as well would have turned case B into
   `unknown directive: ghost` — a message that is false to the user's screen, where the file plainly
   is. So the resolution read (`loadDirectives` → `selectDirectivesById`, step 3 of `directiveRemoveFn`)
   **deliberately stays on the working tree**: it answers "which file on disk am I being asked to
   delete", the asset itself, and `task-092`'s guard then decides whether that file may be deleted.
   What moves to `HEAD` is only the *reference* check, which is the read `bug-086` names.
3. **Asymmetric risk.** Refusing costs `git add && git commit` (or `rm`, if the author never wanted
   the file). Accepting destroys content that exists in no commit anywhere — `task-092`'s `R3`
   measured exactly that loss on the same verb.

A residual of leaving the resolution read on the working tree, stated rather than smuggled: a
directive that is committed but **deleted in the working tree** resolves to nothing, so
`directive remove <id>` answers `unknown directive: <id>` where `HEAD` still carries the file. That is
a refusal, so nothing is destroyed and no wrong record is written; it is the same class as the two
defects but on the harmless side of it. Raised as a proposed element rather than folded in.

#### AC1/AC3 — the design

**D1 — the missing primitive: `listPathsAtRev` (`src/storage/commit.ts`), beside `readPathAtRev`.**

`readPathAtRev` answers *"what does this one path contain at `<rev>`"*. Every committed-baseline read
so far (`loadDnaYamlAtHead`, `loadMemoryYamlAtHead`, the write guard's three probes) is of a file
whose name was known in advance. The Directives pillar is the first whose baseline is a **directory**
whose members are discovered, and that is the whole of `task-091`'s cost argument. So:

```ts
listPathsAtRev(root, rev, prefix = '', options = {}): string[] | null
```

`git ls-tree -r -z --full-tree <rev> [-- <prefix>]`. Decisions worth naming, each of which is a test:

- **`-z`, always.** Without it git C-quotes any path containing a space or a non-ASCII byte, so a
  caller would silently receive `"two words.md"` *with* the quotes and never find the file. `-z` is
  NUL-separated and never quotes.
- **Blobs only.** The full `ls-tree` record (`<mode> SP <type> SP <sha> TAB <path>`) is matched
  against `/^\d+ blob [0-9a-f]+\t/`, so a gitlink (submodule, mode `160000`) under the prefix is not
  reported as a file. A listing whose entries cannot be `readPathAtRev`-ed would be a trap.
- **`null` vs `[]` is load-bearing, not cosmetic.** `[]` means *the revision exists and holds nothing
  there*; `null` means *the revision does not resolve* (an unborn `HEAD`, a bad ref). Callers that
  must fail closed need to tell those apart, and it mirrors `readPathAtRev`'s `null`.
- **Sorted explicitly** (REQ-SYS-07), even though git's own order already is: `loadDirectives` sorts
  its `readdirSync` walk for exactly this reason, and the two loaders must not differ by accident.
- **`--full-tree`** so paths are root-relative regardless of where git thinks the cwd is, and the
  pathspec is read against the root too.
- **Empty `prefix` lists the whole tree**, because `git ls-tree -- ''` is a `fatal:` rather than a
  match-all; the argument is simply omitted in that case.

Written in `commit.ts` and not a new file because `runGit`/`probeGit` are private there and this is
the same kind of thing: a thin, throwing-or-`null` git reader. `probeGit`, not `runGit` — a bad
revision is an expected answer here, and git's `fatal:` must not reach the user's terminal next to the
CLI's own message.

**What else could use it** (AC1 says to say so): `memory search` and the Memory Resources, if the
committed baseline ever reaches them (`task-091`'s S1 filed `memory add`, whose type registry has the
same question); `computeStateSnapshot` (`src/storage/snapshot.ts`), which today walks the working
tree and is REQ-SYS-01's fit criterion; `loadWorkflowsYaml`'s Layer-2 `include` resolution, which will
need a committed baseline the moment a workflow gates anything; and any future "what did this
directory look like at release `vX`" report.

**D2 — `directive assign`: `checkAssignable` resolves its own committed inventory.**

`checkAssignable(root, directiveFiles, role, ids)` → `checkAssignable(root, role, ids)`, reading
`loadDirectivesAtHead(root)` itself — the exact move task-091 made on the same function for the role
half, finishing the job on the same line of code. `directiveAssignFn`'s `loadDirectives(root)`
pre-load disappears with it (that was its only consumer). After this, no call path can reach the
binding decision with a working-tree inventory, because there is no argument through which one could
arrive.

`loadDirectivesAtHead` (`src/core/loaders.ts`) is `listPathsAtRev` + `readPathAtRev` per entry + the
**same** frontmatter parse `loadDirectives` uses, lifted into `parseDirectiveFile` so the two loaders
cannot drift on what a directive file is. Error labels name the baseline (`HEAD:.wingfoil/…`), as
`parseMemoryYaml` does since task-091.

**D3 — no working-tree diagnostic on these two refusals, and that is a decision.**

task-091's `D5` appends a second sentence when the working tree and `HEAD` disagree. I did **not** add
one here, for a reason specific to each:

- `assign`'s refusal is `unknown directive: <id>`, P3.2 Scenario 3's **pinned** wording. A note would
  have to be appended to a message three suites match with `toBe`, and the equivalent information is
  one command away (`git status`). More importantly the remedy is already obvious from the message a
  user sees next to their own untracked file.
- `remove`'s refusal is `cannot remove '<id>': still assigned to role '<role>'`, P3.3's pinned
  wording — and here a note would be actively wrong: it would advertise "commit your unbinding and
  this will succeed", which is a suggestion to delete a file. The refusal should not coach.

Recorded as a judgement rather than an oversight; a reviewer may disagree.

**D4 — an absent committed baseline: fail-closed for `assign`, fail-**open** for `remove`, and the
two are the same rule.**

task-091's `D4` fails closed on an absent committed `dna.yaml`. Re-derived here per read, and the
answers differ:

- **`assign`'s inventory — closed.** "May `<id>` be bound" needs the **positive** fact *a directive
  with this id exists*. An absent or empty committed tree cannot supply it, so every id is unknown and
  the request is refused — which falls out of the code with no extra branch (`loadDirectivesAtHead(root)
  ?? []`), rather than being a special case someone must remember. A **committed** directive file that
  does not validate is a `VALIDATION` refusal naming `HEAD`, mirroring the role half: a defect in the
  read must never become an answer.
- **`remove`'s reference check — open, and it is not fail-open.** "Is anything referencing it" needs
  the **negative** fact *no binding names this id*. A `roles.yaml` that is not committed at `HEAD` is
  not a missing answer; it is the answer *nothing is bound*, and it is exactly the reading
  `checkUnreferenced` already had for an absent file (task-051/053, "no bindings yet"). Failing closed
  here would refuse every removal in a project that binds nothing — a legitimate configuration, and
  `init` is not even a defence for it, because a user may commit the deletion of `roles.yaml`. A
  committed `roles.yaml` that does not **validate** is a different thing and does fail closed, for the
  same reason as above.

So the rule is one rule: **a check that needs a positive fact fails closed when the record is missing;
a check that needs the absence of a fact is satisfied by a missing record.** That is not a compromise
between the two halves — it is what "resolve at `HEAD`" *means* in each.

**D5 — `dl-042`'s warnings channel, checked rather than assumed** (Implementation Notes).

The warning `directive '<id>' bound to role '<role>' has no directive file` lives in
`resolveRoleDirectives` (`src/core/context.ts`), reached from `loadDirectiveListing` — a `mutates:
false` operation that reports what the user has **now**. It is neither dead nor changed in meaning:

- **Still reachable**, measured: commit a binding and its directive, delete the file in the working
  tree, `directives list --role developer` still warns. Pinned by a test.
- **No longer reachable through `directive assign`**, which is the part `bug-086` closes — and that is
  the warning's *cause* narrowing, not its meaning. It said "this binding names no file" before and
  says the same now; what changed is that the tool can no longer manufacture the state, so a warning
  that fires is now evidence of a hand-edit or a working-tree deletion. Its wording carries no claim
  about who produced it, so nothing in it is made stale. Also pinned.

The one sentence that *is* made stale by this task is `checkAssignable`'s own TSDoc, which declares
the asymmetry deliberate and cites the missing primitive — mine to fix, and fixed in `green`.

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — the primitive comes first, with its own tests and TSDoc | **red-first** | `listPathsAtRev` does not exist: `grep -rn "ls-tree" src/` → no match before this task. Its twelve tests fail with `TypeError: (0 , storage_1.listPathsAtRev) is not a function` on the first run. |
| **AC2** — reproduce both halves on scratch projects | **process gate, not testable** | The AC2 section above, run against `dist/` built at the branch base before any `src/` edit. AC6's tests are its durable form. |
| **AC3** — both reads resolve at `HEAD`; refusals exit `1` | **red-first** | Measured red: both AC2 transcripts exit **0** today. `grep -n "AtHead" src/core/directive-assign.ts` → one hit, `loadDnaYamlAtHead` (the role half only); nothing in either inventory path reads a revision. |
| **AC4** — establish and argue the uncommitted-directive-file case | **design obligation + characterization** | The argument is the AC4 section; its testable half *already passes* on the pre-fix code (two cases, green on the first run) because `task-092`'s guard owns it. Fabricating a red for it would mean asserting it is broken, which it is not. |
| **AC5** — the ordinary flows, each pinned | **mixed, and honestly so.** *Characterization*: assign a committed directive to a committed role; remove a directive whose reference was removed and committed; `task-091`'s `--role` check; both pinned `unknown …` messages; REQ-SEC-07 (a) first. *Red-first*: the write → commit → assign sequence, whose "before the commit it is refused" half is the defect. | Seven of the thirteen first-run passes are these. |
| **AC6** — tests pin both defects and fail against current code | **red-first** | `red` § — 24 failed / 13 passed before the fix, commands recorded. |
| **AC7** — six gates green, full `tsc --noEmit` silent | **process** | Run at `refactor`/`review`. |

### red — role: developer

Commit `75fefa8`. Three new suites, no change to any existing one at this step:

- **`test/storage/list-paths-at-rev.test.ts`** — AC1's primitive, tested **directly** rather than only
  through the verbs that need it, because it is written to outlive them: the prefix listing, the
  revision-not-the-working-tree property in both directions, an older revision, `[]` vs `null`, the
  whole-tree default, the blobs-only filter (against a real gitlink), a path with a space returned
  unquoted, composition with `readPathAtRev`, and the `env` passthrough.
- **`test/core/directive-inventory-baseline.test.ts`** — both halves at the `CoreFn` seam, driving the
  REAL registered `directive.directiveAssign` / `directive.directiveRemove` in throwaway repos: the
  two `bug-086` defects, the two mirror cases where the working tree *withdraws* what `HEAD` records,
  both fail-closed refusals, `D4`'s deliberate fail-open for an uncommitted `roles.yaml`, AC4's two
  write-guard cases, every AC5 ordinary flow, and `D5`'s two warnings-channel measurements.
- **`test/cli/directive-inventory-at-head.integration.test.ts`** — the two things only the process
  boundary shows: the exit code a script keys on and the stderr a human reads, through the compiled
  `dist/cli.js` in a real `wingfoil init` project, plus the `init`-commits-both-baselines measurement.
  `spawnSync`, per `task-086`'s gotcha (recorded in the file's TSDoc so the next reader does not
  "simplify" it back).

Observed red — AC6's command, before any `src/` change:

```
$ npx jest test/storage/list-paths-at-rev.test.ts test/core/directive-inventory-baseline.test.ts \
           test/cli/directive-inventory-at-head.integration.test.ts
Test Suites: 3 failed, 3 total
Tests:       24 failed, 13 passed, 37 total
```

The 24 failures are the two defects plus the absent primitive (twelve of them
`TypeError: (0 , storage_1.listPathsAtRev) is not a function`). The 13 passes are exactly the cases T1
classifies as characterization: both AC4 write-guard refusals; assigning an already-committed
directive; the second half of write → commit → assign; `task-091`'s `--role` refusal; both pinned
`unknown …` messages (assign and remove); REQ-SEC-07 (a) firing first; removing a
reference-removed-**and-committed** directive; an uncommitted `roles.yaml` permitting removal
(`D4`'s fail-open, already the behaviour for an absent file); `init` committing both baselines; and
the dl-042 warning still firing from `directives list`.

Two first-draft cases were **fixture** bugs rather than reds and were corrected before the commit, so
the red count above is the honest one: withdrawing the only entry of a `roles.yaml` list leaves
`global:` with no items, which YAML reads back as `null` and `RolesYaml` then rejects — a fixture
failure that looks exactly like a real refusal. Every list in the fixture now carries two entries.

### green — role: developer

Two source modules, one new function each side of the `core`/`storage` boundary, and four call sites.

| Change | Where |
|---|---|
| **`listPathsAtRev(root, rev, prefix?, options?)`** — `git ls-tree -r -z --full-tree`, blobs only, sorted, `null` for an unresolvable revision. Appended as its own section beside `readPathAtRev`; `probeGit`, so a `fatal: Not a valid object name` never reaches the user's terminal | **new**, `src/storage/commit.ts` |
| exported from the `storage` barrel (one line) | `src/storage/index.ts` |
| `parseDirectiveFile(raw, filePath, relativePath)` — the per-file frontmatter parse lifted out of `loadDirectives` so the same schema and the same error shapes serve bytes from any source; `filePath` becomes a **label** (`HEAD:.wingfoil/directives/custom/x.md`), so an error names the baseline it came from | `src/core/loaders.ts` |
| `loadDirectivesAtHead(root): DirectiveFile[] \| null` and `loadRolesYamlAtHead(root): RolesYaml \| null`, plus the root-relative POSIX constants `DIRECTIVES_DIR_PATH` and `ROLES_YAML_PATH` (the latter **moved** here from `directive-assign.ts`, beside `DNA_YAML_PATH`/`MEMORY_YAML_PATH`, and re-exported from its old home so no importer changed) | same |
| `checkAssignable(root, role, ids)` — **the signature changed**: it no longer accepts `directiveFiles` and resolves the committed inventory itself, with a `VALIDATION` refusal for a committed directive file that does not parse | `src/core/directive-assign.ts` |
| `checkUnreferenced(root, id)` — **the signature changed** the same way: no `RolesYaml` parameter, `loadRolesYamlAtHead` resolved internally, `null` meaning "nothing is bound" and a `VALIDATION` refusal for a committed `roles.yaml` that does not validate | same |
| `directiveAssignFn` loses its `loadDirectives` pre-load; `directiveRemoveFn` loses its `documentExists` + `loadRolesYaml` block. Each verb's TSDoc step list now says which baseline it reads, and step 3 of `remove` records AC4's decision | `src/core/index.ts` |
| barrel: `loadDirectivesAtHead`, `loadRolesYamlAtHead`, `DIRECTIVES_DIR_PATH`, `ROLES_YAML_PATH` added to the existing `export { … } from './loaders'` block (`D3`'s reasoning from task-091, unchanged) | same |

Design points worth naming:

- **Both fixes are in the signature, not next to the call**, exactly as `task-090`/`task-091` did.
  Neither function can be handed a working-tree document any more, so "unreachable rather than
  guarded" is enforced by the type checker: a call that tried would not compile. Six lines of caller
  code disappeared rather than being added to.
- **The two verbs got *shorter*.** `directiveRemoveFn` lost a `documentExists` probe, a `loadOrError`
  and a mutable `RolesYaml | undefined`; `directiveAssignFn` lost a `loadOrError`. The only import
  line I had to touch in a shared file is `src/core/index.ts`'s — `loadRolesYaml` and
  `ROLES_YAML_PATH` are no longer used there, and `type RolesYaml` was removed with them (flagged by
  `lint.clean`, not by `tsc`). Named here because the brief asks where a merge should look.
- **`?? []` rather than a null branch.** `loadDirectivesAtHead` returning `null` (no commits at all)
  is "no directive is committed", which is already the refusal every id gets — so `assign`'s
  fail-closed behaviour needs no special case, and there is no branch that only a contrived fixture
  could reach.
- **Asymmetric `null` handling is the same rule, not two rules.** See `D4`: `assign` needs a positive
  fact and refuses without a record; `remove` needs a negative one and is satisfied by a missing
  record. Both *validation* failures refuse.
- **`remove`'s resolution read deliberately stays on the working tree** (AC4). Recorded in
  `directiveRemoveFn`'s step 3, so the next reader does not "finish the job" and turn an accurate
  refusal into `unknown directive: <id>`.
- **The pinned fit criteria are untouched.** `unknown directive: <id>` (P3.2 Sc.3),
  `unknown role '<role>' (not defined in dna.yaml)` (P3.2 Sc.2),
  `cannot remove '<id>': still assigned to role '<role>'` (P3.3 Sc.2) and task-052's `global` variant
  are all byte-identical, and no new message is appended to any of them (`D3`).
- **Exit `1` for every refusal** (`CoreResult.error`, codes `VALIDATION`/`NOT_FOUND`/`CONFLICT`, all
  mapped to `1` by `exitCodeForError`), per `spec-005` §1 and AC3. Not re-argued; `bug-076` ruled it.
- **Three sentences this pass made stale, fixed in the same pass**: `checkAssignable`'s module-header
  bullet ("every directive id must exist **on disk**"), and two test comments that described the
  asymmetry as a live finding (`directive-assign.test.ts`, `directive-assign-role-baseline.test.ts`).
  `directives-list.ts`'s "files on disk" wording is **not** stale — that operation is a report of the
  working tree and stays one (`D5`).

Full suite after green: `npx jest` → **125 suites, 1949 tests passed**, exit 0. No existing test
changed, and none broke.

### refactor — role: developer

No behaviour added; the coverage the green step owed, plus one design correction the coverage run
surfaced.

- **`loadDirectivesAtHead` now returns `DirectiveFile[]`, not `DirectiveFile[] | null`.** The first
  coverage run left the `?? []` in `checkAssignable` half-covered, and the reason was not a missing
  test: that branch is **unreachable through the verb**, because `loadDnaYamlAtHead` has already
  refused when `HEAD` does not resolve. Rather than reach it with a spy, the `null` was removed from
  the loader: for *this* pillar "`HEAD` does not resolve" and "`HEAD` commits no directive file" are
  the same fact — the repository records no directive — and both produce the same refusal. The
  distinction stays where it is load-bearing, in `listPathsAtRev` itself, and is documented on both.
  (`export { ROLES_YAML_PATH }` from `directive-assign.ts` went the same way: nothing imports it from
  there since the call sites shrank, and a CommonJS re-export compiles to a getter that no test can
  call — an uncovered "function" that would have been noise, not signal.)
- **The two committed-baseline loaders are tested directly**, mirroring task-091's block for
  `loadMemoryYamlAtHead`: the committed tree against a dirty working tree; a non-Markdown entry under
  `directives/` skipped (`.gitkeep` is not hypothetical — `wingfoil init` scaffolds one, spec-011);
  `[]`/`null` in a repository with no commits; and that `DirectiveFile.path` is spelled **identically**
  by both loaders, asserted by comparing them in one expectation, so `requireCustomAsset` and
  `selectDirectivesById` cannot start seeing two shapes.
- **A defect in a committed read must never become a domain answer.** A non-`ValidationError` out of
  `loadDirectivesAtHead` / `loadRolesYamlAtHead` must propagate rather than turn into
  `unknown directive` or "nothing references it" — pinned on both surfaces with a `jest.spyOn` on the
  loaders module, the same property and the same technique task-090/task-091 used.
- **One more spy, for the one branch nothing else can reach**: a blob `listPathsAtRev` just listed
  that `readPathAtRev` then cannot read (a ref moving between the two calls). It is skipped, which is
  the fail-closed answer, and the test says so.
- **Not a new instance of `bug-093`** (`open`, filed while this wave ran): `listPathsAtRev` uses
  `probeGit`, so git's `fatal: Not a valid object name HEAD` on an unborn `HEAD` — the ordinary case
  for this primitive — never reaches the operator's terminal. Checked deliberately, since the new
  code is a git call in exactly the class that bug is about.

#### Coverage — measured on both sides, not quoted

Baseline taken by running `npx jest --coverage` in a detached worktree at this branch's base
(`02b77f9`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `02b77f9` | 98.71 | 93.52 | 98.90 | 99.24 | 1909 |
| this branch | **98.72** | **93.60** | **98.91** | **99.25** | 1956 |

No metric regressed; all four are up. `src/core/directive-assign.ts` is at **100 / 100 / 100 / 100**;
`src/storage/commit.ts` at **100 / 94.11 / 100 / 100** (its one uncovered branch, the `?? ''` at
`commit.ts:127`, is pre-existing and was measured on the base run too). `src/core/loaders.ts`'s
uncovered statements are exactly the four the base run reported (`29`, `105`, `139`, `142` — the
`listMarkdownFilesSorted` early return and `parseDnaYaml`'s YAML-error re-wrap), compared
line-for-line between the two `coverage-final.json` files rather than eyeballed.

#### AC3/AC4 — the AC2 reproductions re-run against the fixed build

```
# assign, same scratch recipe, ghost.md untracked
$ node dist/cli.js directive assign --directive ghost --role developer
error: unknown directive: ghost                                                  exit 1
$ git log -1 --format='%s'   ->  chore(wingfoil): initialize …      # nothing written
$ git add -- .wingfoil/directives/custom/ghost.md && git commit -q -m 'chore: add ghost'
$ node dist/cli.js directive assign --directive ghost --role developer           exit 0
$ git show HEAD:.wingfoil/roles.yaml | grep -c ghost           ->  1
$ git cat-file -t HEAD:.wingfoil/directives/custom/ghost.md    ->  blob
# the binding and the file it names are now in the same committed record.

# remove, same scratch recipe, the unbinding uncommitted
$ sed -i '/- determinism/d' .wingfoil/roles.yaml
$ git status --porcelain -- .wingfoil/roles.yaml   ->   M .wingfoil/roles.yaml
$ node dist/cli.js directive remove determinism
error: cannot remove 'determinism': still assigned to role 'architect'           exit 1
$ test -e .wingfoil/directives/custom/determinism.md   ->  PRESENT
$ git add -- .wingfoil/roles.yaml && git commit -q -m 'chore: unbind determinism'
$ node dist/cli.js directive remove determinism                                  exit 0
$ git show --name-only --format='' HEAD  ->  .wingfoil/directives/custom/determinism.md

# AC4 — an untracked directive file is still refused by the WRITE guard, not by the read
$ node dist/cli.js directive remove ghost2
error: refusing to commit .wingfoil/directives/custom/ghost2.md: … [git status '??'] …     exit 1
$ test -e .wingfoil/directives/custom/ghost2.md   ->  PRESENT
```

#### D5 re-measured against the fixed build (`dl-042`'s warnings channel)

```
$ rm .wingfoil/directives/custom/traceability.md          # working-tree deletion only
$ node dist/cli.js directives list --role architect --format json
… "warnings":["directive 'traceability' bound to role 'architect' has no directive file"]
$ node dist/cli.js directive assign --directive ghost2 --role developer
error: unknown directive: ghost2                                                 exit 1
$ node dist/cli.js directives list --role developer --format json | grep -c ghost2   ->  0
```

Still reachable from the read-only report; no longer manufacturable by `assign`. Neither dead nor
changed in meaning — see `D5`.

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git -C /home/robypomper/Workspaces/WingFoil2 log --oneline -1 main
1d5abda docs(self): bug-094 — withdraw the first half, lower severity to low
$ git merge main            ->  merge commit 7a00351
$ git log --oneline main~4..main
1d5abda docs(self): bug-094 …      7d842a1 docs(plans): retrospective v0.2 …
480b323 wf(bug): sync bug-092 …    a67ff7c docs(self): bug-080 …
```

`main` moved by four commits while this task ran, **all of them under `docs/self/`** — no `src/` or
`test/` change, so nothing merged can interact with this branch's code and every gate below was run
*after* the merge. `bug-093` (new on `main`) is checked against this task's new git call above.

#### Gates (run in this worktree, after the merge)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **125 suites, 1956 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.72 / 93.60 / 98.91 / 99.25** — every metric above base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| **Emitting build** | `npx tsc -p tsconfig.build.json` (after `rm -rf dist`) | exit **0**, `dist/cli.js` produced |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** (`bug-026` stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

BDD acceptance scenarios touched by this change, and the tests that cover them:

| BDD scenario | Test that covers it |
|---|---|
| P3.2 sc.1 *Assign a directive to a role* | `test/core/directive-assign.test.ts` (unchanged, green — its fixture commits the scaffold) + `directive-inventory-baseline.test.ts` "AC5: assigning a COMMITTED directive to a COMMITTED role still works, in one scoped commit" |
| P3.2 sc.2 *Error — assigning to a role not defined in DNA* | `test/core/directive-assign-role-baseline.test.ts` (unchanged) + `directive-inventory-baseline.test.ts` "AC5: task-091's `--role` check is unchanged" |
| P3.2 sc.3 *Error — assigning a non-existent directive* | `test/core/directive-assign.test.ts` (unchanged) + `directive-inventory-baseline.test.ts` "AC3/AC6: an UNTRACKED directive file cannot be bound" and "AC5: an unknown directive id is still reported with P3.2 Sc.3 wording, verbatim" |
| P3.3 sc.1 *Remove an unreferenced custom directive* | `test/core/directive-remove.test.ts` (unchanged) + "AC5: removing a directive whose reference was removed AND COMMITTED still works, in one scoped commit" |
| P3.3 sc.2 *Error — removing a directive still referenced* | `test/core/directive-remove.test.ts` (unchanged) + "AC3/AC6: an UNCOMMITTED unbinding does not permit removal" and its `global` twin |
| P3.3 sc.3 *Error — removing a built-in directive* | `test/core/directive-remove.test.ts` (unchanged) + "AC5: REQ-SEC-07 clause (a) still fires first for a built-in" |
| P3.7 sc.1/2/3 *multi-directive assignment* | `test/core/directive-assign.test.ts` (unchanged) — `checkAssignable` still validates every id before anything is written, now against the committed inventory |
| P3.4 / dl-042 *directives list warnings* | `test/core/directives-list.test.ts`, `test/core/context.test.ts` (both unchanged) + the two `D5` cases in `directive-inventory-baseline.test.ts` |
| P5.1.1 *fresh init* | `test/cli/fresh-init-transitions.test.ts`, `test/core/init-project.test.ts` (unchanged) + `directive-inventory-at-head.integration.test.ts` "`init` commits the whole directives tree and roles.yaml" |

### review-ready summary — role: reviewer

**What changed, in one sentence.** Which directives exist, and what still references them, were both
read from the files on disk — so an untracked file could be bound into a permanent `roles.yaml` no
clone can resolve, and an **uncommitted** deletion of a reference was enough to make the one verb
that deletes an artefact destroy a file the committed `roles.yaml` still bound; both now resolve
against the repository as committed at `HEAD`, through a new `src/storage` primitive that lists a
directory at a revision, and neither `checkAssignable` nor `checkUnreferenced` accepts a parsed
document from its caller any more, so no call path can reach either decision with a working-tree
file.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 the missing primitive first, in `src/storage`, with its own tests and TSDoc | done | `listPathsAtRev` (`src/storage/commit.ts`, beside `readPathAtRev`) + `test/storage/list-paths-at-rev.test.ts` (12 cases, testing it directly). `design` § D1 records every decision and what else could use it |
| AC2 reproduce both halves first, on scratch projects, commands in the notes | done | `design` § AC2 — both transcripts, `remove`'s showing the file gone and `git show HEAD:.wingfoil/roles.yaml \| grep -c` still `2` |
| AC3 both reads resolve at `HEAD`, task-091's shape, refusals exit `1` | done | `design` § D2/D4; `green` § — both signatures changed, enforced by the type checker. Every refusal is `VALIDATION`/`NOT_FOUND`/`CONFLICT` → exit `1`, pinned at the process boundary |
| AC4 establish and argue the uncommitted directive file | done — **refuse, and it already does** | `design` § AC4: measured first, argued on three grounds, and the live risk (turning an accurate refusal into `unknown directive`) is what kept `remove`'s *resolution* read on the working tree. Recorded in `directiveRemoveFn`'s TSDoc step 3 and pinned by two tests |
| AC5 the ordinary flows, each pinned | done | seven characterization cases plus the write → commit → assign sequence; every pre-existing directive suite unchanged and green |
| AC6 tests pin both defects and fail against current code | done | `red` § — 24 failed / 13 passed before, 37 passed after; commands recorded |
| AC7 all six gates green, full `tsc --noEmit` silent | done | `refactor` § Gates — seven rows, including the **emitting** build |

**Weak spots a reviewer should check**

1. **Two behaviour changes in the permissive direction**, one per half, both pinned by tests: a
   directive committed at `HEAD` but deleted in the working tree is still assignable, and a binding
   that exists only in the working tree no longer blocks a removal. Both are correct under `dl-080`
   (B) and both are the same shape as task-091's M2, but they are the cases where the new baseline
   *permits* where the old refused — and on the `remove` side that means a file gets deleted. What
   bounds the risk: after this change anything `remove` deletes is by construction committed and
   clean (task-092's guard), so it is always recoverable from git.
2. **`remove`'s resolution read deliberately stays on the working tree** (AC4). Argued and measured,
   but it is a judgement: a reviewer may prefer one baseline for the whole verb, at the cost of
   answering an untracked file with `unknown directive: <id>`.
3. **No working-tree diagnostic on either new refusal** (`D3`), reversing task-091's `D5` habit. Both
   refusal messages are BDD-pinned wording, and on `remove` a note would coach the user toward
   deleting a file. Deliberate; a reviewer may take the opposite view.
4. **Three `jest.spyOn`s**, each reaching a defensive branch nothing an argument can produce. They
   pin real properties — a defect in a read must never become a domain answer, and a blob that
   vanishes mid-read is skipped rather than parsed as empty — but module spying is worth a second
   opinion. task-091 flagged the same.
5. **One git process per committed directive file.** `loadDirectivesAtHead` is one `ls-tree` plus one
   `git show` per entry — eleven processes on a fresh Scrum scaffold, on a command that already
   spawns several. It is only paid on `directive assign`, a rare, interactive, already-committing
   command, and `git cat-file --batch` would trade that for a long-lived child process and a binary
   protocol. Measured cost, not an oversight; if `directives list` ever moves to this baseline it
   should be revisited.
6. **`ROLES_YAML_PATH` moved** from `src/core/directive-assign.ts` to `src/core/loaders.ts` (beside
   `DNA_YAML_PATH`/`MEMORY_YAML_PATH`) and is now exported from the `src/core` barrel. No importer
   outside `src/core` existed, and none changed.

**Files touched outside the task file:** `src/storage/commit.ts` (append-only, a new section at the
end), `src/storage/index.ts` (one export line), `src/core/loaders.ts`, `src/core/directive-assign.ts`,
`src/core/index.ts`, two new test files, one new CLI integration test, and two one-comment edits in
existing directive suites.

**Merge note for the orchestrator** (brief rule: say where to look). In `src/core/index.ts` this
branch changes **import lines**: `loadRolesYaml` and `ROLES_YAML_PATH` are removed from two import
statements and `type { RolesYaml } from '../directives/schema'` is deleted outright, while the
`export { … } from './loaders'` block gains four names. That is exactly the region where merging
task-092 into task-091 produced a clean-but-broken merge. Everything else in that file is inside
`directiveAssignFn` / `directiveRemoveFn` and their TSDoc. `src/storage/commit.ts` is a pure append
after `changedPathsBetween`. The full `npx tsc -p tsconfig.build.json` was run after merging `main`
and is the check that catches this class.

**Out of scope, proposed rather than fixed** (no Memory elements created here; parallel worktrees
would collide on ids). Listed in this run's final report: `directive remove`'s resolution read
answering `unknown directive: <id>` for a directive committed at `HEAD` but deleted in the working
tree; and `dl-080` Action 4, still unowned.

### post-submit — role: developer

`main` advanced by two more commits between the gate run above and the submit
(`8a0a49f` + `c866743` — `bug-095-concurrent-jest-runs-in-one-worktree-corrupt-dist`, added and
submitted). Merged (`1d9c65b`). Both are under `docs/self/` and neither touches `src/` or `test/`
(`git diff --stat 1d5abda..main -- src/ test/` → empty), so the gate table above still describes this
branch's code; the "moved by four commits" sentence in the sync section is corrected here rather than
left standing as six.

### review corrections — role: developer

Two corrections in place, chosen by the approver over another cycle. The task stays `in-review`.

#### C1 — the `-z` "decision worth naming, each of which is a test" was not one

The `refactor` §/`design` § D1 claim that every `listPathsAtRev` decision is pinned by a test. For
`-z` that was false, and the TSDoc stated the reason wrongly: it said git C-quotes **any path
containing a space**. Re-measured here rather than taken on report, against `git 2.43.0`, on a tree
holding five deliberately awkward names:

```
$ git ls-tree -r --name-only --full-tree HEAD -- d      # no -z
"d/caff\303\250.md"
"d/has\"quote.md"
d/plain.md
"d/tab\tin.md"
d/two words.md
$ git ls-tree -r -z --name-only --full-tree HEAD -- d | tr '\0' '\n'
d/caffè.md
d/has"quote.md
d/plain.md
d/tab	in.md
d/two words.md
$ git config --get core.quotePath      ->  (unset -> default true)
```

git quotes a name for a byte outside printable ASCII, a control byte, a `"` or a `\`. **A space is
not quoted** — so `two words.md`, the one example the test used, is precisely the one that cannot
demonstrate the property.

**The mutation, run both ways, in this worktree.** Two mutations, because the crude one and the
realistic one measure different things:

```
# A — crude: drop `-z`, leave the split on '\0'
Tests:       9 failed, 3 passed, 12 total
```

That is record *parsing* collapsing (one NUL-free blob), not the quoting property — it would fire for
any reason at all, so it is not evidence the pin works.

```
# B — realistic: drop `-z` AND change .split('\0') to .split('\n'), the
#     "equivalent simplification" a later maintainer would actually write
Tests:       1 failed, 11 passed, 12 total
  ● listPathsAtRev … › returns an awkward path verbatim, never git-quoted (the `-z` pin)
    Expected value: ".wingfoil/directives/custom/caffè.md"
    Received array: ["\".wingfoil/directives/custom/caff\\303\\250.md\"",
                     "\".wingfoil/directives/custom/has\\\"quote.md\"", …]
```

Exactly one failure, and it is the pin. Then the control that settles whether the fixture was the
problem — the **original space-only test body**, restored verbatim, under that same mutation B:

```
Tests:       12 passed, 12 total
```

Twelve green with `-z` removed. The old pin protected nothing, and a later simplification would have
silently mis-spelled every directive filename outside ASCII.

Fixed: the fixture is now `caffè.md` **and** `has"quote.md` — two independent quoting triggers, so a
change in git's handling of either still fails — the assertion also rejects any `\` in the output,
and both the test comment and the `listPathsAtRev` TSDoc now state what git actually quotes, naming
the space as the trap. The flag itself was right and is unchanged.

*A process note I am recording against myself, since it is the same class of error twice.* The green §
says "each of which is a test" about six decisions and I verified the other five by running them; for
this one I asserted the mechanism (`-z` prevents quoting — true) and never checked that my fixture
**triggers** it. A test can be green, meaningful-looking, and pin nothing. The cheap guard is the one
used above: mutate the line the test claims to protect and watch it fail, which takes one command.

#### C2 — `ROLES_YAML_PATH`'s TSDoc described a re-export the refactor had deleted

The green § moved the constant to `loaders.ts` and re-exported it from `directive-assign.ts`; the
refactor § deleted that re-export (a CommonJS re-export compiles to a getter no test can call). The
TSDoc kept the green-step wording, so the two notes contradicted each other and the code agreed with
neither:

```
$ grep -rn 'ROLES_YAML_PATH' src/
src/core/index.ts:84:          ROLES_YAML_PATH,                      # barrel export, from ./loaders
src/core/directive-assign.ts:73:  ROLES_YAML_PATH,                   # an IMPORT from ./loaders
src/core/loaders.ts:339: export const ROLES_YAML_PATH = …           # the definition
… plus four use sites in directive-assign.ts, two in loaders.ts — no `export {` anywhere
```

The sentence now says what is there: the constant lives in `loaders.ts`, `directive-assign.ts`
imports it like any other caller, and the `src/core` barrel exports it from `loaders.ts`.

#### Not done here, deliberately

The AC4 exception — `remove`'s resolution read staying on the working tree — rests on a *resolution
read vs gate read* distinction that `dl-080` option (B) does not contain, so it needs recording as a
decision rather than as TSDoc. That is `task-094`'s, not this task's. The explanation in
`directiveRemoveFn`'s step 3 stays as it is. The reviewer also checked the direction I did not: a
directive committed at `HEAD` but **deleted in the working tree** answers `unknown directive`, where a
strict-`HEAD` read would have said something accurate — so the exception buys one good message and
costs another, and `task-092`'s guard decides destruction after both either way. That is the same
trade my "Proposed elements" entry named, now measured from both sides.

#### Gates re-run after both corrections

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **125 suites, 1956 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.72 / 93.60 / 98.91 / 99.25** — identical to the pre-correction run, still above base `02b77f9` on all four |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| **Emitting build** | `npx tsc -p tsconfig.build.json` (after `rm -rf dist`) | exit **0**, `dist/cli.js` produced |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

Both corrections are documentation and test-fixture changes; no `src/` behaviour changed, which is
why the coverage figures are unchanged rather than merely close.

#### Third `main` sync — this one carries the sibling branches, so the gates were re-run against it

The two syncs recorded above were docs-only. This one is not: between the corrections and now, `main`
took `task-093`, `task-095` and `task-097` (and `task-094`'s evidence commit) — **39 files, real
`src/` and `test/` changes**, including the `src/core/index.ts` region this branch's merge note flags.
Merged (`96db97e`), no textual conflict, and then re-verified rather than assumed, because a clean
merge is exactly what `task-092`-into-`task-091` also produced:

| Gate | Command | Result on the merged tree |
|---|---|---|
| **Emitting build** (run first — it is the check that catches a clean-but-broken merge) | `npx tsc -p tsconfig.build.json` after `rm -rf dist` | exit **0**, `dist/cli.js` produced |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, **no output** |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Full suite | `npx jest` | **135 suites, 2202 tests passed**, exit 0 |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

Coverage is re-baselined, because the earlier base (`02b77f9`) is no longer the tree this branch sits
on. Measured on both sides again, in a detached worktree at `main` `bfd1b2a` (since removed):

| | Stmts | Branch | Funcs | Lines | Suites / Tests |
|---|---|---|---|---|---|
| new base `bfd1b2a` (main, with 093/095/097) | 98.54 | 93.75 | 98.90 | 99.38 | 129 / 2125 |
| this branch merged onto it | **98.57** | **93.87** | **98.92** | **99.39** | 135 / 2202 |

No metric regressed against the new base either; the earlier `98.72 / 93.60 / 98.91 / 99.25` pair is
left in place above as what was true of the older tree, not silently overwritten.
