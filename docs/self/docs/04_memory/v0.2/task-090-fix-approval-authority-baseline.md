---
id: "task-090-fix-approval-authority-baseline"
type: task
title: "Resolve the approval authority against a committed state, so an `Approver:` line cannot rest on an uncommitted `dna.yaml`"
status: in-progress
release: "v0.2"
priority: "high"
tags: ["v0.2", "memory", "security", "audit-trail"]
ref: "bug-079-uncommitted-dna-yaml-grants-approval-authority"
bug: ["bug-079-uncommitted-dna-yaml-grants-approval-authority"]
depends_on: ["task-088-fix-gated-verbs-commit-only-the-status-change"]
tmpl_version: 260703
---

## Description

The approval-authority check reads `dna.yaml` from the working tree, so an **uncommitted** edit
granting the current git identity the `approver` role is enough: `memory approve` proceeds and writes
`Approver: <name> <email> (approver)` into a permanent commit. The commit attests an authority that no
committed state of the repository records.

`task-088` does not close this. Its guard is deliberately *per-path* — it refuses when the **element**
being transitioned is modified — and `dna.yaml` is a different path. The remedy here is not a wider
guard but a different **baseline** for this particular read.

Declared a release blocker for `minor-v0.2`, at `critical`: the release ships the approval verbs, and
**P1.7** requires an approval to record approver identity while `adr-006-git-identity-role-based-authz`
makes that identity the basis of authorisation. An `Approver:` line no committed state supports is the
failure of the guarantee the feature exists to provide.

## Acceptance Criteria

- **AC1** — Reproduce first, on a scratch project, against a build of `main` that already contains
  `task-088` — the point being that its fix does not close this. Record the commands, the resulting
  commit body, and the committed `dna.yaml` at that commit still showing the identity is not an
  approver. A scratch project is required (`bug-075`).
- **AC2** — **Choose the baseline and argue it.** Two shapes, and they are not equivalent:
  - *(a)* resolve authority from the **committed** `dna.yaml` — at `HEAD`, or at the commit being
    produced — so the working tree cannot influence it;
  - *(b)* **refuse** the verb while `dna.yaml` carries uncommitted modifications, following the shape
    `task-088` established for the element.

  Weigh them against what each does to a legitimate flow: a project that has just run `init` and is
  seeding its first approver, a developer editing `dna.yaml` for unrelated reasons mid-review, and a
  CI checkout where nothing is ever dirty. Say what the rejected option would have been better at.
- **AC3** — After the fix, the reproduction from AC1 fails closed: the verb refuses, or resolves the
  authority from the committed state and refuses because the identity is not an approver there. Exit
  code per **`spec-005` §1** — `1` for a well-formed invocation that fails validation; do **not**
  emit `2`, which that spec reserves for a malformed invocation. This was ruled on `bug-076` and
  applies unchanged.
- **AC4** — **The bootstrap case must still work.** A fresh project has `team.members: []` and nobody
  is an approver; whatever you choose must leave a legitimate path to seeding the first approver, and
  a test must pin it. If your choice makes that path awkward, say so plainly rather than declaring it
  out of scope — it is the one flow every new user hits.
- **AC5** — Establish whether any **other** authority or policy read has the same baseline problem —
  `roles.yaml` bindings, and any directive or workflow read that gates behaviour. Report each with the
  command that settles it. Fix only what falls inside this task's argument; file the rest.
- **AC6** — A test pins the defect itself and fails against the current code. State the command
  showing it red before and green after.
- **AC7** — Nothing in this repository's own history is re-verified against the new rule or rewritten.
  Every approval here was made by hand; `dl-035` forbids rewriting merged `wf` commits regardless.
- **AC8** — All six gates green; the full `tsc --noEmit -p tsconfig.json` silent.

## Implementation Notes

- Read `task-088`'s Execution Notes first (`dl-015` read_related): it established the guard shape, the
  committed-tree postcondition, and the reasoning for keeping the guard per-path — which is precisely
  why this defect survived it.
- `requireApprovalAuthority` and `readGitIdentity` are the primitives to start from; find their read
  path rather than assuming which file layer serves them.
- `bug-078` covers the same root cause on the **write** side for the non-transition verbs and is *not*
  in scope. If your fix suggests a general rule about which baseline a command reads, that is a
  decision-log worth proposing — propose it, do not enact it.
- Classify every AC per `dl-014`/T1. AC1, AC3 and AC6 are red-first by construction.

## Execution Notes

<!-- filled in per phase -->

### start — role: developer

`status: backlog → in-progress` (`fce5f0c`). `bug:` is non-empty, so `bug.sync_state` ran as its own
commit: `bug-079` `planned → in-progress` (`23d19b5`).

Worktree `/home/robypomper/Workspaces/.wf2-wt/task-090`, branch
`task/task-090-fix-approval-authority-baseline`, from `main` at `59d4d5a` — which already contains
`task-088`'s merge (`a146f12`), the precondition AC1 rests on.
`npm ci --prefer-offline --no-audit --no-fund` → exit 0.

### design — role: architect

Directives loaded: architecture, determinism, traceability (architect); code-quality, testing,
determinism (developer); doc-versioning, documentation, security-secrets (global).

#### `read_related` (`dl-015`, HARD gate)

- **`task-088-fix-gated-verbs-commit-only-the-status-change` (`done`) — Execution Notes read in
  full**, the only entry in `depends_on`. What I took from it:
  1. **Why this defect survived it, in its own words.** Its review summary lists as weak spot 1: "The
     guard is per-path, deliberately. A dirty `dna.yaml` or an unrelated dirty document does not block
     a transition — only the element being transitioned does." So the survival of `bug-079` is a
     recorded consequence of that task's scope, not an oversight, and AC1 below measures it rather
     than assuming it.
  2. **The primitives to build on.** Its `green` table put the git read primitives in
     `src/storage/commit.ts` — `readPathAtRev(root, rev, path)` (a sha, `HEAD`, or the index stage
     `:0`), `pathPorcelainStatus`, `commitParent`, `changedPathsBetween` — precisely so a caller can
     ask what a *committed* tree holds. `readPathAtRev(root, 'HEAD', …)` is exactly the read this
     task needs; nothing new is invented at the git layer.
  3. **The postcondition that makes `HEAD` and "the commit being produced" the same answer.**
     `verifyCommittedScope` asserts the new commit changes exactly the element path. So the approve
     commit carries `.wingfoil/dna.yaml` byte-identical to its parent's, and "resolve authority at
     `HEAD`" and "resolve it at the commit being produced" — the two shapes `bug-079`'s Expected
     Behavior offers — cannot diverge. That is a dependency in the literal sense: without task-088's
     check, option (a) would have had to choose between them. Pinned as a test (`red` §, the
     corroboration case) rather than left as an argument.
  4. **The exit-code precedent, which AC3 also cites.** task-088 returned `1` where its own AC said
     `2`, on the ground that `spec-005` §1 partitions the codes by *what is wrong* and a repository-
     state precondition is not a malformed invocation. AC3 here instructs the same and says it was
     ruled on `bug-076`; nothing is re-argued.
  5. **A measurement gotcha reused.** Its `red` notes (from task-086) record that `execFileSync` +
     `catch` reads back `stderr: ''` for a command that exits `0` while printing to fd 2, so any
     CLI-level assertion about stderr uses `spawnSync`. Used below.
- **`bug-079-uncommitted-dna-yaml-grants-approval-authority` (source bug, `in-progress`) — read in
  full.** Its "Expected Behavior" offers the same two shapes as AC2 and declines to choose; its
  "Notes" fix the exposure as "the credibility of the trail, not access control", which is the frame
  the decision below is argued in. Its "Steps to Reproduce" are re-derived, not pasted (AC1).

#### `verify_specs`

No new `tech-spec` and no amendment to an approved one. Every rule this task enforces is already
written down; what is missing is that nothing said which *baseline* the authority read uses, and the
answer is derivable from an already-accepted ADR rather than needing a new one:

- **`adr-006-git-identity-role-based-authz`** (`accepted`, read at `59d4d5a`), Decision point 2, fixes
  approval authority as a role held through `dna.yaml`'s `team.members[].roles`. Its Consequences →
  Positive bullet states the property that decides this task: a fresh clone "reproduces the full audit
  trail with zero extra infrastructure". A clone contains committed state and nothing else, so an
  authority that lives only in a working tree is, by that sentence, not reproducible — the trail it
  supports cannot be re-derived from what was cloned. This task makes the code match the ADR rather
  than amending it.
- **REQ-SEC-03** (`docs/02_requirements/03_sard/05_security-compliance.md`) supplies the refusal's fit
  criterion, `user not authorized to approve type '<type>'`, which stays verbatim as the message's
  first sentence (see `green` on the added diagnostic).
- **`spec-005-cli-command-contract`** § "1. Exit-code contract (REQ-INT-04)" — **not** amended: every
  refusal added here is a well-formed invocation failing a repository-state precondition, i.e. exit
  `1`, per AC3 and the `bug-076` ruling.
- **`spec-010-memory-frontmatter-schema`** § "Field-write ownership" — untouched; this task changes no
  field-write scope.

`design` gate state: `frontmatter.required` (`title`, `release`) present; `depends_on.acknowledged`
satisfied above; `tech-spec.approved` — no spec scaffolded, so the approver gate passes through.

#### AC1 — the defect, reproduced end to end before anything was changed

Built this branch at its base (`npm run build`, exit 0 — no `src/` change yet, so the binary contains
`task-088`'s fix and nothing of this task's), then a throwaway project under the session scratchpad
(`bug-075`: the verbs cannot be pointed at this repository's own Memory).

```
$ git init -q . && git config user.name 'Test User' && git config user.email 'test@example.test'
$ node dist/cli.js init --template scrum        # exit 0; commits the scaffold, team.members: []
$ node dist/cli.js memory add --type adr --title 'Repro target'   -> adr-001-repro-target
$ node dist/cli.js memory submit adr-001-repro-target             -> draft → pending
# add the git identity to .wingfoil/dna.yaml's team.members with roles [developer, approver].
# NEVER committed:
$ git status --porcelain
 M .wingfoil/dna.yaml
$ node dist/cli.js memory approve adr-001-repro-target --reason 'authority from an uncommitted file'
{ "id": "adr-001-repro-target", …, "from": "pending", "to": "approved" }     exit 0
$ git log -1 --format='%B'
wf(adr): approve adr-001-repro-target [pending → approved]

Approver: Test User <test@example.test> (approver)
Reason: authority from an uncommitted file

$ git show HEAD:.wingfoil/dna.yaml | grep -n members
23:  members: []
```

Exactly what `bug-079` reports, and **`task-088`'s guard is visibly not the one in play**: the element
was clean (`git status --porcelain` names only `.wingfoil/dna.yaml`), so the per-path guard had
nothing to refuse. The commit attests an approver that `git show HEAD:.wingfoil/dna.yaml` — the
repository's own record, at that very commit — contradicts.

#### M1 — the same defect with no file to be dirty at all

Not in `bug-079`, found while establishing the baseline, and it is the extreme of the same read.
`.wingfoil/dna.yaml` need not be *modified*; it need not be **tracked**:

```
$ git rm --cached -q .wingfoil/dna.yaml && git commit -q -m 'remove dna.yaml from the tree (keep it on disk)'
$ git status --porcelain
?? .wingfoil/dna.yaml
$ git show HEAD:.wingfoil/dna.yaml ; echo $?
128                       # no committed dna.yaml anywhere in the repository
$ node dist/cli.js memory approve adr-003-m3-target --reason 'no committed dna.yaml at all'   -> exit 0
wf(adr): approve adr-003-m3-target [pending → approved]
Approver: Test User <test@example.test> (approver)
```

An `Approver:` line backed by a configuration file that exists in **no commit of the repository**.
Both options close it — `git status` reports `??`, which option (b) treats as modified — but only (a)
diagnoses it correctly, and it is the case that shows the question is "what does the repository
record", not "is the file dirty".

#### M2 — the read is wrong in the other direction too, and (a) changes behaviour there

Measured on the same build, with the approver grant **committed** this time and then withdrawn in the
working tree only:

```
$ git commit -q .wingfoil/dna.yaml -m 'seed approver (committed this time)'   # HEAD: roles [developer, approver]
# working-tree edit, uncommitted: roles [developer]
$ git status --porcelain
 M .wingfoil/dna.yaml
$ node dist/cli.js memory approve adr-002-m2-target --reason 'HEAD says I am an approver'
error: user not authorized to approve type 'adr'          exit 1
```

Today the verb refuses an approver **of record**, on the strength of an edit no one has committed.
That is not a security failure, but it is the same defect: the working tree, not the repository,
decides. Under (a) this case starts succeeding — a real behaviour change, stated here rather than
discovered by a reviewer — and it is correct under the rule the fix adopts: authority is what the
repository records. Under (b) it stays a refusal, but with an accurate message (`dna.yaml` is
modified) instead of a false claim about the user's roles.

#### AC2 — the decision: **(a)**, resolve authority from the committed `dna.yaml` at `HEAD`

**Chosen: (a)**, with the refusal message extended to name the baseline when the working tree
disagrees with it (which is how (a) recovers most of what (b) is better at — see below).

**What (b) would have been better at, stated plainly.**

1. **Telling a confused user the truth about their own screen.** Under (a), a user who has just added
   themselves to `dna.yaml` and not committed is told `user not authorized to approve type 'adr'`
   while the file open in their editor says otherwise. (b)'s message — "`dna.yaml` is modified" —
   describes the world the user is looking at. This is (b)'s real advantage and it is why the
   implementation below appends a second sentence naming the uncommitted grant; but note the recovery
   is one-directional. In M2's direction — the working tree *withdrawing* an authority `HEAD` grants
   — (a) is silently permissive and says nothing, because under its own rule there is nothing to
   report.
2. **One rule, uniformly, for every config read.** "Never act on configuration the repository has not
   recorded" is a single sentence that would also cover `memory.yaml`'s state machines and
   `dna.yaml`'s role catalogue (AC5 below), where (a) has to be argued read by read. That uniformity
   is exactly what `bug-078` and AC5's findings point at, and it is why the general rule is proposed
   as a decision-log rather than enacted here.
3. **Never being wrong about an unreadable committed file.** (a) must decide what to do when `HEAD`
   holds no `dna.yaml` (M1) or holds an invalid one; (b) never reads the committed file and so never
   faces the question. (a) fails closed in both cases, which is one more refusal path to get right.

**Why (a) wins anyway.**

1. **(b) is a guard; the bug asks for a baseline.** `bug-079`'s Expected Behavior opens "Authority is
   a property of the repository, not of a working tree." Under (b) the *read* still takes the working
   tree as its source; the guard merely arranges for the two to coincide at the instant of the call.
   The corroboration property — that `git show <approve-sha>:.wingfoil/dna.yaml` supports the
   `Approver:` line in that same commit — then holds as a *side effect of a precondition*, and any
   later call path that resolves authority without remembering to run the guard reopens the hole. Under
   (a) the property is intrinsic to the read: there is no code path, present or future, that can
   resolve authority from anything but a commit, because the function never opens the working-tree
   file for that purpose. This is the whole difference between the two options, and it is the reason
   the fix is in `requireApprovalAuthority`'s **signature** (it no longer accepts a `DnaYaml` from a
   caller) rather than in a check placed next to it.
2. **(b) refuses flows that are not defective.** `dna.yaml` is the project map — modules, stacks,
   paths, team. The mid-review developer who has added a module to it, or renamed a path, has changed
   nothing about who may approve, and (b) stops the approval anyway; at a release gate, a batch of
   approvals is blocked by an edit that is provably irrelevant to authority. (a) never refuses a case
   the repository actually supports. (The CI checkout, where nothing is ever dirty, cannot tell the
   options apart and is evidence for neither.)
3. **(a) answers the question that was asked.** "Is this identity an approver?" has an answer in the
   repository. (b) declines to answer it and reports a different fact — "the file is dirty" — which
   the user must translate. For the *authority* read specifically, refusing to answer a question the
   repository can answer is a worse trade than it is for the `bug-076` element case, where there was
   genuinely no well-defined answer to give (task-088 M1: two candidate baselines on disk that can
   disagree). Here there is exactly one candidate — the commit — and it is the one the audit trail is
   made of.
4. **The asymmetry with task-088 is real, not a stylistic break.** task-088 chose (b) for the
   *element being transitioned*, because the verb must **write** that file and there is no defensible
   way to write a file "as committed" while the user's edits sit on top of it. `dna.yaml` is only
   **read** here, and a read has a baseline available to it that a write does not. Same shape of
   defect, two different verbs of contact with the file, two different remedies — which is also why
   the general rule (AC5, `bug-078`) is worth stating once for all commands, and why it is proposed
   rather than enacted: read-vs-write is likely to be its hinge, and that is the approver's call.

**The deciding principle.** An approval commit is evidence. Evidence is worth what an independent
reader can re-derive from the artefact of record — a fresh clone, months later, with the working tree
gone. `adr-006`'s own Positive consequence ("a fresh clone reproduces the full audit trail with zero
extra infrastructure") states the standard; (a) is the option that makes the authority half of every
approval satisfy it by construction.

#### AC4 — the bootstrap case, and the one thing about it that is genuinely awkward

A fresh project scaffolds `team.members: []` (`git show HEAD:.wingfoil/dna.yaml` after `init`, AC1
transcript). The legitimate path to the first approver is unchanged by this task and **is not gated**:

```
$ grep -rn "requireApprovalAuthority(" src/
src/core/index.ts:799   (memoryApproveFn)
src/core/index.ts:890   (memoryRejectFn)
```

Nothing else in the system asks for approval authority, so writing `dna.yaml` and committing it needs
none — there is no chicken-and-egg. Under (a) the bootstrap is: `init` → add the member to
`.wingfoil/dna.yaml` → **commit it** → `memory approve` works. That is exactly what this repository's
own end-to-end suite already does (`grantApproverRole` in `test/cli/fresh-init-transitions.test.ts`
writes the member and then runs `git add`/`git commit`), which is why that suite stays green — the
flow was already correct; only the tolerance for skipping the commit is removed. It is pinned
explicitly as a paired test (`red` §, AC4).

**The awkwardness, stated rather than waved away.** The seeding step is a **hand edit plus a manual
`git commit`**, because no CLI verb can add a team member:

```
$ node dist/cli.js dna set 'team.members' '[{name: Test User, email: test@example.test, roles: [approver]}]'
error: E_VALIDATION team.members (…/.wingfoil/dna.yaml): Invalid input: expected array, received string
exit=1
```

`dna set` takes a scalar `<value>` and a dotted key path with no index syntax, so it cannot write a
`team.members[]` entry at all. That gap pre-exists this task — it is why every scratch recipe in
task-086/088 and the fixture above hand-edit the file — but this task makes its second half
*load-bearing*: before, committing the edit was a convention; now it is the difference between an
approval working and not. The remedy is a CLI path for seeding a team member (and, with it, a commit
the user did not have to write by hand); it is out of scope here and proposed as an element in the
final report.

#### AC5 — the same baseline question elsewhere: what I found, and what settles each

Sweep command (every pillar loader call site in `src/`):

```
$ grep -rn "loadDnaYaml(root)\|loadMemoryYaml(root)\|loadRolesYaml(root)\|loadWorkflowsYaml(root)\|loadDirectives(root)" src/
```

Every one of them reads the working tree. Classified by whether the read **gates** a mutation whose
committed result then depends on it:

| Read | Gates what | Same defect? | Command that settles it |
|---|---|---|---|
| `dna.yaml` → `requireApprovalAuthority` (`index.ts:797`, `:888`) | `memory approve` / `memory reject` | **Yes — this task** | AC1 transcript above |
| `memory.yaml` → `prepareMemoryTransition` (`index.ts:790`, `:881`, `:985`, `:703`) | which transition is legal, and the `[from → to]` bracket every transition commit records | **Yes, unfixed** — an uncommitted edit to a state machine makes an illegal edge legal and the commit subject attests it | measured, see below |
| `dna.yaml` → `checkAssignable` (`index.ts:1143`, `directive assign`) | whether `--role` exists in `team.roles` before `roles.yaml` is written | **Yes, unfixed** — a binding to a role that exists in no committed `dna.yaml` can be committed | `grep -n "checkAssignable" src/core/index.ts src/core/directive-assign.ts` |
| `roles.yaml` → `directives list` (`directives-list.ts:191`), `assembleExecutionContext`, `mcp/prompt.ts:135` | nothing — read-only output | No gate. Still a *determinism* question about context building (the live tree is the source), already noted in `src/memory/relevance.ts`'s own comment | `grep -rn "loadRolesYaml(root)" src/` → three sites, none `mutates: true` |
| `requireCustomAsset` (REQ-SEC-07) | `directive remove` / workflow remove | No — pure path predicate, reads no config | `grep -n "readDocument\|loadDnaYaml\|loadRolesYaml" src/core/builtin-asset.ts` → no match |
| `requireGitIdentity` (REQ-SEC-01) | every mutating op | No — git config is local by nature and cannot be committed; it is the "who is asking", which (a) deliberately keeps reading live (see `green`) | `grep -n "readGitIdentity" src/core/git-identity.ts` |

The `memory.yaml` finding, measured on the scratch project rather than argued (same build, `adr`
falling back to `defaults.states`):

```
$ git show HEAD:.wingfoil/memory.yaml | grep -A3 'states:'      # committed: sequence [draft, pending, approved]
# uncommitted edit to .wingfoil/memory.yaml adding `in-review` to defaults.states.sequence
$ node dist/cli.js memory approve adr-004-… --reason '…'
wf(adr): approve adr-004-… [pending → in-review]              exit 0
```

(transcript in `red` § M3, run after the fix, which does not touch this read.) Both of these fall
**outside** this task's argument: mine is about *who authorised*, and these are about *what was
allowed* and *what a binding may reference*. They are filed as proposed elements, together with the
general-rule decision-log the Implementation Notes ask for — which read takes which baseline, with
read-vs-write as its likely hinge (`bug-078` is its write-side half).

#### T1 — AC classification (`dl-014`, `testing` directive)

| AC | Class | Evidence for the class |
|---|---|---|
| **AC1** — reproduce first | **process gate, not testable** | Satisfied by the AC1 section above, run against the base build before any `src/` edit. AC6's test is its durable form. |
| **AC2** — choose the baseline and argue it | **not testable** — a decision | Recorded above; its *consequences* are pinned by the AC3/AC6 tests. |
| **AC3** — the reproduction fails closed, exit `1` | **red-first** | Measured red: AC1 exits `0` and produces the commit. `grep -rn "readPathAtRev" src/core/approval-authority.ts src/core/loaders.ts` → no match; nothing in the authority path reads a revision today. |
| **AC4** — the bootstrap path still works, pinned | **split** — **characterization** for "seed + commit → approve succeeds" (it already works: `test/cli/fresh-init-transitions.test.ts` drives it on `main` and its `grantApproverRole` already commits), **red-first** for its pair "seed without committing → refused", which is AC1 itself. |
| **AC5** — sweep for other baseline reads | **process gate / investigation** | Table above; each row carries the command. Nothing is fixed here, so nothing is tested here. |
| **AC6** — a test pins the defect, red before / green after | **red-first** | Same evidence as AC3; command recorded under `red`. |
| **AC7** — this repository's history is not re-verified or rewritten | **process gate** | Negative obligation. `git log --oneline main..HEAD` touches no historical commit; no test reads this repository's Memory, and `bug-075` means the verbs cannot be pointed at it. |
| **AC8** — six gates green | **process** | Run at `refactor`/`review`. |
