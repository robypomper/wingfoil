---
id: "task-091-reads-resolve-at-head"
type: task
title: "Resolve the state machine and the role catalogue from the committed repository, per dl-080's ratified read rule"
status: done
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

### red — role: developer

Commit `bd3d06d`. Three new suites, no change to any existing one at this step:

- **`test/core/memory-machine-baseline.test.ts`** — the baseline at the `CoreFn` seam, driving the
  REAL registered `memory.memorySubmit` / `memoryApprove` / `memoryReject` / `memoryDeprecate`
  operations in throwaway repos: the `bug-081` edit (the committed machine decides, not the dirty
  one), a status only the dirty machine defines, all four verbs, the mirror case where the working
  tree *narrows* a machine `HEAD` sanctions, the single-baseline property on
  `template.frontmatter.required` (both directions), a type defined only in the working tree, the two
  AC4 fail-closed refusals, the clean-project flow, and the D5 diagnostic.
- **`test/core/directive-assign-role-baseline.test.ts`** — the same shape for `directive assign`:
  the uncommitted role, the *edit → commit → assign* flow, an already-committed role, the mirror
  case, the two fail-closed refusals, and that an unknown directive id still reports its own message.
- **`test/cli/reads-resolve-at-head.integration.test.ts`** — the two things only the process boundary
  shows: the exit code a script keys on and the stderr a human reads, through the compiled
  `dist/cli.js` in a real `wingfoil init` project, plus AC4's `init` measurement. `spawnSync`, per
  `task-086`'s gotcha (recorded in the file's TSDoc so the next reader does not "simplify" it back).

Observed red — AC6's command, before any `src/` change:

```
$ npx jest test/core/memory-machine-baseline.test.ts \
           test/core/directive-assign-role-baseline.test.ts \
           test/cli/reads-resolve-at-head.integration.test.ts
Test Suites: 3 failed, 3 total
Tests:       18 failed, 8 passed, 26 total
```

The 18 failures are the two defects. The 8 passes are exactly the cases T1 classifies as
characterization: `init` committing the machine; the clean-project transition chain; `deprecate` from
`draft` (its wildcard edge is legal under either machine, so this row of the `it.each` pins the read
rather than measuring a defect); the already-committed role; the *edit → commit → assign* flow (the
commit was not yet required, so the positive half already passed); `unknown directive: nope`; and
D5's clean-tree case, where there is no note to add.

### green — role: developer

Commit `a063cfe`. Four source files, one existing test call site updated.

| Change | Where |
|---|---|
| `MEMORY_YAML_PATH` (the root-relative POSIX path git wants) and `parseMemoryYaml(raw, filePath)` — the Memory two-pass parse lifted out of `loadMemoryYaml` so the same schema and the same error shapes serve bytes from any source; `filePath` becomes a **label** (`HEAD:.wingfoil/memory.yaml`), so an error names the baseline it came from | `src/core/loaders.ts` |
| `loadMemoryYamlAtHead(root): MemoryYaml \| null` — `readPathAtRev(root, 'HEAD', MEMORY_YAML_PATH)` (task-088's primitive) + that parse; `null` means "no commit of this repository contains that path". `loadDnaYamlAtHead`'s own TSDoc corrected where task-090 left it stale (it named one caller, and called itself an exception pending a rule that is now ratified) | same |
| `prepareMemoryTransition(root, id, op)` — **the signature changed**: it no longer accepts a `MemoryYaml` and resolves the committed one itself. Two fail-closed refusals (nothing committed; committed file unreadable), plus `uncommittedMachineNote`, a diagnostic that never decides. The machine it used rides `PreparedMemoryTransition.memoryYaml` | `src/core/memory-transition.ts` |
| the four transition verbs lose their `loadMemoryYaml` pre-load and pass `id` alone; `memorySubmitFn` reads `template.frontmatter.required` off `prepared.value.memoryYaml`, so one command has one baseline. Each verb's TSDoc step list says which baseline is read | `src/core/index.ts` |
| `checkAssignable(root, directiveFiles, role, ids)` — **the signature changed** the same way, resolving `loadDnaYamlAtHead` itself; two fail-closed refusals plus `workingTreeWouldDefine`, the D5 diagnostic | `src/core/directive-assign.ts` |
| `directiveAssignFn` loses its `loadDnaYaml` pre-load (its only consumer was `checkAssignable`); `loadDnaYamlAtHead`/`loadMemoryYamlAtHead`/`MEMORY_YAML_PATH` are exported from `src/core` (D3) | `src/core/index.ts` |
| the one existing caller that passed a working-tree `MemoryYaml` updated to the new signature | `test/core/memory-submit.test.ts` |

Design points worth naming:

- **Both fixes are in the signature, not next to the call.** Neither function can be handed a
  working-tree document any more, so AC2's "unreachable rather than guarded" is enforced by the type
  checker: a call that tried would not compile. That is also why the change is small — six call sites
  got *shorter*.
- **One baseline per command.** `memory submit` used to read `memory.yaml` twice (the machine, then
  the required fields). Carrying the committed document on the prepared result means a single command
  cannot decide two things from two copies — a split that would have been invisible and unarguable.
- **Both diagnostics fail to `false`/`''`.** `workingTreeWouldDefine` returns `false` on any failure
  to read or parse the working-tree `dna.yaml`; `uncommittedMachineNote` returns `''` if git cannot
  be asked. Both are pinned by tests, one of them with the only two spies in either suite.
- **The pinned fit criteria are untouched.** `invalid state '<s>' for type '<t>'`,
  `document not found: <id>`, `dl-032`'s illegal-transition contract message and P3.2's
  `unknown role '<role>' (not defined in dna.yaml)` all remain the verbatim **first sentence**; a note
  is appended only when the working tree and `HEAD` actually disagree. Every existing assertion that
  matches those messages with `===` runs on a clean fixture and still matches byte for byte.
- **Exit `1` for every refusal** (`CoreResult.error`, code `VALIDATION`/`NOT_FOUND`/
  `INVALID_TRANSITION`, all mapped to `1` by `exitCodeForError`), per `spec-005` §1 and AC3. Not
  re-argued; `bug-076` ruled it.
- **What deliberately keeps reading the live working tree**: `memory add`, `memory search`,
  `memory history`, `dna show`, `dna set`, `paths`, `directives list`, `directive remove` and the MCP
  Resources — see the AC5 table for which of those are findings (S1/S3) and which gate nothing.

Full suite after green: `npx jest` → **119 suites, 1862 tests passed**, exit 0.

### refactor — role: developer

Commit `39db535`. No behaviour added; the coverage the green step owed, plus the two properties it
asserted in prose and nowhere else.

- **`loadMemoryYamlAtHead` is tested directly** (`test/core/loaders.test.ts`, mirroring task-090's
  block for `loadDnaYamlAtHead`): `null` while the file is untracked; `HEAD`'s machine returned while
  the working tree says something else (the same call compared against `loadMemoryYaml` in one
  assertion); `ValidationError` for a committed file that does not validate while the working-tree
  copy is fine.
- **Neither diagnostic can decide.** An unreadable or unparseable working-tree `dna.yaml` leaves the
  refusal exactly as P3.2 words it; a failure to ask git for the working-tree status leaves the
  Memory refusal exactly as its fit criterion words it. The second is unreachable from the code (by
  then `readPathAtRev` has already succeeded), so it uses one `jest.spyOn` on `src/storage`.
- **A defect in the committed read propagates.** A non-`ValidationError` from `loadMemoryYamlAtHead`
  / `loadDnaYamlAtHead` must not be converted into "invalid state" or "unknown role" — pinned on both
  surfaces with a `jest.spyOn` on the loaders module, the same property and the same technique
  task-090 used on the authority read.

#### AC3/AC4 — the AC1 reproductions re-run against the fixed build

```
# bug-081, same scratch recipe, same dirty machine
$ node dist/cli.js memory submit adr-001-probe
{ "id": "adr-001-probe", …, "from": "draft", "to": "pending" }              exit 0
$ grep -m1 '^status:' docs/memory/adr/adr-001-probe.md      ->  status: pending
$ git checkout .wingfoil/memory.yaml
$ node dist/cli.js memory deprecate adr-001-probe --reason 'still movable'  exit 0
# …the element is NOT stranded: the status it carries is one the committed machine knows.

# and a document that already carries a fabricated status is refused, with D5's note:
$ node dist/cli.js memory submit adr-002-second
error: invalid state 'FABRICATED-BY-SUBMIT' for type 'adr' — note that '.wingfoil/memory.yaml'
carries uncommitted modifications and the state machine is read from the committed copy (dl-080);
commit '.wingfoil/memory.yaml' first if this transition depends on that change
$ echo $?    ->  1

# bug-082
$ node dist/cli.js directive assign --directive determinism --role FABRICATED-ROLE
error: unknown role 'FABRICATED-ROLE' (not defined in dna.yaml) — the working tree's
'.wingfoil/dna.yaml' defines it, but that change is not committed, and a binding is validated against
the committed catalogue (REQ-SYS-08, dl-080); commit '.wingfoil/dna.yaml' first, then retry
$ echo $?    ->  1
$ git log -1 --format='%s'   ->  chore(wingfoil): initialize …      # unchanged: nothing was written
$ git add .wingfoil/dna.yaml && git commit -q -m 'chore: extend the role catalogue'
$ node dist/cli.js directive assign --directive determinism --role FABRICATED-ROLE     exit 0
$ git show HEAD:.wingfoil/roles.yaml | grep -A1 FABRICATED   ->  FABRICATED-ROLE:\n    - determinism
$ git show HEAD:.wingfoil/dna.yaml   | grep -c FABRICATED    ->  1
# the binding and the role that supports it are now in the same committed record (REQ-SYS-08).
$ git rm --cached -q .wingfoil/dna.yaml && git commit -q -m 'untrack dna.yaml'
$ node dist/cli.js directive assign --directive traceability --role developer
error: cannot resolve the role catalogue: '.wingfoil/dna.yaml' is not committed at HEAD. …     exit 1
```

The AC5 findings S1, S2 and S3 were **re-measured against this same fixed build** and all three still
reproduce unchanged — they are outside both fixes, as the design section says, not accidentally
closed by them (`memory add` still commits `wf(fabricated-type): add fab-001-probe` against a type
`git show HEAD:.wingfoil/memory.yaml` does not contain; `directive assign` still binds `ghost`, whose
file `git cat-file -e HEAD:…/ghost.md` cannot find; `directive remove determinism` still exits `0`
while `git show HEAD:.wingfoil/roles.yaml | grep -c determinism` says `2`).

#### Coverage — measured on both sides, not quoted

Baseline taken by running `npx jest --coverage` in a detached worktree at this branch's base
(`eca728e`), since removed:

| | Stmts | Branch | Funcs | Lines | Tests |
|---|---|---|---|---|---|
| base `eca728e` | 98.65 | 93.25 | 98.86 | 99.22 | 1833 |
| this branch | **98.67** | **93.32** | **98.87** | **99.23** | 1870 |

No metric regressed. `src/core/directive-assign.ts` is at **100 / 100 / 100 / 100**;
`src/core/memory-transition.ts` at 98.68 / 97.36 / 100 / 100. The two lines still uncovered in files
this task touched are both **pre-existing and moved, not written**: `loaders.ts:142` (the `throw err`
rethrow inside `parseDnaYaml`, reported at `loaders.ts:102` on the base) and
`memory-transition.ts:170` (the `if (!(error instanceof ValidationError)) throw error` of the
transition-resolution catch, reported at `memory-transition.ts:101` on the base). Both were measured
on the base run, not assumed.

#### Sync with `main` before submit (`dl-035` — merge, never rebase)

```
$ git log --oneline -1 main
eca728e wf(task): approve task-091-reads-resolve-at-head, …
$ git merge main
Already up to date.
```

`main` did not move while this task ran, so no document cited above can have gone stale and every
gate below is current.

#### Gates (run in this worktree)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx jest` | **119 suites, 1870 tests passed**, exit 0 |
| Coverage ≥ 80, non-regressing | `npx jest --coverage` | **98.67 / 93.32 / 98.87 / 99.23** — no metric below base |
| Build typecheck | `npx tsc -p tsconfig.build.json --noEmit` | exit **0**, no output |
| Full typecheck | `npx tsc --noEmit -p tsconfig.json` | exit **0**, no output (`bug-026` stays closed) |
| Lint | `npm run lint` | exit **0**, no output |
| API docs | `npm run docs:api` | exit **0** |

BDD acceptance scenarios touched by this change, and the tests that cover them:

| BDD scenario | Test that covers it |
|---|---|
| P1.6 sc.1 *Submit a draft document for approval* | `test/core/memory-submit.test.ts` (unchanged, green) + `memory-machine-baseline.test.ts` "AC2/AC6: an uncommitted `sequence` edit does not decide the target — the COMMITTED machine does" |
| P1.6 sc.2 *Error — illegal transition* | `test/core/memory-submit.test.ts` (unchanged) + `memory-machine-baseline.test.ts` "AC3/AC6: a status only the working-tree machine defines is refused at exit 1, nothing written" |
| P1.6 sc.3 *Error — document not found* | `test/core/memory-submit.test.ts` (unchanged) + `memory-machine-baseline.test.ts` "AC3: a type defined only in the working tree cannot carry a transition" |
| P1.7 sc.1 / P1.8 sc.1 / P1.9 sc.1 *approve / reject / deprecate* | `test/core/memory-approve.test.ts`, `memory-reject.test.ts`, `memory-deprecate.test.ts` (all unchanged) + `memory-machine-baseline.test.ts` "AC2: `<verb>` too resolves its edge from HEAD, not from the dirty machine" (×3) |
| P3.2 sc.1 *Assign a directive to a role* | `test/core/directive-assign.test.ts` (unchanged) + `directive-assign-role-baseline.test.ts` "AC4: an already-committed role assigns normally, one scoped commit" |
| P3.2 sc.2 *Error — assigning to a role not defined in DNA* | `test/core/directive-assign.test.ts` (unchanged — its fixture commits `dna.yaml`, so the message matches byte for byte) + `directive-assign-role-baseline.test.ts` "AC3/AC6: an UNCOMMITTED role is refused at exit 1" |
| P3.2 sc.3 *Error — assigning a non-existent directive* | `test/core/directive-assign.test.ts` (unchanged) + `directive-assign-role-baseline.test.ts` "an unknown directive id is still reported as such, with the role valid at HEAD" |
| P3.7 (multi-directive assignment) | `test/core/directive-assign.test.ts` (unchanged) — `checkAssignable` still validates every id before anything is written |
| P5.1.1 *fresh init runs every transition verb* | `test/cli/fresh-init-transitions.test.ts` — untouched and green: `init` commits the machine, so every verb it drives reads a committed one |

### review-ready summary — role: reviewer

**What changed, in one sentence.** The state machine that decides a Memory transition and the role
catalogue that gates a `directive assign` were both read from the files on disk, so an uncommitted
edit decided what a permanent commit recorded — in the Memory case through a verb needing no
authority, leaving the element in a status no verb could move; both now resolve against the
`.wingfoil/*.yaml` committed at `HEAD`, and neither `prepareMemoryTransition` nor `checkAssignable`
accepts a parsed document from its caller any more, so there is no call path that can reach either
decision with a working-tree file.

**AC coverage**

| AC | Status | Where |
|---|---|---|
| AC1 reproduce both first, on scratch projects, against a build of `main` | done | `design` § AC1 — both transcripts, `bug-081`'s showing the fabricated status committed and all three verbs refusing afterwards, `bug-082`'s showing `git show HEAD:.wingfoil/dna.yaml` lacking the bound role |
| AC2 both reads resolve at `HEAD`, by removing the parameter | done | `design` § AC2 D1/D2; `green` § — both signatures changed, enforced by the type checker. Neither needed AC2's "say why not" escape |
| AC3 refusals exit `1` | done | `refactor` § AC3/AC4 transcripts; both baseline suites plus the CLI suite assert `1`, never `2` |
| AC4 bootstrap + ordinary flows pinned; absent/unreadable committed `memory.yaml` decided deliberately | done — **fail-closed**, argued in D4 on three grounds, only one shared with task-090 | `design` § AC4 (the `init` measurement) + D4; tests at both seams |
| AC5 sweep the other gating reads | done | `design` § AC5 — a table with the command that settles every row, three live findings (S1/S2/S3) with transcripts, re-measured post-fix; the workflow layer settled as having no gating read at all |
| AC6 tests pin both defects, red before / green after | done | `red` § — 18 failed / 8 passed before, 26 passed after; commands recorded |
| AC7 this repository's history is not re-verified or rewritten | done | `git log --oneline main..HEAD` touches no historical commit; every reproduction ran in a throwaway project (`bug-075`); no test reads this repository's own Memory |
| AC8 six gates green | done | `refactor` § Gates |

**What the approver must decide**

1. **The three sweep findings (S1, S2, S3)**, all measured twice and none fixed here. **S3 is the one
   to look at first**: `directive remove` deletes a custom asset while the committed `roles.yaml`
   still binds it, which walks past the one check REQ-SEC-07 clause (b) exists to enforce, on the
   only verb that destroys an artefact. I grade it above `bug-082`.
2. **`dl-080`'s Action 4 — "write the ruling where an implementer meets it"** — has no owner. No task
   in `docs/04_memory/v0.2/` references `dl-080` other than task-091/092/093, and none of
   the three carries that action. Two TSDoc comments and this file now state the rule; a directive or
   a `spec-005`/`spec-008` amendment is what the ratification asked for.

**Weak spots a reviewer should check**

1. **A behaviour change in the permissive direction, on both surfaces.** A working tree that
   *withdraws* something `HEAD` records no longer blocks: a narrowed machine still allows a
   transition `HEAD` sanctions, and a role removed only in the working tree is still assignable. Both
   are correct under the rule adopted and both are pinned by tests, but they are the cases where the
   new behaviour permits where the old refused (task-090's M2, on two new surfaces).
2. **Refusal messages grew a second sentence**, only when the working tree and `HEAD` disagree. Any
   consumer matching a message with `===` rather than a prefix would see the difference; in this
   repository nothing does (the existing suites commit their fixtures and still match exactly).
3. **A split baseline inside `directive assign`**: `--role` now resolves at `HEAD`, `--directive`
   still against the files on disk. Deliberate and argued (D2 — it needs a `git ls-tree`-shaped
   primitive that does not exist, and `dl-042`'s warnings channel already surfaces the dangling
   result), but it is a reviewer's call whether the asymmetry should have blocked this task.
4. **`memory add` is now on a different baseline from the four transition verbs** (S1). The visible
   consequence: a type defined only in the working tree still accepts `memory add`, and the element
   it commits cannot then be submitted. That is a real edge and it is filed rather than fixed.
5. **Three `jest.spyOn`s across the two new suites** (`refactor` §), each reaching a defensive branch
   nothing in the code can produce. They pin real properties — a diagnostic must never decide, and a
   defect in a read must never become an answer — but module spying is worth a second opinion.
6. **`loadDnaYamlAtHead` is now public** (D3), reversing task-090's deliberate choice on the ground
   that the rule it was waiting for has been ratified. A reviewer may take the opposite view.
