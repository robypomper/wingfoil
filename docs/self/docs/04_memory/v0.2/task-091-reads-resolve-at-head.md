---
id: "task-091-reads-resolve-at-head"
type: task
title: "Resolve the state machine and the role catalogue from the committed repository, per dl-080's ratified read rule"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "directives", "security", "audit-trail"]
ref: "dl-080-which-baseline-each-command-reads"
bug: ["bug-081-memory-yaml-read-from-worktree-fabricates-states", "bug-082-directive-assign-validates-role-against-worktree"]
depends_on: ["task-090-fix-approval-authority-baseline"]
tmpl_version: 260703
---

## Description

`dl-080-which-baseline-each-command-reads` is `ready`, ratified as option **(B)**: **a read that gates
an operation resolves against the repository as committed at `HEAD`**, and a write refuses while its
target carries modifications it does not own. This task lands the **read** half for the two remaining
instances.

- **`bug-081`** (`critical`): the state machine is read from the working tree, so an uncommitted
  `memory.yaml` edit decides what transition a verb performs and what status it writes — through
  `memory submit`, which is **ungated** — and leaves the element in a status the committed machine
  rejects, so no verb can move it afterwards.
- **`bug-082`**: `directive assign` validates `--role` against the working-tree role catalogue and
  commits a `roles.yaml` binding to a role the committed `dna.yaml` does not define, breaking
  **REQ-SYS-08**'s referential integrity.

Both are release blockers for `minor-v0.2`. `task-090` already did this for the authority read and is
the pattern to follow: it changed the **baseline** rather than adding a guard, by removing the
parameter through which a working-tree document could reach the decision at all.

## Acceptance Criteria

- **AC1** — Reproduce both defects first, on scratch projects, against a build of current `main`, and
  record the commands. A scratch project is required — `bug-075` means the verbs cannot be pointed at
  this repository's own Memory. `bug-081`'s reproduction must show the fabricated status **committed**
  and the element unmovable afterwards; `bug-082`'s must show the committed `dna.yaml` lacking the role
  the committed `roles.yaml` now binds.
- **AC2** — After the fix, both reads resolve at `HEAD`. Follow `task-090`'s shape: make the
  working-tree document **unreachable** from the decision rather than guarding against it, so no
  present or future call path can reintroduce the defect. If that is not possible for one of the two,
  say why in the design notes rather than substituting a guard silently.
- **AC3** — Refusals exit **`1`**, per `spec-005` §1 as ruled on `bug-076`: a well-formed invocation
  failing validation. Not `2`.
- **AC4** — **The bootstrap and the ordinary flows must still work**, each pinned by a test:
  `wingfoil init` commits the scaffold, so `HEAD` always carries a `memory.yaml`; a project whose
  committed machine is valid must transition normally; and adding a role then committing it then
  assigning a directive to it must succeed. Establish what an **absent or unreadable committed**
  `memory.yaml` means and choose fail-closed or fail-open deliberately — `task-090` chose fail-closed
  for `dna.yaml` and its reasoning is the precedent, not the rule.
- **AC5** — Sweep for **other** gating reads with the same baseline: the workflow layer, directive
  resolution, anything that decides whether an operation is legal. Report each with the command that
  settles it. Fix what this task's argument covers; list the rest as proposed elements.
- **AC6** — Tests pin both defects and fail against the current code. State the command showing each
  red before and green after.
- **AC7** — Nothing in this repository's own history is re-verified against the new rule or rewritten
  (`dl-035`).
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-090`'s Execution Notes first (`dl-015` read_related): the baseline-versus-guard argument,
  the `loadDnaYamlAtHead` shape, and the fail-closed reasoning are all there, and `dl-080`'s
  ratification cites them.
- `bug-081` is the one to fix first inside this task: it is `critical`, reachable without authority,
  and it strands artefacts.
- `bug-082` may be the harder design: a role catalogue is legitimately extended while assigning, and
  under `dl-080`(B) that becomes edit, commit, then assign. That is accepted and is not this task's to
  re-litigate — `dl-081` ratified the verbs that will make it one command, and `task-093` builds them.
- Classify every AC per `dl-014`/T1. AC1, AC2, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->

### start — role: developer

`status: backlog → in-progress` (`c4a5aed`). `bug:` names two bugs, so `bug.sync_state` ran as its own
commit: `bug-081` and `bug-082` `planned → in-progress` (`a90075d`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-091`, branch `task/task-091-reads-resolve-at-head`,
from `main` at `eca728e` — which contains `task-090`'s merge, the precondition every AC rests on.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-090-fix-approval-authority-baseline` (`done`) — Execution Notes read in full**, the only
  entry in `depends_on`. What I took from it:
  1. **The shape, and why it is a shape rather than a check.** Its `green` § states the fix "is in the
     signature, not next to the call": `requireApprovalAuthority(root, typeName)` no longer accepts a
     `DnaYaml`, "so a caller cannot hand this function a working-tree configuration even by accident".
     Both fixes below copy that literally — each removes the parameter through which a working-tree
     document reaches the decision (`D1`, `D2`), and neither adds a guard beside an unchanged read.
  2. **The primitives.** `loadDnaYamlAtHead` / `DNA_YAML_PATH` (`src/core/loaders.ts`) and the
     `readPathAtRev(root, 'HEAD', <path>)` git read (`src/storage/commit.ts`, task-088). The Memory
     half needs the same pair for `memory.yaml`, which is why `D1` adds `loadMemoryYamlAtHead`
     alongside it rather than inventing a second mechanism.
  3. **`loadDnaYamlAtHead` is deliberately NOT on `src/core`'s public surface**, "because making it
     public would advertise 'read the committed version' as a general facility before the general
     rule has been decided". That rule is now decided — `dl-080`, ratified as (B) — so the reason for
     keeping it private has expired; `D3` records what I did about that and why.
  4. **Fail-closed, and that it is a precedent and not a rule** (this task's AC4 says exactly that).
     task-090 refuses when `HEAD` holds no `dna.yaml` and when the committed one does not parse.
     `D4` re-derives the answer for `memory.yaml` rather than inheriting it.
  5. **The diagnostic that never decides.** `workingTreeWouldGrant` appends a second sentence only
     when the user's screen and the repository disagree, and returns `false` on any failure so an
     unreadable working-tree file cannot change an outcome owned by `HEAD`. `D5` reuses that idea on
     both surfaces — and it matters more here: `bug-081`'s own Notes say `memory.yaml` "is the file an
     author edits while designing a new type or machine, and a half-finished edit is an ordinary
     state to be in".
  6. **The measurement gotcha.** `execFileSync` + `catch` reads back `stderr: ''` for a command that
     exits `0` while printing to fd 2, so CLI-level assertions use `spawnSync`. Reused.
  7. **Its own AC5 findings are this task's subject.** task-090's `refactor` § AC5 measured both
     defects and filed them; `bug-081` and `bug-082` are those two transcripts. AC1 below re-derives
     them from scratch rather than pasting.
- **`dl-080-which-baseline-each-command-reads` (`ready`) — read in full, together with its approve
  commit `333a3c0`.** The ratification settles four things this task would otherwise re-open: (B) is
  the rule; `bug-082`'s cost — "extending the role catalogue becomes edit, commit, then assign" — is
  "accepted knowingly"; the residual awkwardness "is a missing verb and not this rule" (`dl-081` /
  `task-093`, in flight in parallel); and `bug-076`/`bug-079` are not reopened. Nothing below
  re-argues any of them.
- **`bug-081` (`critical`) and `bug-082` (`high`) — read in full.** `bug-082`'s Notes argue against
  its own fix ("the natural remedy is not necessarily 'read the committed `dna.yaml`'"); that argument
  was heard and rejected at ratification, so it is recorded here as history, not as an open question.

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one; everything this task enforces is already
written down.

- **`dl-080`** (`ready`, read at `eca728e`) is the rule itself and needs no spec to exist.
- **`spec-005-cli-command-contract`** § "1. Exit-code contract (REQ-INT-04)" — **not** amended: every
  refusal added here is a well-formed invocation failing a repository-state precondition, i.e. exit
  `1` (AC3; ruled on `bug-076`, restated by `task-090`).
- **`spec-001-memory-yaml-schema`** — untouched: this task changes no schema, only which copy of
  `memory.yaml` the transition verbs parse.
- **REQ-SYS-08** (`docs/02_requirements/03_sard/01_architecture.md`) is what `bug-082` breaks, and
  P3.2's fit criterion `unknown role '<role>' (not defined in dna.yaml)` stays the verbatim first
  sentence of the refusal (`green`).
- **`adr-006-git-identity-role-based-authz`**'s fresh-clone consequence is the deciding principle
  `dl-080` inherited; it is cited, not amended.

`design` gate state: `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied above; `tech-spec.approved` — no spec scaffolded, so the approver gate passes through.

#### AC1 — both defects reproduced, before any `src/` change

Built this branch at its base (`npm run build`, exit 0 — no `src/` edit yet, so `dist/` is `main` at
`eca728e`), then throwaway projects under the session scratchpad. A scratch project is required:
`bug-075` means the verbs cannot be pointed at this repository's own Memory.

**`bug-081` — an uncommitted machine decides the transition, and the element is then stranded.**

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum          # exit 0; commits the scaffold, team.members: []
$ node dist/cli.js memory add --type adr --title 'Probe'        -> adr-001-probe
# uncommitted edit to .wingfoil/memory.yaml: defaults.states.sequence
#   [ draft, pending, approved ] -> [ draft, FABRICATED-BY-SUBMIT, approved ], gates key renamed to match
$ git status --porcelain
 M .wingfoil/memory.yaml
$ node dist/cli.js memory submit adr-001-probe
{ "id": "adr-001-probe", …, "from": "draft", "to": "FABRICATED-BY-SUBMIT" }        exit 0
$ git log -1 --format='%s'                    ->  wf(adr): submit adr-001-probe
$ grep -m1 '^status:' docs/memory/adr/adr-001-probe.md
status: FABRICATED-BY-SUBMIT
$ git show HEAD:.wingfoil/memory.yaml | grep 'sequence: \[ draft'
    sequence: [ draft, pending, approved ]
$ git checkout .wingfoil/memory.yaml
$ node dist/cli.js memory approve   adr-001-probe --reason t   -> error: invalid state … ; exit 1
$ node dist/cli.js memory submit    adr-001-probe              -> error: invalid state … ; exit 1
$ node dist/cli.js memory deprecate adr-001-probe --reason t   -> error: invalid state … ; exit 1
```

The fabricated status is **committed**, and afterwards **no verb can move the element** — `deprecate`
included, which is the escape hatch one would reach for. `team.members: []` throughout: nobody is an
approver and none is needed.

**`bug-082` — a committed binding to a role no committed `dna.yaml` defines.**

```
$ node dist/cli.js init --template scrum >/dev/null
# uncommitted edit adding `- name: FABRICATED-ROLE` to team.roles in .wingfoil/dna.yaml
$ git status --porcelain
 M .wingfoil/dna.yaml
$ node dist/cli.js directive assign --directive determinism --role FABRICATED-ROLE     exit 0
$ git log -1 --format='%s'          ->  wf(directive): assign determinism to FABRICATED-ROLE
$ git show HEAD:.wingfoil/roles.yaml | grep -A1 FABRICATED
  FABRICATED-ROLE:
    - determinism
$ git show HEAD:.wingfoil/dna.yaml | grep -c FABRICATED
0
```

#### AC4 — what `HEAD` actually carries after `init`, measured rather than assumed

```
$ node dist/cli.js init --template scrum && git show --name-only --format='%s' HEAD
chore(wingfoil): initialize .wingfoil/ with the Scrum template (P5.1.1)
… .wingfoil/dna.yaml
… .wingfoil/memory.yaml …                     # 27 files, one commit
$ git show HEAD:.wingfoil/memory.yaml | head -1
# Memory element schema (P1.13) — scaffolded by `wingfoil init`.
```

`init` commits the whole scaffold in one commit, so in any project that ran it, `HEAD` carries a
valid `memory.yaml` from the first commit onwards. The committed baseline is therefore available to
the very first `memory add`/`memory submit` a user runs — there is no bootstrap window in which the
Memory verbs would have nothing to read, which is the fact `D4` rests on.

#### AC2 — the two fixes

Both follow `task-090`'s shape: **remove the parameter**, so the working-tree document is unreachable
from the decision rather than guarded against. Neither needed the "if that is not possible, say why"
escape AC2 offers.

**D1 — `memory.yaml`: `prepareMemoryTransition` resolves its own committed machine.**

Today `prepareMemoryTransition(root, memoryYaml, id, op)` (`src/core/memory-transition.ts`) is handed
a `MemoryYaml` that each of the four verbs loads from the working tree
(`loadOrError(() => loadMemoryYaml(root))`, `src/core/index.ts`). The parameter goes: the function
takes `(root, id, op)` and resolves `loadMemoryYamlAtHead(root)` itself. After that no call path —
present or future — can reach `resolveStateMachine` / `validateFrontmatterState` /
`resolveTypeTransition` with a working-tree machine, because there is no argument through which one
could arrive.

*One baseline per verb, not one per read.* `memorySubmitFn` uses the loaded `memory.yaml` a second
time, for `types[type].template.frontmatter.required`. If `prepare` read `HEAD` and the verb kept its
own working-tree load, a single command would decide its transition from one copy and its required
fields from another — a split nobody could reason about. So the prepared result now carries the
`MemoryYaml` it used, and the verbs read their follow-up facts off that. The four `loadMemoryYaml`
pre-loads disappear; each verb got shorter.

*What this deliberately does not touch.* `memory add` (the type registry, `path`, `id_pattern`,
`template`), `memory search`, `memory history` and the MCP Memory Resources keep reading the working
tree. `search`/`history`/the Resources gate nothing — they report what the user has now. `memory add`
does gate a mutation, and it is a real finding of the same class, measured in AC5 below as **S1** and
filed rather than fixed: `bug-081` is about the state machine, and `memory add` never consults one
(it writes the literal `status: draft` from the scaffold — `renderAddDocument`, `src/core/index.ts`).
Fixing it here would be a silent scope extension over a verb with its own ordinary flow to weigh.

**D2 — the role catalogue: `checkAssignable` resolves its own committed catalogue.**

`checkAssignable(dna, directiveFiles, role, ids)` (`src/core/directive-assign.ts`) becomes
`checkAssignable(root, directiveFiles, role, ids)` and reads `loadDnaYamlAtHead(root)` — the same
removal, on the same grounds. `directiveAssignFn`'s `loadDnaYaml(root)` pre-load disappears with it
(that was its only consumer).

*The directive **inventory** in the same call is NOT changed*, and that asymmetry is deliberate rather
than overlooked: `checkAssignable`'s second half validates each `--directive` id against
`loadDirectives(root)`, the files on disk, and an uncommitted directive file produces a committed
binding to a directive no commit contains (AC5 **S2**, measured). It is the same class as `bug-082`
and it is filed, not fixed — reading the directive tree at `HEAD` needs a *directory* listing at a
revision (`git ls-tree`), a storage primitive that does not exist, and `dl-042`'s warnings channel
already surfaces the dangling result (`directives list` printed
`directive 'ghost' bound to role 'developer' has no directive file` in S2). Neither bug names it, so
it becomes an element.

**D3 — `loadMemoryYamlAtHead` and `loadDnaYamlAtHead` are now exported from `src/core`.**

task-090 kept `loadDnaYamlAtHead` off the public surface explicitly because "the general rule has not
been decided". `dl-080` decided it, so the argument for hiding it is gone, and the argument for
showing it has arrived: two pillars now read a committed baseline, a third (`memory add`, `directive
remove`) is filed to follow, and "read the committed version" is exactly the facility the ratified
rule tells the next implementer to use. Hiding it would now push the next one to re-derive it.

**D4 — an absent or unreadable committed `memory.yaml`: fail-closed, re-derived rather than inherited.**

Three arguments, of which only the second is shared with task-090:

1. **There is no bootstrap window to protect** (AC4 measurement above): `init` commits `memory.yaml`
   in the scaffold commit, so every project that can hold a Memory document already has a committed
   machine. Fail-open would be a tolerance with no legitimate flow behind it. (This is the point on
   which `memory.yaml` and `dna.yaml` genuinely differ: `dna.yaml` is committed by `init` too, but
   its `team.members` starts empty and must be seeded, which is why task-090 had a bootstrap flow to
   argue about at all. Here there is none.)
2. **Fail-open is not "read the working tree", it is "decide with no machine at all".** A transition
   needs a `from → to`; with no committed machine the only fail-open option is to fall back to the
   working tree, which is the defect.
3. **The refusal is trivially repairable and says how** — `git add .wingfoil/memory.yaml && git commit`
   — whereas the artefact a fail-open produces is the stranded element `bug-081` is about, and that
   one is not repairable by any verb (AC1: all three verbs refuse it afterwards).

Both refusals are `VALIDATION` → exit `1` (AC3), before anything is written.

**D5 — a diagnostic on both surfaces, which never decides.**

Under a committed baseline the refusal a user sees can contradict the file open in their editor. That
was `task-090`'s one acknowledged cost of option (a), and it lands harder here because `memory.yaml`
is edited mid-design as a matter of course (`bug-081` Notes). So, exactly as `workingTreeWouldGrant`
does, a second sentence is appended **only** when the working tree and `HEAD` actually disagree — for
Memory, when `.wingfoil/memory.yaml` is dirty and the committed machine refused; for the role
catalogue, when the working tree defines the role and `HEAD` does not. It is computed after the
decision, it is `false`/absent on any read failure, and no branch of it can change an outcome.
REQ-SEC-03's and P3.2's fit-criterion sentences stay verbatim and first.

#### AC5 — the sweep: every gating read, with the command that settles it

Sweep command (every pillar-loader call site in `src/`):

```
$ grep -rn "loadMemoryYaml(\|loadDnaYaml(\|loadRolesYaml(\|loadWorkflowsYaml(\|loadDirectives(" \
      src/ --include=*.ts | grep -v "^src/core/loaders.ts"
```

Classified by whether the read **gates a mutation whose committed result depends on it** — the
`dl-080` (B) test. Everything below was measured on a scratch project against `dist/` built from
`main` at `eca728e`; none of it is argued from the source alone.

| # | Read | Gates | Same defect? | Command that settles it |
|---|---|---|---|---|
| — | `memory.yaml` → `prepareMemoryTransition` (`index.ts` `memorySubmitFn`/`memoryApproveFn`/`memoryRejectFn`/`memoryDeprecateFn`) | which transition is legal and the status written | **Yes — fixed here (D1)** | AC1 `bug-081` transcript |
| — | `dna.yaml` → `checkAssignable` (`directiveAssignFn`) | whether `--role` may be bound | **Yes — fixed here (D2)** | AC1 `bug-082` transcript |
| **S1** | `memory.yaml` → `memoryAddFn` (type registry, `path`, `id_pattern`, `template`) | whether the type exists and where the file lands | **Yes — filed, not fixed** | below |
| **S2** | `loadDirectives(root)` → `checkAssignable`'s id half (`directiveAssignFn`) | whether `--directive` may be bound | **Yes — filed, not fixed** | below |
| **S3** | `roles.yaml` + `loadDirectives(root)` → `checkUnreferenced` (`directiveRemoveFn`) | REQ-SEC-07 (b): whether a still-referenced asset may be deleted | **Yes — filed, not fixed; the worst of the three** | below |
| — | `dna.yaml` → `dnaSetFn` | its own write target | No — write side, `bug-078`/`task-092` | `grep -n "loadDnaYaml(root)" src/core/index.ts` → `:299` inside `dnaSetFn` |
| — | `dna.yaml` → `pathsFn`, `dnaShowFn`; `memory.yaml` → `memorySearchFn`, `memoryHistoryFn`; `roles.yaml`+directives → `directivesListFn`; every `src/mcp/*-resource.ts`, `src/mcp/prompt.ts` | nothing — read-only output | No gate | every one is `mutates: false` or an MCP Resource: `grep -n "mutates: true" src/core/index.ts` lists 7 rows, none of them these |
| — | **the workflow layer** | nothing | **No — there is no gating read to have.** `loadWorkflowsYaml` has exactly three call sites: the read-only `workflowList` operation (`wrapReadOnly(loadWorkflowsYaml)`) and two MCP Resources. There is no workflow engine and no mutating workflow operation | `grep -rn "loadWorkflowsYaml" src/ --include=*.ts` → `loaders.ts:152` (def), `index.ts:1404` (`wrapReadOnly`), `mcp/workflow-resource.ts:52,70` |
| — | `requireCustomAsset` (REQ-SEC-07 (a)) | `directive remove` | No — a pure path predicate, reads no config | `grep -n "readDocument\|loadDnaYaml\|loadRolesYaml\|loadMemoryYaml" src/core/builtin-asset.ts` → no match |
| — | `requireGitIdentity` (REQ-SEC-01) | every mutating op | No — git config is local by nature and can never be committed; it is "who is asking", and it is what the commit will record | `grep -n "readGitIdentity" src/core/git-identity.ts` |
| — | `verifyBuiltinTemplates` (`builtin-integrity.ts`) | `init` | No — compares the **packaged** templates against the scaffold it is writing; reads no repository config | `grep -rn "verifyBuiltinTemplates" src/ --include=*.ts` → `init.ts:40`, `index.ts:122` (re-export) |

**S1 — `memory add` against a type only the working tree defines.**

```
# uncommitted edit adding `fabricated-type` to types: in .wingfoil/memory.yaml
$ git status --porcelain -- .wingfoil/memory.yaml
 M .wingfoil/memory.yaml
$ node dist/cli.js memory add --type fabricated-type --title 'Probe'      exit 0
$ git log -1 --format='%s'          ->  wf(fabricated-type): add fab-001-probe
$ git show HEAD:.wingfoil/memory.yaml | grep -c fabricated-type          ->  0
$ git checkout .wingfoil/memory.yaml
$ node dist/cli.js memory submit fab-001-probe    -> error: document not found: fab-001-probe ; exit 1
```

A committed element of a type no commit defines, and stranded in the same way `bug-081` strands one —
`memory search --type fabricated-type` returns no match either. Not fixed here (D1).

**S2 — `directive assign` binds a directive file that exists in no commit.**

```
# .wingfoil/directives/custom/ghost.md written, never added
$ git status --porcelain
?? .wingfoil/directives/custom/ghost.md
$ node dist/cli.js directive assign --directive ghost --role developer    exit 0
$ git show HEAD:.wingfoil/roles.yaml | grep ghost        ->      - ghost
$ git cat-file -e HEAD:.wingfoil/directives/custom/ghost.md ; echo $?    ->  1 (in no commit)
$ rm .wingfoil/directives/custom/ghost.md && node dist/cli.js directives list --role developer
… "warnings": ["directive 'ghost' bound to role 'developer' has no directive file"]
```

Graded like `bug-082` and for the same reason: recoverable, and `dl-042`'s warnings channel already
surfaces it. Not fixed here (D2).

**S3 — `directive remove` deletes an asset the committed `roles.yaml` still binds (REQ-SEC-07 (b)).**

```
$ node dist/cli.js directive remove determinism
error: cannot remove 'determinism': still assigned to role 'architect'          exit 1   # control
# uncommitted edit deleting the two `- determinism` lines from .wingfoil/roles.yaml
$ git status --porcelain -- .wingfoil/roles.yaml
 M .wingfoil/roles.yaml
$ node dist/cli.js directive remove determinism                                  exit 0
$ git log -1 --format='%s'   ->  wf(directive): remove determinism
$ git show --name-only --format= HEAD   ->  .wingfoil/directives/custom/determinism.md
$ git show HEAD:.wingfoil/roles.yaml | grep -c determinism      ->  2
```

The commit **deletes the file** while the `roles.yaml` committed at that very commit still binds it
twice — an uncommitted edit walking past the one check REQ-SEC-07 clause (b) exists to enforce, on
the only verb in the system that destroys an artefact. I grade it above `bug-082`: `bug-082`
fabricates a reference, this one removes a referent, and the damage is a file rather than a line.
Not fixed here — `directive remove` is named by neither bug, and its fix has a second half to weigh
(the removal itself is a write whose target is a *different* file than the one read). Filed.

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce both, on scratch projects | **process gate, not testable** | The AC1 section above, run against `dist/` built at the branch base before any `src/` edit. AC6's tests are its durable form. |
| **AC2** — fix by removing the parameter, or say why not | **red-first** (its consequences) + **structural** | The *decision* is D1/D2; what a test can pin is that the working-tree copy no longer decides — the same tests as AC3/AC6. The unreachability itself is pinned by the type system: `prepareMemoryTransition` and `checkAssignable` no longer accept the document, so a call passing one does not compile (`tsc --noEmit` gate). |
| **AC3** — refusals exit `1` | **red-first** | Measured red: AC1 shows both paths exiting **0** today. `grep -rn "readPathAtRev\|AtHead" src/core/memory-transition.ts src/core/directive-assign.ts` → no match; nothing in either path reads a revision. |
| **AC4** — bootstrap + ordinary flows still work, each pinned | **split.** *Characterization*: `init` commits `memory.yaml` (already true — measured above; pinned by a test that reads `git show HEAD:.wingfoil/memory.yaml`); a project whose committed machine is valid transitions normally (the whole existing Memory suite does this on first run). *Red-first*: add-role → commit → assign (today the commit is not required, so the test that requires it is red on the "without committing" half); absent/unreadable committed `memory.yaml` → refuse (no such refusal exists today). |
| **AC5** — sweep the other gating reads | **process gate / investigation** | Table above; every row carries its command and the three live findings carry transcripts. Nothing fixed ⇒ nothing tested. |
| **AC6** — tests pin both defects, red before / green after | **red-first** | Same evidence as AC3; commands recorded under `red`. |
| **AC7** — this repository's history is not re-verified or rewritten | **process gate** | Negative obligation. `git log --oneline main..HEAD` touches no historical commit; every reproduction runs in a throwaway project (`bug-075`), and no test reads this repository's own Memory. |
| **AC8** — six gates green | **process** | Run at `refactor`/`review`. |
